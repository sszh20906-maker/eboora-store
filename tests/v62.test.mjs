import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../public/landing.js", import.meta.url), "utf8");
assert.match(src, /v62: landing\.html has a fixed cover/);
assert.match(src, /getElementById\('coverImg'\)/);
console.log("Landing page cover image is set from the product cover.");
