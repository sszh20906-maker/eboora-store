import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const landing = readFileSync(new URL("../public/landing.html", import.meta.url), "utf8");
const product = readFileSync(new URL("../public/product-page.html", import.meta.url), "utf8");
assert.equal(landing.split('id="eboora-checkout-v50"').length - 1, 1, "landing must have the v50 id once");
assert.equal(product, landing, "/p/ product page must be the same conversion page");
console.log("Product page and landing are one page; no duplicate ids.");
