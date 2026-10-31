import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../public/thank-you.js", import.meta.url), "utf8");
assert.match(src, /MAX_ATTEMPTS=20/);
assert.match(src, /Still confirming your payment/);
assert.doesNotMatch(src, /setTimeout\(\(\)=>check\(attempt\+1\),2500\)/);
console.log("Thank-you page waits longer and no longer shows a hard failure on temporary errors.");
