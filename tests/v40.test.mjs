import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../functions/api/create-order.js", import.meta.url), "utf8");
assert.match(src, /status = 'PAID' LIMIT 1/);
assert.match(src, /, 409\)/);
console.log("Duplicate-purchase guard present in create-order.");
