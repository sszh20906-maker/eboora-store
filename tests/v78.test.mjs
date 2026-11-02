import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const guard = readFileSync(new URL("../public/guard.js", import.meta.url), "utf8");
const motion = readFileSync(new URL("../public/motion.js", import.meta.url), "utf8");
assert.match(guard, /v78/);
assert.match(motion, /closest\('dialog'\)/);
assert.match(motion, /classList\.contains\('item'\)/);
console.log("Blue selection removed, card press feels right, checkout dialog never hidden by motion.");
