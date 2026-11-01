import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
for (const required of [
  'X-Content-Type-Options: nosniff',
  'Referrer-Policy: strict-origin-when-cross-origin',
  'X-Frame-Options: DENY',
  'Strict-Transport-Security: max-age=31536000; includeSubDomains',
  'Permissions-Policy: camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy-Report-Only:'
]) assert.ok(headers.includes(required), `Missing security header: ${required}`);
assert.match(headers, /\/api\/\*[\s\S]*?Cache-Control: no-store/);
assert.match(headers, /\/admin\.html[\s\S]*?Cache-Control: no-store/);
console.log('V56 security headers and sensitive-route cache checks passed.');
