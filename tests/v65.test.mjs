import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const js = readFileSync(new URL("../public/landing.js", import.meta.url), "utf8");
assert.match(js, /--theme-button/);
assert.match(readFileSync(new URL("../public/assets/eboora-v65.css", import.meta.url), "utf8"), /var\(--theme-button/);
console.log("Buy buttons and background follow the chosen theme.");
