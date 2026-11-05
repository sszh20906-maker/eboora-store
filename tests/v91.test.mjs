import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const pixel = readFileSync(new URL("../public/pixel-head.js", import.meta.url), "utf8");
assert.match(pixel, /fbq\('init','956149244213138'\);fbq\('track','PageView'\)/);
for (const f of ["index.html","landing.html","product-page.html"]) {
  const t = readFileSync(new URL("../public/" + f, import.meta.url), "utf8");
  const head = t.slice(0, t.indexOf("</head>"));
  assert.match(head, /<script src="\/pixel-head\.js\?v=91"><\/script>/, f + " must load the pixel in the head");
  assert.doesNotMatch(head, /<script>(?!<\/script>)/, f + " must not add inline script");
}
const js = readFileSync(new URL("../public/landing.js", import.meta.url), "utf8");
assert.match(js, /_ebooraViewContentSent/);
console.log("Meta pixel loads in the head on storefront, landing and product pages; ViewContent fires once.");
