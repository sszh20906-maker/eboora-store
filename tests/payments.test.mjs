import assert from "node:assert/strict";
import { makeDb } from "./helpers/mockdb.mjs";
import { onRequestPost as webhook } from "../functions/api/cashfree-webhook.js";

const WH_SECRET = "payments-test-webhook-secret-value";
const ID = "ck_pay_test_0001";
const ID2 = "ck_pay_test_0002";

const makeEnv = (db) => ({
  ORDERS_DB: db, CASHFREE_WEBHOOK_SECRET: WH_SECRET, CASHFREE_SECRET_KEY: "api-secret",
  SITE_URL: "https://shop.example.test", DOWNLOAD_TOKEN_SECRET: "payments-test-download-secret-at-least-32-chars",
  RESEND_API_KEY: "re_test", FROM_EMAIL: "Shop <d@example.test>", OWNER_EMAIL: "owner@example.test",
  PRODUCT_NAME: "Kit", PRODUCT_ID: "eboora-product"
});

async function send(env, payload, overrideSignature) {
  const raw = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(WH_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(timestamp + raw));
  const signature = overrideSignature ?? btoa(String.fromCharCode(...new Uint8Array(mac)));
  return webhook({ request: new Request("https://shop.example.test/api/cashfree-webhook", { method: "POST", headers: { "x-webhook-timestamp": timestamp, "x-webhook-signature": signature }, body: raw }), env });
}

const failedEvent = (orderId) => ({ type: "PAYMENT_FAILED_WEBHOOK", data: { order: { order_id: orderId, order_amount: 499, order_currency: "INR" }, payment: { payment_status: "FAILED" } } });
const paidEvent = (orderId) => ({ type: "PAYMENT_SUCCESS_WEBHOOK", data: { order: { order_id: orderId, order_amount: 499, order_currency: "INR" }, payment: { payment_status: "SUCCESS", payment_amount: 499, payment_currency: "INR" }, customer_details: { customer_email: "asha@example.test", customer_phone: "9876543210" } } });

const seedOrder = (db, orderId) => db.orders.set(orderId, { order_id: orderId, product_id: "eboora-product", amount: 499, currency: "INR", customer_name: "Asha Buyer", customer_email: "asha@example.test", customer_phone: "9876543210", status: "CREATED", email_status: "PENDING", meta_status: "PENDING", created_at: "2026-10-29 10:00:00", paid_at: null });

const sent = [];
let failOwnerOnce = false;
const nativeFetch = global.fetch;
global.fetch = async (url, opts = {}) => {
  if (String(url) !== "https://api.resend.com/emails") throw new Error("Unexpected fetch " + url);
  const body = JSON.parse(opts.body);
  if (body.to[0] === "owner@example.test" && failOwnerOnce) {
    failOwnerOnce = false;
    return new Response("temporary failure", { status: 500 });
  }
  sent.push({ to: body.to[0], subject: body.subject });
  return new Response(JSON.stringify({ id: "email_test" }), { status: 200, headers: { "Content-Type": "application/json" } });
};

try {
  // Failed payment is recorded
  {
    const db = makeDb(); seedOrder(db, ID); const env = makeEnv(db);
    assert.equal((await send(env, failedEvent(ID))).status, 200);
    assert.equal(db.orders.get(ID).status, "FAILED");
    assert.equal(sent.length, 0, "a failed payment must not send any email");
    console.log("Failed payment is recorded test passed.");
  }

  // Successful payment: buyer and owner each get exactly one email, duplicates send nothing new
  {
    sent.length = 0;
    const db = makeDb(); seedOrder(db, ID); const env = makeEnv(db);
    assert.equal((await send(env, failedEvent(ID))).status, 200);
    assert.equal((await send(env, paidEvent(ID))).status, 200);
    assert.equal(db.orders.get(ID).status, "PAID");
    assert.equal(sent.filter((m) => m.to === "owner@example.test").length, 1);
    assert.equal(sent.filter((m) => m.to === "asha@example.test").length, 1);
    assert.ok(sent.find((m) => m.to === "owner@example.test").subject.startsWith("New sale: Kit"));

    assert.equal((await send(env, paidEvent(ID))).status, 200);
    assert.equal(sent.length, 2, "duplicate success webhook must not send emails again");

    // A late failure event never downgrades a paid order
    assert.equal((await send(env, failedEvent(ID))).status, 200);
    assert.equal(db.orders.get(ID).status, "PAID");
    console.log("Paid, duplicate and late-failure webhook tests passed.");
  }

  // Owner alert fails once: webhook asks for a retry, and the retry sends the alert exactly once
  {
    sent.length = 0;
    const db = makeDb(); seedOrder(db, ID2); const env = makeEnv(db);
    failOwnerOnce = true;
    assert.equal((await send(env, paidEvent(ID2))).status, 500);
    assert.equal(db.orders.get(ID2).status, "PAID");
    assert.equal(sent.filter((m) => m.to === "owner@example.test").length, 0);
    assert.equal((await send(env, paidEvent(ID2))).status, 200);
    assert.equal(sent.filter((m) => m.to === "owner@example.test").length, 1);
    assert.equal(sent.filter((m) => m.to === "asha@example.test").length, 1, "buyer email must not be duplicated on retry");
    console.log("Owner alert retry test passed.");
  }

  // Forged signature is rejected
  {
    const db = makeDb(); seedOrder(db, ID); const env = makeEnv(db);
    assert.equal((await send(env, paidEvent(ID), "AAAA")).status, 401);
    assert.equal(db.orders.get(ID).status, "CREATED");
    console.log("Forged webhook rejected test passed.");
  }
} finally {
  global.fetch = nativeFetch;
}

console.log("All payment tests passed.");
