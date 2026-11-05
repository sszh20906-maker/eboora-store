import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../public/landing.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../public/landing.js", import.meta.url), "utf8");
assert.match(html, /<div class="lp-lead" id="descriptionContent"><\/div>/);
assert.doesNotMatch(html, /<p class="lp-lead" id="descriptionContent">/);
assert.match(js, /createElement\('br'\)/);
assert.doesNotMatch(js, /paragraph\.join\(' '\)/);
console.log("Description keeps the admin's line breaks, and its container is valid HTML.");
