import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const landing = fs.readFileSync(new URL('../public/landing.html', import.meta.url), 'utf8');
const product = fs.readFileSync(new URL('../public/product-page.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/assets/eboora-v83-checkout-contrast.css', import.meta.url), 'utf8');

assert.match(index, /<link rel="stylesheet" href="\/assets\/shop-v73\.css\?v=73">/);
assert.match(index, /<link rel="stylesheet" href="\/assets\/eboora-v81\.css\?v=81">/);
assert.doesNotMatch(index, /shop-v73\.css[^>]*\n\s*<link/);
for (const html of [landing, product]) {
  assert.match(html, /eboora-v83-checkout-contrast\.css\?v=83/);
  assert.match(html, /placeholder="you@example\.com"/);
  assert.doesNotMatch(html, /placeholder="customersupport527@gmail\.com"/);
}
assert.match(css, /#checkoutDialog\.checkout-dialog[\s\S]*color-scheme: light !important/);
assert.match(css, /#checkoutDialog\.checkout-dialog \.checkout-form input[\s\S]*-webkit-text-fill-color: #172334 !important/);
console.log('✓ V83 storefront stylesheet links and checkout contrast regression');
