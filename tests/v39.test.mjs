import assert from "node:assert/strict";
import { onRequestPost as webhook } from "../functions/api/cashfree-webhook.js";

const env = { CASHFREE_WEBHOOK_SECRET: "v39-test-webhook-secret-0123456789abcdef" };
const post = (headers, body = "{}") => webhook({ request: new Request("https://shop.example.test/api/cashfree-webhook", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body }), env });

// Cashfree's endpoint test: no signature -> 200, nothing processed
const unsigned = await post({});
assert.equal(unsigned.status, 200);
// A request that carries a signature but fails it -> still refused
const forged = await post({ "x-webhook-timestamp": String(Date.now()), "x-webhook-signature": "AAAA" });
assert.equal(forged.status, 401);
console.log("Webhook endpoint test (unsigned 200, forged 401) passed.");
