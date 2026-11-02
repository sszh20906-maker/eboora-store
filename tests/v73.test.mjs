import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
for (const id of ["list","empty","searchEmpty","storeVideo","storeVideoPlay","storeVideoStage","catalogSearch","catalogSort"]) {
  assert.ok(html.includes('id="' + id + '"'), "storefront lost #" + id);
}
assert.match(html, /shop-v73\.css/);
assert.match(html, /catalog\.js/);
assert.match(html, /pixel-site\.js/);
console.log("Storefront redesign keeps every element the catalog script and payment flow use.");
