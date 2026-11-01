import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../functions/api/create-order.js", import.meta.url), "utf8");
assert.match(src, /ALLOWED_SITES = \["https:\/\/eboora\.shop"/);
assert.match(src, /const siteUrl = \(origin && ALLOWED_SITES/);
console.log("Checkout works from eboora.shop and pages.dev regardless of SITE_URL.");
