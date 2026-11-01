import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const js = readFileSync(new URL("../public/pixel-site.js", import.meta.url), "utf8");
assert.match(js, /\/api\/site-settings/);
assert.match(js, /fbq\('init', id\)/);
assert.match(readFileSync(new URL("../public/index.html", import.meta.url), "utf8"), /pixel-site\.js/);
console.log("Storefront loads the site-wide Meta pixel.");
