// npm run golive - lists what must be filled in before real customers arrive. Exits 1 if anything is left.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PUBLIC = new URL("../public/", import.meta.url).pathname;
const LEGAL = ["terms.html", "privacy.html", "refund.html"];
const placeholder = /\[[A-Z][^\]<>]*\]/g;

let problems = 0;
for (const f of LEGAL) {
  const found = [...readFileSync(join(PUBLIC, f), "utf8").matchAll(placeholder)].map((m) => m[0]);
  for (const text of found) {
    console.log("NOT FILLED: " + f + " -> " + text);
    problems++;
  }
}

console.log("\nBefore go-live, also confirm (these cannot be checked from code):");
console.log("  - Cloudflare: ADMIN_EMAIL, ADMIN_PASSWORD_HASH, CASHFREE_*, RESEND_API_KEY, DOWNLOAD_TOKEN_SECRET set; CASHFREE_ENV=production only after live approval");
console.log("  - Cloudflare: Build output directory = public; D1 (ORDERS_DB) and R2 (PRODUCTS_BUCKET) bound");
console.log("  - Cashfree: live merchant account approved; webhook URL = https://YOUR-SITE/api/cashfree-webhook with BOTH success and failed events enabled");
console.log("  - Cloudflare: OWNER_EMAIL set (where new-sale alerts go); schema.sql run again so order_notifications and rate_limits exist");
console.log("  - A real test purchase completed end to end, and the download email received");
console.log("  - Legal pages reviewed by you or a lawyer (they are templates, not legal advice)");

console.log("  - Storage: R2 bucket bound as PRODUCTS_BUCKET; upload the product file and cover from the admin page");
console.log("  - Meta: pixel ID saved in admin page; META_CAPI_TOKEN set as a Cloudflare Secret (never paste it into chat)");

if (problems) {
  console.log("\n" + problems + " legal placeholder(s) still need your real business details.");
  process.exit(1);
}
console.log("\nNo legal placeholders left.");
