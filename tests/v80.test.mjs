import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
for (const f of readdirSync(new URL("../public/", import.meta.url)).filter(x => x.endsWith(".html"))) {
  const t = readFileSync(new URL("../public/" + f, import.meta.url), "utf8");
  assert.doesNotMatch(t, /src="\/[^"?]+\.js"/, f + " has an unversioned script");
}
console.log("Every local script and stylesheet is versioned, so phones load the new code.");
