import assert from "node:assert/strict";
import { makeDb, ADMIN_COOKIE, TEST_ADMIN_HASH } from "./helpers/mockdb.mjs";
import { onRequestGet as listAdmin, onRequestPost as saveAdmin, onRequestDelete as deleteAdmin } from "../functions/api/admin/products.js";
import { onRequestGet as catalog } from "../functions/api/catalog.js";
import { onRequestGet as productDetail } from "../functions/api/products/[slug].js";

const envFor = (db) => ({ ORDERS_DB: db, ADMIN_EMAIL: "owner@example.test", ADMIN_PASSWORD_HASH: TEST_ADMIN_HASH, PRODUCT_ID: "eboora-product" });
const req = (path, method = "GET", body, cookie = ADMIN_COOKIE) => new Request("https://shop.example.test" + path, {
  method, headers: { ...(cookie ? { Cookie: cookie } : {}), "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined
});
const good = (extra = {}) => ({ productName: "Creator Kit", headline: "Fast results", description: "What is inside", price: 499, email: "support@example.test", ...extra });

// 1. The owner creates several products, each with its own link
{
  const db = makeDb(); const env = envFor(db);
  assert.equal((await saveAdmin({ request: req("/api/admin/products", "POST", good({ slug: "creator-kit" })), env })).status, 201);
  assert.equal((await saveAdmin({ request: req("/api/admin/products", "POST", good({ productName: "Caption Pack", slug: "caption-pack", price: 149 })), env })).status, 201);
  const list = await (await listAdmin({ request: req("/api/admin/products"), env })).json();
  assert.equal(list.products.length, 2);
  assert.equal((await saveAdmin({ request: req("/api/admin/products", "POST", good({ productName: "Other", slug: "creator-kit" })), env })).status, 409, "two products cannot share a link");
  assert.equal((await saveAdmin({ request: req("/api/admin/products", "POST", good({ slug: "ab" })), env })).status, 400, "links shorter than 3 characters are refused");
  assert.equal((await saveAdmin({ request: req("/api/admin/products", "POST", good({ slug: "creator-kit" }), null), env })).status, 401, "no login, no product changes");
  console.log("Multiple products with their own links test passed.");
}

// 2. The store lists only live products; each product opens by its own link; drafts stay hidden
{
  const db = makeDb(); const env = envFor(db);
  await saveAdmin({ request: req("/api/admin/products", "POST", good({ slug: "creator-kit" })), env });
  await saveAdmin({ request: req("/api/admin/products", "POST", good({ productName: "Caption Pack", slug: "caption-pack", price: 149, status: "draft" })), env });
  const cat = await (await catalog({ env })).json();
  assert.deepEqual(cat.products.map((p) => p.slug), ["creator-kit"]);
  const page = await productDetail({ params: { slug: "creator-kit" }, env });
  assert.equal(page.status, 200);
  assert.equal((await page.json()).price, 499);
  assert.equal((await productDetail({ params: { slug: "caption-pack" }, env })).status, 404, "draft products are not public");
  assert.equal((await productDetail({ params: { slug: "nope" }, env })).status, 404);
  console.log("Store listing and product pages test passed.");
}

// 3. Products with orders are hidden, not deleted; unused products are removed
{
  const db = makeDb(); const env = envFor(db);
  const a = (await (await saveAdmin({ request: req("/api/admin/products", "POST", good({ slug: "creator-kit" })), env })).json()).product;
  const b = (await (await saveAdmin({ request: req("/api/admin/products", "POST", good({ productName: "Caption Pack", slug: "caption-pack" })), env })).json()).product;
  db.orders.set("ck_p_0001", { order_id: "ck_p_0001", product_id: a.id, amount: 499, currency: "INR", customer_name: "Asha", customer_email: "asha@example.test", customer_phone: "9876543210", status: "PAID", email_status: "SENT", created_at: "2026-10-29 10:00:00", paid_at: null });
  const archived = await (await deleteAdmin({ request: req(`/api/admin/products?id=${a.id}`, "DELETE", {}), env })).json();
  assert.equal(archived.archived, true);
  assert.deepEqual((await (await catalog({ env })).json()).products.map((p) => p.slug), ["caption-pack"]);
  const gone = await (await deleteAdmin({ request: req(`/api/admin/products?id=${b.id}`, "DELETE", {}), env })).json();
  assert.equal(gone.archived, false);
  assert.equal(db.products.has(b.id), false);
  console.log("Delete and archive test passed.");
}

console.log("All product tests passed.");
