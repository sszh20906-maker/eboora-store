import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const api = readFileSync(new URL("../functions/api/verify-order.js", import.meta.url), "utf8");
const ty = readFileSync(new URL("../public/thank-you.js", import.meta.url), "utf8");
assert.match(api, /productTracking\(env, record\.product_id\)/);
assert.match(ty, /if\(d\.pixelId\)\{CONFIG\.pixelId=d\.pixelId;\}/);
console.log("Thank-you page tracks Purchase with the product's own pixel.");
