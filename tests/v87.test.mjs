import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const settings = readFileSync(new URL("../functions/_lib/settings.js", import.meta.url), "utf8");
const admin = readFileSync(new URL("../public/admin.html", import.meta.url), "utf8");
const landing = readFileSync(new URL("../public/landing.js", import.meta.url), "utf8");
assert.match(settings, /buyButtonText: clean\(input\.buyButtonText, 40\)/);
assert.match(admin, /id="buyButtonText"/);
assert.match(landing, /const buyLabel=/);
console.log("Buy button text and colour are customisable from product settings.");
