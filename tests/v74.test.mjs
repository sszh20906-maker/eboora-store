import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../public/landing.html", import.meta.url), "utf8");
for (const id of ["headline","heroBuy","stickyBar","stickyBuy","stickyPrice","checkoutDialog","checkoutForm","customerName","customerEmail","customerPhone","couponCode","applyCoupon","couponMsg","checkoutSubmit","checkoutError","closeCheckout","coverImg","price","mrp","saveBadge","offer","offerPrice","offerProductName","benefits","included","faq","reviews","makerName","supportEmail","legal","year","toast","paymentTransition"]) {
  assert.ok(html.includes('id="' + id + '"'), "landing lost #" + id);
}
assert.match(html, /landing-v74\.css/);
assert.match(html, /landing\.js/);
assert.match(html, /cashfree\.js/);
console.log("Conversion landing keeps every element the script and checkout use.");
