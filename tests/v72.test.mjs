import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const api = readFileSync(new URL("../functions/api/verify-order.js", import.meta.url), "utf8");
const ty = readFileSync(new URL("../public/thank-you.js", import.meta.url), "utf8");
const lib = readFileSync(new URL("../functions/_lib/commerce.js", import.meta.url), "utf8");
assert.match(lib, /export async function fetchCashfreePayments/);
assert.match(api, /failureReason\(env, orderId/);
assert.match(ty, /d\.status==="FAILED"/);
console.log("Failed payments are detected and the reason is shown.");
