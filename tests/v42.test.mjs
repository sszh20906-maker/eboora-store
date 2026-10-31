import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../public/thank-you.js", import.meta.url), "utf8");
assert.match(src, /MAX_PENDING_ATTEMPTS=6/);
assert.match(src, /FAILED_STATUSES=\[.*EXPIRED/);
assert.match(src, /Payment not completed/);
console.log("Thank-you page stops early for failed or pending orders.");
