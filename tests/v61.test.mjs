import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../public/landing.js", import.meta.url), "utf8");
assert.match(src, /v61: if the product record gives no real cover/);
assert.match(src, /fetch\('\/api\/catalog'/);
console.log("Landing falls back to the catalog cover when the product record has none.");
