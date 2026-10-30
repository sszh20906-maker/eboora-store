// POST /api/admin/login {email, password} - starts the owner session (HttpOnly cookie).
import { json } from "../../_lib/commerce.js";
import { checkPassword, createSession, SESSION_COOKIE, SESSION_SECONDS } from "../../_lib/auth.js";
import { clientIp, countHit, currentHits } from "../../_lib/ratelimit.js";

const WINDOW_SECONDS = 15 * 60;
const FAIL_LIMIT = 10;

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD_HASH || !env.ORDERS_DB) {
    return json({ error: "Admin login is not set up yet. Add ADMIN_EMAIL and ADMIN_PASSWORD_HASH in Cloudflare." }, 503);
  }
  const failKey = "admin-login:" + clientIp(request);
  if ((await currentHits(env, failKey, WINDOW_SECONDS)) >= FAIL_LIMIT) {
    return json({ error: "Too many wrong attempts. Try again after 15 minutes." }, 429, { "Retry-After": String(WINDOW_SECONDS) });
  }

  let input;
  try { input = await request.json(); } catch { return json({ error: "Invalid data sent." }, 400); }
  const email = String(input?.email ?? "").trim().toLowerCase();
  const password = String(input?.password ?? "");
  const emailOk = email === String(env.ADMIN_EMAIL).trim().toLowerCase();
  const passwordOk = password.length > 0 && (await checkPassword(password, env.ADMIN_PASSWORD_HASH));

  if (!emailOk || !passwordOk) {
    await countHit(env, failKey, WINDOW_SECONDS);
    return json({ error: "Email ya password galat hai." }, 401);
  }
  const token = await createSession(env);
  return json({ ok: true }, 200, {
    "Set-Cookie": `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`
  });
}
