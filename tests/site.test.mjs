import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { validateConfig } from "../functions/_lib/settings.js";

const PUBLIC = new URL("../public/", import.meta.url).pathname;
const read = (f) => readFileSync(join(PUBLIC, f), "utf8");
const PAGES = ["index.html", "thank-you.html", "terms.html", "privacy.html", "refund.html", "404.html", "admin.html", "resend.html"];
const BUYER_PAGES = ["index.html", "thank-you.html", "terms.html", "privacy.html", "refund.html", "404.html"];

// 1. No inline scripts anywhere (allows a strict Content-Security-Policy)
for (const f of PAGES) {
  const inline = read(f).match(/<script(?![^>]*\ssrc=)[^>]*>/g) || [];
  assert.equal(inline.length, 0, f + " has an inline <script>");
}

// 2. Buyers never see or reach the owner pages
for (const f of BUYER_PAGES) {
  assert.ok(!/href="\/admin\.html"/.test(read(f)), f + " links to admin");
  assert.ok(!/store editor/i.test(read(f)), f + " mentions the store editor");
}

// 3. Every internal link and asset points to a file that exists
for (const f of PAGES) {
  for (const m of read(f).matchAll(/(?:href|src)="(\/[^"#?]*)"/g)) {
    if (m[1] === "/") continue;
    assert.ok(existsSync(join(PUBLIC, m[1])), f + " references missing " + m[1]);
  }
}

// 4. Client scripts never inject HTML from data (XSS guard)
for (const js of ["index.js", "thank-you.js", "admin.js"]) {
  assert.ok(existsSync(join(PUBLIC, js)), js + " is missing");
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(read(js)), js + " uses unsafe HTML injection");
}

// 5. Storefront CSP is configured, and owner pages get the strict policy
const headers = read("_headers");
assert.ok(headers.includes("Content-Security-Policy-Report-Only"));
assert.ok(/\/admin\.html\n\s+Cache-Control: no-store\n\s+Referrer-Policy: no-referrer\n\s+Content-Security-Policy: default-src 'self'; script-src 'self';/.test(headers));

// 6. Testimonials are optional, sanitized and capped
const withReviews = validateConfig({ productName: "K", headline: "H", description: "D", price: 499, email: "a@b.co",
  reviews: [{ name: "  Asha ", text: "Helpful kit" }, { name: "", text: "" }, { name: "Ravi", text: "<b>nice</b>" }] });
assert.deepEqual(withReviews.errors, []);
assert.equal(withReviews.config.reviews.length, 2);
assert.equal(withReviews.config.reviews[0].name, "Asha");
const many = validateConfig({ productName: "K", headline: "H", description: "D", price: 499, email: "a@b.co",
  reviews: Array.from({ length: 15 }, (_, i) => ({ name: "N" + i, text: "T" + i })) });
assert.equal(many.config.reviews.length, 10);
const none = validateConfig({ productName: "K", headline: "H", description: "D", price: 499, email: "a@b.co" });
assert.deepEqual(none.config.reviews, []);

// 7. Empty store: buyers see a clear "no product" state, never an admin redirect
const indexJs = read("index.js");
assert.ok(!indexJs.includes("/admin.html"), "storefront script must not redirect to admin");
assert.ok(indexJs.includes("No product listed yet"), "empty state text is missing");
assert.ok(indexJs.includes("not ready to be bought yet"), "not-ready message is missing");

console.log("Site checks passed.");
