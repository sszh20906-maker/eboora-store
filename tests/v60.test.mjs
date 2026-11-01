import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../public/assets/eboora-v60.css", import.meta.url), "utf8");
assert.match(css, /body\.product-premium \.section\.alt\{background:#f5f8fe!important/);
for (const f of ["../public/landing.html", "../public/product-page.html"]) {
  assert.match(readFileSync(new URL(f, import.meta.url), "utf8"), /eboora-v60\.css/);
}
console.log("Alternate product sections pinned to one readable palette.");
