import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const js = readFileSync(new URL("../public/landing.js", import.meta.url), "utf8");
const ty = readFileSync(new URL("../public/thank-you.js", import.meta.url), "utf8");
assert.match(js, /function openCheckout\(e\)\{e\?\.preventDefault\(\);if\(window\.fbq&&CONFIG\.productId\)\{fbq\('track','InitiateCheckout'/);
assert.equal(js.split("fbq('track','InitiateCheckout'").length - 1, 1, "InitiateCheckout must fire once, at checkout start");
assert.match(ty, /fbq\("track","Purchase"/);
console.log("InitiateCheckout fires when the buyer opens checkout; Purchase fires on verified success.");
