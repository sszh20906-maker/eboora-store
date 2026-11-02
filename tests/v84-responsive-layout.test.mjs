import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../public/assets/eboora-v84-responsive-layout.css', import.meta.url), 'utf8');
for (const file of ['landing.html', 'product-page.html']) {
  const html = fs.readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8');
  assert.match(html, /name="viewport"\s+content="width=device-width,initial-scale=1"/i, `${file}: responsive viewport metadata must remain present`);
  assert.match(html, /eboora-v84-responsive-layout\.css\?v=84/, `${file}: V84 responsive stylesheet must load after the older rules`);
}
assert.match(css, /body\.lp74\s*\{[^}]*overflow-x:\s*clip/s, 'product page must clip accidental horizontal overflow');
assert.match(css, /body\.lp74\s+\.lp-wrap\s*\{[^}]*width:\s*100%[^}]*max-width:\s*1160px/s, 'page wrapper must fill the available viewport up to its desktop max width');
assert.match(css, /body\.lp74\s+\.lp-hero::before\s*\{[^}]*inset:\s*0\s*;/s, 'hero background must remain inside the hero to avoid 100vw overflow');
assert.doesNotMatch(css, /inset:\s*0\s+-100vw/i, 'negative 100vw pseudo-element insets must not be reintroduced');
assert.match(css, /body\.lp74\s+\.lp-top\s*\{[^}]*margin-left:\s*-16px[^}]*margin-right:\s*-16px/s, 'narrow mobile header margins must match the wrapper padding');
console.log('V84 responsive width and horizontal-overflow regression checks passed.');
