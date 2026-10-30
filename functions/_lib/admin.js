// Owner-only guard: a valid login session cookie is required.
// Changing requests must be JSON, which stops cross-site form posts from acting as the owner.
import { json } from "./commerce.js";
import { isValidSession, readCookie, SESSION_COOKIE } from "./auth.js";

export async function requireAdmin(request, env) {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD_HASH) {
    return json({ error: "Admin login is not set up yet. Add ADMIN_EMAIL and ADMIN_PASSWORD_HASH in Cloudflare." }, 503);
  }
  if (!env.ORDERS_DB) return json({ error: "Database is not connected yet." }, 503);
  const token = readCookie(request, SESSION_COOKIE);
  if (!token || !(await isValidSession(env, token))) return json({ error: "Please log in again." }, 401);
  if (request.method !== "GET" && !(request.headers.get("Content-Type") || "").includes("application/json")) {
    return json({ error: "Invalid request." }, 415);
  }
  return null;
}
