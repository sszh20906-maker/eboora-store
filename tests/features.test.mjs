import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { makeDb } from "./helpers/mockdb.mjs";
import { discountFor, quoteCoupon, redeemCoupon } from "../functions/_lib/coupons.js";
import { onRequestPost as createOrder } from "../functions/api/create-order.js";
import { onRequestGet as couponCheck } from "../functions/api/coupon.js";
import { onRequestPost as resendLink } from "../functions/api/resend-link.js";
import { onRequestPost as recordRefund } from "../functions/api/admin/refunds.js";
import { onRequestGet as listCoupons, onRequestPost as saveCoupon } from "../functions/api/admin/coupons.js";
import { onRequestPost as webhook } from "../functions/api/cashfree-webhook.js";

const ADMIN_KEY = "features-test-admin-key-0123456789abcdef0123456";
const WH = "features-test-webhook-secret-0123456789";
const makeEnv = (db, extra = {}) => ({
  ORDERS_DB: db, ADMIN_KEY, CASHFREE_ENV: "sandbox", CASHFREE_APP_ID: "app", CASHFREE_SECRET_KEY: "secret",
  CASHFREE_WEBHOOK_SECRET: WH, CASHFREE_API_VERSION: "2026-01-01", SITE_URL: "https://shop.example.test",
  PRODUCT_PRICE_INR: "499", PRODUCT_NAME: "Kit", PRODUCT_ID: "eboora-product", PRODUCT_CURRENCY: "INR",
  DOWNLOAD_TOKEN_SECRET: "features-test-download-secret-at-least-32-chars", RESEND_API_KEY: "re_test",
  FROM_EMAIL: "Shop <d@example.test>", OWNER_EMAIL: "owner@example.test", ...extra
});
const adminReq = (path, method = "GET", body) => new Request("https://shop.example.test" + path, {
  method, headers: { Authorization: "Bearer " + ADMIN_KEY, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined
});
const ip = (value) => ({ "CF-Connecting-IP": value });

// Fake Cashfree and Resend. Records every email sent.
const emails = [];
let cashfreeCalls = 0;
const nativeFetch = global.fetch;
global.fetch = async (url, opts = {}) => {
  if (String(url) === "https://api.resend.com/emails") {
    const body = JSON.parse(opts.body);
    emails.push({ to: body.to[0], subject: body.subject, html: body.html });
    return new Response(JSON.stringify({ id: "e" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (String(url).endsWith("/pg/orders") && opts.method === "POST") {
    cashfreeCalls += 1;
    const body = JSON.parse(opts.body);
    return new Response(JSON.stringify({ order_id: body.order_id, payment_session_id: "session_test", order_amount: body.order_amount }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  throw new Error("Unexpected fetch " + url);
};

async function sendWebhook(env, payload) {
  const raw = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(WH), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(timestamp + raw));
  const signature = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return webhook({ request: new Request("https://shop.example.test/api/cashfree-webhook", { method: "POST", headers: { "x-webhook-timestamp": timestamp, "x-webhook-signature": signature }, body: raw }), env });
}

try {
  // 1. Discount maths
  assert.equal(discountFor({ type: "percent", value: 10 }, 499), 49.9);
  assert.equal(discountFor({ type: "fixed", value: 100 }, 499), 100);
  assert.equal(discountFor({ type: "fixed", value: 1000 }, 499), 498, "a coupon never takes the price below Rs 1");
  console.log("Discount maths test passed.");

  // 2. Coupon validity rules
  {
    const db = makeDb();
    db.coupons.set("LAUNCH10", { code: "LAUNCH10", type: "percent", value: 10, max_uses: null, used_count: 0, expires_at: null, active: 1 });
    db.coupons.set("OLD", { code: "OLD", type: "percent", value: 10, max_uses: null, used_count: 0, expires_at: "2020-01-01", active: 1 });
    db.coupons.set("FULL", { code: "FULL", type: "fixed", value: 50, max_uses: 2, used_count: 2, expires_at: null, active: 1 });
    db.coupons.set("OFF", { code: "OFF", type: "fixed", value: 50, max_uses: null, used_count: 0, expires_at: null, active: 0 });
    const env = makeEnv(db);
    const good = await quoteCoupon(env, "launch10", 499);
    assert.equal(good.valid, true);
    assert.equal(good.finalPrice, 449.1);
    for (const code of ["OLD", "FULL", "OFF", "NOPE", "bad code!"]) {
      assert.equal((await quoteCoupon(env, code, 499)).valid, false, code + " should be refused");
    }
    console.log("Coupon validity test passed.");
  }

  // 3. Public coupon check endpoint
  {
    const db = makeDb();
    db.coupons.set("LAUNCH10", { code: "LAUNCH10", type: "percent", value: 10, max_uses: null, used_count: 0, expires_at: null, active: 1 });
    const env = makeEnv(db);
    const ok = await (await couponCheck({ request: new Request("https://shop.example.test/api/coupon?code=launch10", { headers: ip("203.0.113.80") }), env })).json();
    assert.equal(ok.valid, true);
    assert.equal(ok.finalPrice, 449.1);
    assert.equal(ok.price, 499);
    const bad = await (await couponCheck({ request: new Request("https://shop.example.test/api/coupon?code=NOPE", { headers: ip("203.0.113.80") }), env })).json();
    assert.equal(bad.valid, false);
    console.log("Coupon check endpoint test passed.");
  }

  // 4. Checkout with a coupon: the discounted price is charged, and the code is counted only once the payment is confirmed
  {
    const db = makeDb();
    db.coupons.set("LAUNCH10", { code: "LAUNCH10", type: "percent", value: 10, max_uses: 5, used_count: 0, expires_at: null, active: 1 });
    const env = makeEnv(db);
    cashfreeCalls = 0;
    const res = await createOrder({ request: new Request("https://shop.example.test/api/create-order", {
      method: "POST", headers: { Origin: "https://shop.example.test", "Content-Type": "application/json", ...ip("203.0.113.90") },
      body: JSON.stringify({ customer_name: "Asha Buyer", customer_email: "asha@example.test", customer_phone: "9876543210", coupon_code: "launch10" })
    }), env });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.amount, 449.1);
    assert.equal(data.original_amount, 499);
    assert.equal(db.orders.get(data.order_id).amount, 449.1);
    assert.equal(db.orderDiscounts.get(data.order_id).code, "LAUNCH10");
    assert.equal(db.coupons.get("LAUNCH10").used_count, 0, "not counted before payment");

    const paid = { type: "PAYMENT_SUCCESS_WEBHOOK", data: { order: { order_id: data.order_id, order_amount: 449.1, order_currency: "INR" }, payment: { payment_status: "SUCCESS", payment_amount: 449.1, payment_currency: "INR" }, customer_details: { customer_email: "asha@example.test", customer_phone: "9876543210" } } };
    assert.equal((await sendWebhook(env, paid)).status, 200);
    assert.equal((await sendWebhook(env, paid)).status, 200);
    assert.equal(db.coupons.get("LAUNCH10").used_count, 1, "counted once, even with a duplicate webhook");
    console.log("Checkout with coupon test passed.");
  }

  // 5. Bad coupon at checkout is refused before Cashfree is contacted
  {
    const db = makeDb();
    const env = makeEnv(db);
    cashfreeCalls = 0;
    const res = await createOrder({ request: new Request("https://shop.example.test/api/create-order", {
      method: "POST", headers: { Origin: "https://shop.example.test", "Content-Type": "application/json", ...ip("203.0.113.91") },
      body: JSON.stringify({ customer_name: "Asha Buyer", customer_email: "asha@example.test", customer_phone: "9876543211", coupon_code: "NOPE" })
    }), env });
    assert.equal(res.status, 400);
    assert.equal(cashfreeCalls, 0);
    console.log("Bad coupon at checkout test passed.");
  }

  // 6. Resend download links: one answer for everyone, email only when a paid order exists, rate limited
  {
    const db = makeDb();
    db.orders.set("ck_paid_resend_0001", { order_id: "ck_paid_resend_0001", product_id: "eboora-product", amount: 499, currency: "INR", customer_name: "Asha", customer_email: "asha@example.test", customer_phone: "9876543210", status: "PAID", email_status: "SENT", created_at: "2026-10-29 10:00:00", paid_at: "2026-10-29 10:01:00" });
    const env = makeEnv(db);
    const before = emails.length;
    const unknown = await (await resendLink({ request: new Request("https://shop.example.test/api/resend-link", { method: "POST", headers: ip("203.0.113.100"), body: JSON.stringify({ email: "nobody@example.test" }) }), env })).json();
    assert.equal(unknown.ok, true);
    assert.equal(emails.length, before, "no email for an address with no paid order");

    const known = await (await resendLink({ request: new Request("https://shop.example.test/api/resend-link", { method: "POST", headers: ip("203.0.113.101"), body: JSON.stringify({ email: "Asha@example.test" }) }), env })).json();
    assert.equal(known.ok, true, "same answer as the unknown address");
    assert.equal(emails.length, before + 1);
    assert.ok(emails[emails.length - 1].html.includes("/api/download?order_id=ck_paid_resend_0001"));

    const statuses = [];
    for (let i = 0; i < 3; i++) statuses.push((await resendLink({ request: new Request("https://shop.example.test/api/resend-link", { method: "POST", headers: ip("203.0.113.102"), body: JSON.stringify({ email: "asha@example.test" }) }), env })).status);
    // 3 requests per address per hour: the first request above already counted, so the third of these is refused
    assert.deepEqual(statuses, [200, 200, 429]);
    assert.equal((await resendLink({ request: new Request("https://shop.example.test/api/resend-link", { method: "POST", headers: ip("203.0.113.103"), body: JSON.stringify({ email: "asha@example.test" }) }), env })).status, 429);

    assert.equal((await resendLink({ request: new Request("https://shop.example.test/api/resend-link", { method: "POST", headers: ip("203.0.113.104"), body: JSON.stringify({ email: "not-an-email" }) }), env })).status, 400);
    console.log("Resend download link test passed.");
  }

  // 7. Refund records: only paid orders, never more than was paid, admin only
  {
    const db = makeDb();
    db.orders.set("ck_refund_0001", { order_id: "ck_refund_0001", product_id: "eboora-product", amount: 499, currency: "INR", customer_name: "Asha", customer_email: "asha@example.test", customer_phone: "9876543210", status: "PAID", email_status: "SENT", created_at: "2026-10-29 10:00:00", paid_at: "2026-10-29 10:01:00" });
    db.orders.set("ck_unpaid_0001", { order_id: "ck_unpaid_0001", product_id: "eboora-product", amount: 499, currency: "INR", customer_name: "Ravi", customer_email: "ravi@example.test", customer_phone: "9123456789", status: "CREATED", email_status: "PENDING", created_at: "2026-10-29 10:00:00", paid_at: null });
    const env = makeEnv(db);
    const post = (body, auth = true) => recordRefund({ request: new Request("https://shop.example.test/api/admin/refunds", { method: "POST", headers: auth ? { Authorization: "Bearer " + ADMIN_KEY, "Content-Type": "application/json" } : { "Content-Type": "application/json" }, body: JSON.stringify(body) }), env });
    assert.equal((await post({ order_id: "ck_refund_0001", amount: 100 }, false)).status, 401);
    assert.equal((await post({ order_id: "ck_unpaid_0001", amount: 100 })).status, 400);
    assert.equal((await post({ order_id: "ck_refund_0001", amount: 600 })).status, 400);
    assert.equal((await post({ order_id: "ck_refund_0001", amount: 100, note: "customer request" })).status, 201);
    assert.equal((await post({ order_id: "ck_refund_0001", amount: 399 })).status, 201);
    assert.equal((await post({ order_id: "ck_refund_0001", amount: 1 })).status, 400, "cannot refund more than paid in total");
    assert.equal(db.refunds.length, 2);
    console.log("Refund record test passed.");
  }

  // 8. Owner coupon management: auth, validation, save, list
  {
    const db = makeDb();
    const env = makeEnv(db);
    const noAuth = await saveCoupon({ request: new Request("https://shop.example.test/api/admin/coupons", { method: "POST", body: "{}" }), env });
    assert.equal(noAuth.status, 401);
    const badType = await saveCoupon({ request: adminReq("/api/admin/coupons", "POST", { code: "LAUNCH20", type: "bogus", value: 20 }), env });
    assert.equal(badType.status, 400);
    const badCode = await saveCoupon({ request: adminReq("/api/admin/coupons", "POST", { code: "x", type: "percent", value: 20 }), env });
    assert.equal(badCode.status, 400);
    const ok = await saveCoupon({ request: adminReq("/api/admin/coupons", "POST", { code: "launch20", type: "percent", value: 20, max_uses: "50", expires_at: "2099-12-31", active: true }), env });
    assert.equal(ok.status, 200);
    assert.equal(db.coupons.get("LAUNCH20").max_uses, 50);
    const list = await (await listCoupons({ request: adminReq("/api/admin/coupons"), env })).json();
    assert.equal(list.coupons.length, 1);
    assert.equal(list.coupons[0].code, "LAUNCH20");
    console.log("Owner coupon management test passed.");
  }

  // 9. Redeeming a coupon directly is idempotent per order
  {
    const db = makeDb();
    db.coupons.set("ONCE", { code: "ONCE", type: "fixed", value: 50, max_uses: null, used_count: 0, expires_at: null, active: 1 });
    db.orderDiscounts.set("ck_once_0001", { order_id: "ck_once_0001", code: "ONCE", original_amount: 499, discount_amount: 50 });
    const env = makeEnv(db);
    await redeemCoupon(env, "ck_once_0001");
    await redeemCoupon(env, "ck_once_0001");
    assert.equal(db.coupons.get("ONCE").used_count, 1);
    console.log("Coupon redemption idempotency test passed.");
  }
} finally {
  global.fetch = nativeFetch;
}

// 10. SEO files and resend page exist and point at the right places
const pub = new URL("../public/", import.meta.url).pathname;
assert.ok(existsSync(pub + "robots.txt") && existsSync(pub + "sitemap.xml"));
const robots = readFileSync(pub + "robots.txt", "utf8");
assert.ok(robots.includes("Disallow: /api/") && robots.includes("Disallow: /admin.html") && robots.includes("Sitemap:"));
assert.ok(readFileSync(pub + "sitemap.xml", "utf8").includes("<urlset"));
console.log("SEO files test passed.");

console.log("All feature tests passed.");
