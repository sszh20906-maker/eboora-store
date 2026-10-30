import assert from 'node:assert/strict';
import { onRequestPost as createOrder } from '../functions/api/create-order.js';
import { onRequestGet as verifyOrder } from '../functions/api/verify-order.js';
import { onRequestGet as downloadFile } from '../functions/api/download.js';
import { onRequestPost as webhook } from '../functions/api/cashfree-webhook.js';

const rows = new Map();
const paymentReceipts = new Map();
const db = {
  prepare(sql) {
    return { bind(...args) {
      return {
        async run() {
          if (sql.includes('INSERT OR IGNORE INTO payment_receipts')) {
            if (paymentReceipts.has(args[0])) return { meta: { changes: 0 } };
            paymentReceipts.set(args[0], args[1]); return { meta: { changes: 1 } };
          }
          if (sql.includes('INSERT INTO orders')) {
            const [order_id, product_id, amount, currency, customer_name, customer_email, customer_phone] = args;
            rows.set(order_id, {order_id, product_id, amount, currency, customer_name, customer_email, customer_phone, status:'CREATED', email_status:'PENDING', meta_status:'PENDING'});
          } else if (sql.includes("SET status = 'PAID'")) {
            const row = rows.get(args[0]); if(row){row.status='PAID'; row.paid_at='now';}
          } else if (sql.includes("SET email_status = 'SENT'")) {
            const row = rows.get(args[0]); if(row) row.email_status='SENT';
          } else if (sql.includes("SET email_status = 'FAILED'")) {
            const row = rows.get(args[0]); if(row) row.email_status='FAILED';
          } else if (sql.includes('SET meta_status = ?')) {
            const row = rows.get(args[1]); if(row) row.meta_status=args[0];
          }
          return {success:true};
        },
        async first() { if (sql.includes('FROM payment_receipts')) return paymentReceipts.has(args[0]) ? { order_id: paymentReceipts.get(args[0]) } : null; const row=rows.get(args[0]); return row ? {...row} : null; }
      };
    }};
  }
};
const env = {
  CASHFREE_ENV:'sandbox', CASHFREE_APP_ID:'app', CASHFREE_SECRET_KEY:'api-secret', CASHFREE_WEBHOOK_SECRET:'webhook-secret',
  CASHFREE_API_VERSION:'2026-01-01', SITE_URL:'https://shop.example.test', ORDERS_DB:db,
  PRODUCT_PRICE_INR:'499', PRODUCT_ID:'creator-kit', PRODUCT_NAME:'Creator Kit', PRODUCT_CURRENCY:'INR',
  DOWNLOAD_TOKEN_SECRET:'local-test-download-token-secret-more-than-32', PRODUCT_FILE_KEY:'creator-kit-download.zip',
  PRODUCTS_BUCKET:{ async get(key){assert.equal(key,'creator-kit-download.zip'); return {body:new Blob(['test product content']).stream(),size:20,httpMetadata:{contentType:'application/zip'},httpEtag:'etag'};}},
  RESEND_API_KEY:'resend', FROM_EMAIL:'Creator <download@example.test>', REPLY_TO:'support@example.test', BRAND_NAME:'Creator', PRODUCT_FILENAME:'creator-kit-download.zip'
};
const nativeFetch = global.fetch;
global.fetch = async (url, opts={}) => {
  url=String(url);
  if(url.endsWith('/pg/orders') && opts.method==='POST') return new Response(JSON.stringify({order_id:JSON.parse(opts.body).order_id,payment_session_id:'session_test'}),{status:200,headers:{'Content-Type':'application/json'}});
  if(url.includes('/pg/orders/')) return new Response(JSON.stringify({order_status:'PAID',order_amount:499,order_currency:'INR'}),{status:200,headers:{'Content-Type':'application/json'}});
  if(url==='https://api.resend.com/emails') return new Response(JSON.stringify({id:'email_test'}),{status:200,headers:{'Content-Type':'application/json'}});
  throw new Error('Unexpected fetch '+url);
};
try {
  const created = await createOrder({request:new Request('https://shop.example.test/api/create-order',{method:'POST',headers:{Origin:'https://shop.example.test','Content-Type':'application/json'},body:JSON.stringify({customer_name:'Sameer Test',customer_email:'sameer@example.test',customer_phone:'9876543210'})}),env});
  assert.equal(created.status,201);
  const data = await created.json();
  assert.equal(data.payment_session_id,'session_test');
  assert.equal(data.amount,499);
  const raw = JSON.stringify({type:'PAYMENT_SUCCESS_WEBHOOK',data:{order:{order_id:data.order_id,order_amount:499,order_currency:'INR'},payment:{payment_status:'SUCCESS',cf_payment_id:'pay_checkout_01',payment_amount:499,payment_currency:'INR'},customer_details:{customer_email:'sameer@example.test',customer_phone:'9876543210'}}});
  const timestamp=String(Date.now());
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.CASHFREE_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const mac=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(timestamp+raw));
  const signature=btoa(String.fromCharCode(...new Uint8Array(mac)));
  const wh = await webhook({request:new Request('https://shop.example.test/api/cashfree-webhook',{method:'POST',headers:{'x-webhook-timestamp':timestamp,'x-webhook-signature':signature},body:raw}),env});
  assert.equal(wh.status,200);
  assert.equal(rows.get(data.order_id).email_status,'SENT');
  const verified = await verifyOrder({request:new Request('https://shop.example.test/api/verify-order?order_id='+data.order_id),env});
  assert.equal(verified.status,200);
  const vd=await verified.json(); assert.equal(vd.paid,true); assert.match(vd.download_url,/\/api\/download\?order_id=/);
  const downloadUrl = new URL(vd.download_url);
  const dl = await downloadFile({request:new Request(downloadUrl),env});
  assert.equal(dl.status,200); assert.equal(await dl.text(),'test product content');
  console.log('Mocked checkout → signed webhook → verified order → private download test passed.');
} finally {global.fetch=nativeFetch;}

// Regression: a JSON "null" body must return 400, not crash with a 500.
{
  const res = await createOrder({ request: new Request('https://shop.example.test/api/create-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'null' }), env: { ...env, ORDERS_DB: db } });
  assert.equal(res.status, 400);
  console.log('Null body regression test passed.');
}
