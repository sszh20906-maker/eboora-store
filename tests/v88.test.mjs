import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const priv = readFileSync(new URL("../public/privacy.html", import.meta.url), "utf8");
assert.doesNotMatch(priv, /\[Business address/);
for (const f of ["index.html","landing.html"]) {
  assert.match(readFileSync(new URL("../public/" + f, import.meta.url), "utf8"), /og:image/);
}
console.log("Privacy placeholder removed; storefront and landing have social preview tags.");
