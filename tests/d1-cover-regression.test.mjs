import assert from 'node:assert/strict';
import { coverUrl, publicProduct } from '../functions/_lib/products.js';
import { onRequestGet } from '../functions/api/media/product/[id].js';
const product = { id: 'p-cover', slug: 'test-cover', status: 'published', data: '', coverStorage: 'd1', coverType: 'image/png', updated_at: 'today' };
assert.match(coverUrl(product), /\/api\/media\/product\/p-cover/);
assert.equal(publicProduct(product).coverStorage, undefined);
const png = 'iVBORw0KGgo=';
const env = { ORDERS_DB: { prepare(sql) { return { bind(...args) { return { async first() {
  if (sql.includes('FROM products')) return args[0] === 'p-cover' ? { ...product, data: JSON.stringify({coverStorage:'d1',coverType:'image/png'}) } : null;
  if (sql.includes('FROM store_settings')) return { value: JSON.stringify({type:'image/png',base64:png}) };
  return null;
} }; } }; } } };
const response = await onRequestGet({ params: {id:'p-cover'}, env });
assert.equal(response.status, 200);
assert.equal(response.headers.get('Content-Type'), 'image/png');
assert.equal((await response.arrayBuffer()).byteLength, 8);
console.log('D1 cover delivery regression passed.');
