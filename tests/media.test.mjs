import assert from "node:assert/strict";
import { makeDb, ADMIN_COOKIE, TEST_ADMIN_HASH } from "./helpers/mockdb.mjs";
import { onRequestPost as upload, onRequestDelete as removeUpload } from "../functions/api/admin/upload.js";
import { onRequestGet as coverGet } from "../functions/api/media/product/[id].js";
import { onRequestGet as productDetail } from "../functions/api/products/[slug].js";
import { onRequestGet as downloadFile } from "../functions/api/download.js";
import { onRequestPost as webhook } from "../functions/api/cashfree-webhook.js";
import { makeDownloadUrl } from "../functions/_lib/commerce.js";
import { getProductById } from "../functions/_lib/products.js";

// In-memory stand-in for R2 (the private product bucket).
function makeBucket() {
  const store = new Map();
  return {
    store,
    async put(key, body, opts = {}) {
      const bytes = body instanceof Uint8Array ? body : new Uint8Array(await new Response(body).arrayBuffer());
      store.set(key, { bytes, contentType: opts.httpMetadata?.contentType || "application/octet-stream" });
      return { key };
    },
    async get(key) {
      const o = store.get(key);
      if (!o) return null;
      return { body: new Blob([o.bytes]).stream(), size: o.bytes.length, httpMetadata: { contentType: o.contentType }, httpEtag: '"e"' };
    },
    async delete(key) { store.delete(key); }
  };
}

const WH = "media-test-webhook-secret-0123456789abcdef";
const PID = "eboora-product";
const seeded = () => {
  const db = makeDb();
  db.settings.set("store_config", JSON.stringify({ productName: "Kit", headline: "H", description: "D", price: 499, email: "a@b.co", pixelId: "123456789012345" }));
  const bucket = makeBucket();
  const env = {
    ORDERS_DB: db, PRODUCTS_BUCKET: bucket, ADMIN_EMAIL: "owner@example.test", ADMIN_PASSWORD_HASH: TEST_ADMIN_HASH,
    SITE_URL: "https://shop.example.test", PRODUCT_ID: PID, PRODUCT_CURRENCY: "INR", CASHFREE_ENV: "sandbox",
    CASHFREE_APP_ID: "app", CASHFREE_SECRET_KEY: "secret", CASHFREE_WEBHOOK_SECRET: WH, CASHFREE_API_VERSION: "2026-01-01",
    DOWNLOAD_TOKEN_SECRET: "media-test-download-secret-at-least-32-chars", RESEND_API_KEY: "re_test",
    FROM_EMAIL: "Shop <d@example.test>", OWNER_EMAIL: "owner@example.test"
  };
  return { db, bucket, env };
};
const uploadReq = (kind, type, bytes, name = "guide.pdf", cookie = ADMIN_COOKIE, id = PID) => new Request(`https://shop.example.test/api/admin/upload?kind=${kind}&id=${id}`, {
  method: "POST", headers: { ...(cookie ? { Cookie: cookie } : {}), "Content-Type": type, "X-File-Name": encodeURIComponent(name) }, body: bytes
});
const deleteReq = (kind) => new Request(`https://shop.example.test/api/admin/upload?kind=${kind}&id=${PID}`, {
  method: "DELETE", headers: { Cookie: ADMIN_COOKIE, "Content-Type": "application/json" }, body: "{}"
});
const bytesOf = (text) => new TextEncoder().encode(text);

// Fake Cashfree and Meta. Records the Meta calls.
const metaCalls = [];
let cashfreePaid = true;
const nativeFetch = global.fetch;
global.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u === "https://api.resend.com/emails") return new Response(JSON.stringify({ id: "e" }), { status: 200, headers: { "Content-Type": "application/json" } });
  if (u.includes("graph.facebook.com")) { metaCalls.push(u); return new Response(JSON.stringify({ events_received: 1 }), { status: 200, headers: { "Content-Type": "application/json" } }); }
  if (u.includes("/pg/orders/")) return new Response(JSON.stringify({ order_status: cashfreePaid ? "PAID" : "ACTIVE", order_amount: 499, order_currency: "INR" }), { status: 200, headers: { "Content-Type": "application/json" } });
  throw new Error("Unexpected fetch " + u);
};

