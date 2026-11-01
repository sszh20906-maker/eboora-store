import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
for (const f of ["../public/landing.html", "../public/product-page.html"]) {
  const html = readFileSync(new URL(f, import.meta.url), "utf8");
  assert.match(html, /name="color-scheme" content="light"/);
  assert.match(html, /eboora-v59\.css/);
}
console.log("Product and landing pages pinned to light color-scheme.");
