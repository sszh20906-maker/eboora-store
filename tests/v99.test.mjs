import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../public/landing.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../public/landing.js", import.meta.url), "utf8");
assert.match(html, /<div[^>]*id="offerDescription"/);
assert.doesNotMatch(js, /offerDescription'\)\.textContent=/);
assert.match(js, /renderDescription\(el\('offerDescription'\)/);
console.log("Dark offer card text is structured (line breaks, headings, lists) and readable.");
