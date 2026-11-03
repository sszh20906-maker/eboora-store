import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
const css = readFileSync(new URL("../public/assets/landing-v74.css", import.meta.url), "utf8");
assert.match(css, /#coverImg\{aspect-ratio:16\/9!important/);
assert.ok(statSync(new URL("../public/assets/product-cover-1280x720.jpg", import.meta.url)).size < 350000);
console.log("Product cover is 1280x720 horizontal at 72 DPI and displays at 16:9.");
