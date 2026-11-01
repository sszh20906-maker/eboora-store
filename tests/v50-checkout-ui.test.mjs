import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const html=readFileSync(new URL('../public/landing.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/landing.js',import.meta.url),'utf8');
for (const id of ['checkoutDialog','checkoutProduct','checkoutAmount','customerName','customerEmail','customerPhone','couponCode','applyCoupon','couponMsg','checkoutSubmit','paymentTransition']) assert.ok(html.includes(`id="${id}"`),`missing ${id}`);
assert.match(html,/checkout-shell/);assert.match(html,/@media\(max-width:680px\)/);assert.match(html,/prefers-reduced-motion/);
assert.match(js,/cashfree\.checkout/);assert.match(js,/Discount applied/);assert.match(js,/paymentTransition/);
console.log('V50 checkout UI structure checks passed.');
