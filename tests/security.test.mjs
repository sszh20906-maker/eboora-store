import assert from "node:assert/strict";
import { makeDb, ADMIN_COOKIE, TEST_ADMIN_HASH } from "./helpers/mockdb.mjs";
import { onRequestPost as login } from "../functions/api/admin/login.js";
import { makePasswordHash } from "../functions/_lib/auth.js";
import { onRequestGet as adminOrders } from "../functions/api/admin/orders.js";
import { onRequestPost as createOrder } from "../functions/api/create-order.js";
import { onRequestGet as downloadFile } from "../functions/api/download.js";
import { makeDownloadUrl, makeDownloadToken } from "../functions/_lib/commerce.js";

const baseEnv = (db, extra = {}) => ({
  ORDERS_DB: db, ADMIN_EMAIL: "owner@example.test", ADMIN_PASSWORD_HASH: TEST_ADMIN_HASH, PRODUCT_ID: "eboora-product", PRODUCT_PRICE_INR: "499", PRODUCT_NAME: "Kit",
  PRODUCT_CURRENCY: "INR", CASHFREE_ENV: "sandbox", CASHFREE_APP_ID: "app", CASHFREE_SECRET_KEY: "secret",
  CASHFREE_API_VERSION: "2026-01-01", SITE_URL: "https://shop.example.test",
  DOWNLOAD_TOKEN_SECRET: "security-test-download-secret-at-least-32-chars",
  PRODUCT_FILE_KEY: "kit.zip", PRODUCT_FILENAME: "kit.zip",
  PRODUCTS_BUCKET: { async get() { return { body: new Blob(["file-bytes"]).stream(), size: 10, httpMetadata: { contentType: "application/zip" }, httpEtag: "e" }; } },
  ...extra
});
const withIp = (ip, headers = {}) => ({ "CF-Connecting-IP": ip, ...headers });
const fakeCashfree = (order) => async (url, opts = {}) => {
  if (String(url).endsWith("/pg/orders") && opts.method === "POST") {
    const body = JSON.parse(opts.body);
    return new Response(JSON.stringify({ order_id: body.order_id, payment_session_id: "session_test" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (String(url).includes("/pg/orders/")) return new Response(JSON.stringify(order), { status: 200, headers: { "Content-Type": "application/json" } });
  throw new Error("Unexpected fetch " + url);
};

// 1. Login brute force: 10 wrong passwords per IP, then even the right one is refused for 15 minutes
{
  const db = makeDb();
  const env = baseEnv(db, { ADMIN_PASSWORD_HASH: await makePasswordHash("the-real-password-123") });
  const attempt = (password, ip) => login({
    request: new Request("https://shop.example.test/api/admin/login", { method: "POST", headers: withIp(ip, { "Content-Type": "application/json" }), body: JSON.stringify({ email: "owner@example.test", password }) }),
    env
  });
  for (let i = 0; i < 10; i++) assert.equal((await attempt("wrong-" + i, "203.0.113.7")).status, 401);
  assert.equal((await attempt("the-real-password-123", "203.0.113.7")).status, 429);
  assert.equal((await attempt("the-real-password-123", "198.51.100.9")).status, 200);
  console.log("Login brute-force lockout test passed.");
}

// 2. Checkout limits: 30 orders per 10 minutes per IP (shared networks are fine), 5 per phone number
{
  const nativeFetch = global.fetch;
  global.fetch = fakeCashfree({});
  try {
    const env = baseEnv(makeDb());
    const make = (phone, ip = "203.0.113.50") => new Request("https://shop.example.test/api/create-order", {
      method: "POST",
      headers: withIp(ip, { Origin: "https://shop.example.test", "Content-Type": "application/json" }),
      body: JSON.stringify({ customer_name: "Buyer Test", customer_email: "buyer@example.test", customer_phone: phone })
    });
    // many different buyers behind one IP are allowed
    for (let i = 0; i < 30; i++) assert.equal((await createOrder({ request: make("9" + String(100000000 + i)), env })).status, 201);
    assert.equal((await createOrder({ request: make("9100000031"), env })).status, 429);

    // one phone number hammering from many IPs is still stopped
    for (let i = 0; i < 5; i++) assert.equal((await createOrder({ request: make("9123456789", "198.51.100." + (i + 10)), env })).status, 201);
    assert.equal((await createOrder({ request: make("9123456789", "198.51.100.99"), env })).status, 429);
  } finally { global.fetch = nativeFetch; }
  console.log("Checkout rate limit test passed.");
}

// 3. Malicious email characters are rejected before anything is stored
{
  const db = makeDb();
  const res = await createOrder({
    request: new Request("https://shop.example.test/api/create-order", {
      method: "POST",
      headers: withIp("203.0.113.60", { Origin: "https://shop.example.test", "Content-Type": "application/json" }),
      body: JSON.stringify({ customer_name: "Buyer Test", customer_email: "evil?subject=x@example.test", customer_phone: "9876543210" })
    }),
    env: baseEnv(db)
  });
  assert.equal(res.status, 400);
  assert.equal(db.orders.size, 0);
  console.log("Email validation test passed.");
}

// 4. Download links: valid works, expired is refused, tampered expiry is refused
{
  const db = makeDb();
  db.orders.set("ck_paid_dl_0001", { order_id: "ck_paid_dl_0001", product_id: "eboora-product", amount: 499, currency: "INR", customer_name: "Buyer", customer_email: "b@example.test", customer_phone: "9876543210", status: "PAID", email_status: "SENT", created_at: "2026-10-29 10:00:00", paid_at: "2026-10-29 10:01:00" });
  const env = baseEnv(db);
  const nativeFetch = global.fetch;
  global.fetch = fakeCashfree({ order_status: "PAID", order_amount: 499, order_currency: "INR" });
  try {
    const good = new URL(await makeDownloadUrl(env, "ck_paid_dl_0001"));
    const ok = await downloadFile({ request: new Request(good), env });
    assert.equal(ok.status, 200);
    assert.equal(await ok.text(), "file-bytes");

    const pastExp = Math.floor(Date.now() / 1000) - 10;
    const expired = new URL(good.href);
    expired.searchParams.set("exp", String(pastExp));
    expired.searchParams.set("token", await makeDownloadToken(env, "ck_paid_dl_0001", pastExp));
    assert.equal((await downloadFile({ request: new Request(expired), env })).status, 410);

    const tampered = new URL(good.href);
    tampered.searchParams.set("exp", String(Math.floor(Date.now() / 1000) + 999999));
    assert.equal((await downloadFile({ request: new Request(tampered), env })).status, 403);
  } finally { global.fetch = nativeFetch; }
  console.log("Download expiry and tamper tests passed.");
}

console.log("All security tests passed.");
