import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const api = readFileSync(new URL("../functions/api/verify-order.js", import.meta.url), "utf8");
const ty = readFileSync(new URL("../public/thank-you.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/assets/shop-v73.css", import.meta.url), "utf8");
assert.match(api, /productSlug: \(await productTracking/);
assert.match(ty, /Try again on this product/);
assert.match(css, /-webkit-tap-highlight-color:transparent/);
console.log("Failed payments send the buyer back to the same product; card and landing feel smooth.");