try {
  // 1. Upload needs the owner login; only allowed types and sizes get in
  {
    const { bucket, env } = seeded();
    assert.equal((await upload({ request: uploadReq("file", "application/pdf", bytesOf("x"), "guide.pdf", null), env })).status, 401);
    assert.equal((await upload({ request: uploadReq("file", "text/html", bytesOf("<script>"), "page.html"), env })).status, 415);
    assert.equal((await upload({ request: uploadReq("cover", "image/gif", bytesOf("GIF89a"), "cover.gif"), env })).status, 415);
    assert.equal((await upload({ request: uploadReq("cover", "image/png", new Uint8Array(3 * 1024 * 1024), "cover.png"), env })).status, 413);
    assert.equal((await upload({ request: uploadReq("cover", "image/png", new Uint8Array(0), "cover.png"), env })).status, 400);
    assert.equal((await upload({ request: uploadReq("cover", "image/png", bytesOf("x"), "cover.png", ADMIN_COOKIE, "no-such-product"), env })).status, 404);
    assert.equal(bucket.store.size, 0, "rejected uploads must not reach storage");
    console.log("Upload validation test passed.");
  }

  // 2. A product's cover shows on its own page; the product file is never public
  {
    const { env } = seeded();
    const png = bytesOf("\x89PNG-fake-cover");
    assert.equal((await upload({ request: uploadReq("cover", "image/png", png, "cover.png"), env })).status, 201);
    const page = await (await productDetail({ params: { slug: "kit" }, env })).json();
    assert.ok(page.coverImage.startsWith(`/api/media/product/${PID}?v=`), "the product page must use the uploaded cover");
    assert.ok(!("coverKey" in page) && !("fileKey" in page), "storage keys must not be public");
    const cover = await coverGet({ params: { id: PID }, env });
    assert.equal(cover.status, 200);
    assert.equal(cover.headers.get("Content-Type"), "image/png");
    assert.deepEqual(new Uint8Array(await cover.arrayBuffer()), png);
    console.log("Cover upload test passed.");
  }

  // 3. A paid buyer downloads the product's uploaded file; replacing removes the old copy; delete removes everything
  {
    const { db, bucket, env } = seeded();
    assert.equal((await upload({ request: uploadReq("file", "application/pdf", bytesOf("first version of the guide"), "My Guide.pdf"), env })).status, 201);
    const firstKey = (await getProductById(env, PID)).fileKey;
    assert.ok(firstKey.startsWith(`files/${PID}/`) && firstKey.endsWith(".pdf"));
    assert.equal((await getProductById(env, PID)).fileName, "My Guide.pdf");
    assert.equal((await upload({ request: uploadReq("file", "application/pdf", bytesOf("second version of the guide"), "My Guide v2.pdf"), env })).status, 201);
    assert.equal(bucket.store.has(firstKey), false, "the old file must be removed from storage");

    db.orders.set("ck_media_0001", { order_id: "ck_media_0001", product_id: PID, amount: 499, currency: "INR", customer_name: "Asha", customer_email: "asha@example.test", customer_phone: "9876543210", status: "PAID", email_status: "SENT", created_at: "2026-10-29 10:00:00", paid_at: "2026-10-29 10:01:00" });
    const link = new URL(await makeDownloadUrl(env, "ck_media_0001"));
    const got = await downloadFile({ request: new Request(link), env });
    assert.equal(got.status, 200);
    assert.equal(await got.text(), "second version of the guide");
    assert.match(got.headers.get("Content-Disposition"), /My Guide v2\.pdf/);

    cashfreePaid = false;
    assert.equal((await downloadFile({ request: new Request(link), env })).status, 403, "unpaid orders never get the file");
    cashfreePaid = true;

    assert.equal((await removeUpload({ request: deleteReq("file"), env })).status, 200);
    assert.equal(bucket.store.size, 0, "delete must remove the file from storage");
    assert.equal((await getProductById(env, PID)).fileKey, undefined);
    assert.equal((await downloadFile({ request: new Request(link), env })).status, 503, "no file means a clear error, not a broken download");
    console.log("Product file, replace and delete test passed.");
  }

  // 4. The Meta purchase event uses this product's pixel ID and the secret token
  {
    const { db, env } = seeded();
    db.orders.set("ck_meta_0001", { order_id: "ck_meta_0001", product_id: PID, amount: 499, currency: "INR", customer_name: "Asha", customer_email: "asha@example.test", customer_phone: "9876543210", status: "CREATED", email_status: "PENDING", meta_status: "PENDING", created_at: "2026-10-29 10:00:00", paid_at: null });
    env.META_CAPI_TOKEN = "meta-test-token";
    const raw = JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK", data: { order: { order_id: "ck_meta_0001", order_amount: 499, order_currency: "INR" }, payment: { payment_status: "SUCCESS", cf_payment_id: "pay_meta_0001", payment_amount: 499, payment_currency: "INR" }, customer_details: { customer_email: "asha@example.test", customer_phone: "9876543210" } } });
    const ts = String(Date.now());
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(WH), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ts + raw)))));
    metaCalls.length = 0;
    const res = await webhook({ request: new Request("https://shop.example.test/api/cashfree-webhook", { method: "POST", headers: { "x-webhook-timestamp": ts, "x-webhook-signature": sig }, body: raw }), env });
    assert.equal(res.status, 200);
    assert.equal(metaCalls.length, 1);
    assert.ok(metaCalls[0].includes("/123456789012345/events"), "Meta must receive this product's pixel ID");
    assert.ok(metaCalls[0].includes("access_token=meta-test-token"));
    assert.equal(db.orders.get("ck_meta_0001").meta_status, "SENT");
    console.log("Meta pixel and token test passed.");
  }
} finally {
  global.fetch = nativeFetch;
}

console.log("All media tests passed.");
