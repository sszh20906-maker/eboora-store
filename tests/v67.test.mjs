import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
const dir = new URL("../public/", import.meta.url);
const files = readdirSync(dir).filter(f => /\.(html|js)$/.test(f));
for (const f of files) {
  const t = readFileSync(new URL(f, dir), "utf8");
  assert.ok(!t.includes("support@eboora.store"), f + " still has the old support email");
}
for (const f of ["privacy.html","terms.html","refund.html"]) {
  const t = readFileSync(new URL(f, dir), "utf8");
  assert.ok(!/legal business name|\[Full business address|\[Applicable jurisdiction/.test(t), f + " still has a placeholder");
}
console.log("Support email and legal pages updated.");
