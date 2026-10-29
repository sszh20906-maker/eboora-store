// Owner-only guard: ADMIN_KEY secret sent as a Bearer token.
// Wrong keys are counted per IP; after 10 wrong tries the IP is blocked for 15 minutes.
import { json, constantTimeEqual } from "./commerce.js";
import { clientIp, countHit, currentHits } from "./ratelimit.js";

const FAIL_WINDOW_SECONDS = 15 * 60;
const FAIL_LIMIT = 10;

export async function requireAdmin(request, env) {
  if (!env.ADMIN_KEY || env.ADMIN_KEY.length < 32) {
    return json({ error: "Admin access is not configured. Add the ADMIN_KEY secret (32+ characters) in Cloudflare." }, 503);
  }
  if (!env.ORDERS_DB) return json({ error: "Database is not connected yet." }, 503);

  const failKey = "admin-fail:" + clientIp(request);
  if ((await currentHits(env, failKey, FAIL_WINDOW_SECONDS)) >= FAIL_LIMIT) {
    return json({ error: "Too many wrong attempts. Try again after 15 minutes." }, 429, { "Retry-After": String(FAIL_WINDOW_SECONDS) });
  }

  const header = request.headers.get("Authorization") || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!provided || !constantTimeEqual(provided, env.ADMIN_KEY)) {
    await countHit(env, failKey, FAIL_WINDOW_SECONDS);
    return json({ error: "Unauthorized." }, 401);
  }
  return null;
}
