import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const js = readFileSync(new URL("../public/landing.js", import.meta.url), "utf8");
assert.match(js, /checkoutResult&&checkoutResult\.error/);
assert.match(js, /console\.error\('Checkout failed'/);
console.log("Checkout errors from Cashfree are shown and logged, not silent.");
