import assert from "node:assert/strict";
import { onRequestGet as getConfig } from "../functions/api/config.js";
import { onRequestGet as adminGetConfig, onRequestPut as adminPutConfig } from "../functions/api/admin/config.js";
import { onRequestGet as adminOrders } from "../functions/api/admin/orders.js";
import { onRequestPost as createOrder } from "../functions/api/create-order.js";
import { requireAdmin } from "../functions/_lib/admin.js";
import { validateConfig } from "../functions/_lib/settings.js";
import { makeDb } from "./helpers/mockdb.mjs";

const ADMIN_KEY = "test-admin-key-with-more-than-32-characters-0001";
const makeEnv = (db, extra = {}) => ({
  ORDERS_DB: db, ADMIN_KEY, PRODUCT_ID: "eboora-product", PRODUCT_PRICE_INR: "499", PRODUCT_NAME: "Env Name",
  PRODUCT_CURRENCY: "INR", CASHFREE_ENV: "sandbox", CASHFREE_APP_ID: "app", CASHFREE_SECRET_KEY: "secret",
  CASHFREE_API_VERSION: "2026-01-01", SITE_URL: "https://shop.example.test", ...extra
});
const adminRequest = (path, method = "GET", body) => new Request("https://shop.example.test" + path, {
  method, headers: { Authorization: "Bearer " + ADMIN_KEY, "Content-Type": "application/json" },
  body: body ? JSON.stringify(body) : undefined
});

// 1. Admin key guard
{
  const db = makeDb();
  const unconfigured = await requireAdmin(new Request("https://x/api/admin/config"), { ...makeEnv(db), ADMIN_KEY: "" });
  assert.equal(unconfigured.status, 503);
  const wrong = await requireAdmin(new Request("https://x/api/admin/config", { headers: { Authorization: "Bearer nope" } }), makeEnv(db));
  assert.equal(wrong.status, 401);
  const ok = await requireAdmin(new Request("https://x/api/admin/config", { headers: { Authorization: "Bearer " + ADMIN_KEY } }), makeEnv(db));
  assert.equal(ok, null);
  console.log("Admin key guard tests passed.");
}

// 2. Server-side validation of settings
{
  const bad = validateConfig({ productName: "", price: 0, email: "bad" });
  assert.ok(bad.errors.length >= 3);
  assert.equal(bad.config, null);

  const good = validateConfig({ productName: "Creator Kit", headline: "Fast results", description: "Kit details", price: "799", mrp: "999", email: "Sameer@Example.com", whatsapp: "+91 98765 43210", benefits: [{ title: "Fast", description: "quick" }], faqs: [{ question: "Q", answer: "A" }] });
  assert.deepEqual(good.errors, []);
  assert.equal(good.config.price, 799);
  assert.equal(good.config.email, "sameer@example.com");
  assert.equal(good.config.whatsapp, "919876543210");

  const badMrp = validateConfig({ productName: "X", headline: "H", description: "D", price: 500, mrp: 300, email: "a@b.co" });
  assert.ok(badMrp.errors.some((e) => e.includes("Original price")));
  console.log("Settings validation tests passed.");
}

// 3. Settings endpoints: auth, validation, save, public read
{
  const db = makeDb();
  const env = makeEnv(db);
  const before = await getConfig({ env });
  assert.equal(before.status, 404);

  const unauth = await adminPutConfig({ request: new Request("https://shop.example.test/api/admin/config", { method: "PUT", body: "{}" }), env });
  assert.equal(unauth.status, 401);

  const invalid = await adminPutConfig({ request: adminRequest("/api/admin/config", "PUT", { productName: "" }), env });
  assert.equal(invalid.status, 400);

  const saved = await adminPutConfig({ request: adminRequest("/api/admin/config", "PUT", { productName: "Creator Kit", headline: "Fast results", description: "Kit details", price: 799, email: "support@example.test" }), env });
  assert.equal(saved.status, 200);

  const publicAfter = await getConfig({ env });
  assert.equal(publicAfter.status, 200);
  const pub = await publicAfter.json();
  assert.equal(pub.productName, "Creator Kit");
  assert.equal(pub.price, 799);
  assert.equal(pub.productId, "eboora-product");

  const adminRead = await adminGetConfig({ request: adminRequest("/api/admin/config"), env });
  assert.equal(adminRead.status, 200);
  assert.equal((await adminRead.json()).config.productName, "Creator Kit");
  console.log("Settings endpoint tests passed.");
}

// 4. Checkout uses the owner-saved price, not the browser or the old variable
{
  const db = makeDb();
  const env = makeEnv(db);
  await adminPutConfig({ request: adminRequest("/api/admin/config", "PUT", { productName: "Creator Kit", headline: "H", description: "D", price: 799, email: "support@example.test" }), env });

  const nativeFetch = global.fetch;
  let sentAmount = null;
  global.fetch = async (url, opts = {}) => {
    if (String(url).endsWith("/pg/orders") && opts.method === "POST") {
      const body = JSON.parse(opts.body);
      sentAmount = body.order_amount;
      return new Response(JSON.stringify({ order_id: body.order_id, payment_session_id: "session_test" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    throw new Error("Unexpected fetch " + url);
  };
  try {
    const res = await createOrder({
      request: new Request("https://shop.example.test/api/create-order", {
        method: "POST",
        headers: { Origin: "https://shop.example.test", "Content-Type": "application/json" },
        body: JSON.stringify({ customer_name: "Test Buyer", customer_email: "buyer@example.test", customer_phone: "9876543210" })
      }),
      env
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.amount, 799);
    assert.equal(sentAmount, 799);
    assert.equal(db.orders.get(data.order_id).amount, 799);
  } finally {
    global.fetch = nativeFetch;
  }
  console.log("Checkout uses saved price test passed.");
}

// 5. Orders list: auth and summary
{
  const db = makeDb();
  const env = makeEnv(db);
  db.orders.set("ck_open_0001", { order_id: "ck_open_0001", amount: 799, currency: "INR", customer_name: "Asha", customer_email: "asha@example.test", customer_phone: "9876543210", status: "CREATED", email_status: "PENDING", created_at: "2026-10-29 10:00:00", paid_at: null });
  db.orders.set("ck_paid_0002", { order_id: "ck_paid_0002", amount: 799, currency: "INR", customer_name: "Ravi", customer_email: "ravi@example.test", customer_phone: "9123456789", status: "PAID", email_status: "SENT", created_at: "2026-10-29 11:00:00", paid_at: "2026-10-29 11:02:00" });

  const unauth = await adminOrders({ request: new Request("https://shop.example.test/api/admin/orders"), env });
  assert.equal(unauth.status, 401);

  const res = await adminOrders({ request: adminRequest("/api/admin/orders?status=ALL"), env });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.summary.CREATED.count, 1);
  assert.equal(data.summary.PAID.total, 799);
  assert.equal(data.orders.length, 2);

  const badFilter = await adminOrders({ request: adminRequest("/api/admin/orders?status=DROP"), env });
  assert.equal(badFilter.status, 400);
  console.log("Orders endpoint tests passed.");
}

console.log("All admin tests passed.");
