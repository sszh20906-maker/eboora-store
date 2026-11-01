import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../public/assets/eboora-v63.css", import.meta.url), "utf8");
assert.match(css, /body\.catalog-premium\{background:#f7f9fd!important/);
assert.match(readFileSync(new URL("../public/index.html", import.meta.url), "utf8"), /eboora-v63\.css/);
console.log("Storefront pinned to a readable light palette.");
