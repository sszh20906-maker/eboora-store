import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../public/assets/eboora-v66.css", import.meta.url), "utf8");
assert.match(css, /html body\.product-premium \.eyebrow/);
assert.match(css, /var\(--theme-button/);
console.log("Eyebrow and Buy buttons follow the chosen theme.");
