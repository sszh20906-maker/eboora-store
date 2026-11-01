import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../public/landing.js", import.meta.url), "utf8");
assert.match(src, /v64: feed the chosen theme/);
assert.match(src, /setProperty\('--v31-accent',palette\.accent\)/);
console.log("Chosen theme feeds the storefront CSS variables.");
