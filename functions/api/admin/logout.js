// POST /api/admin/logout - ends the owner session.
import { json } from "../../_lib/commerce.js";
import { destroySession, readCookie, SESSION_COOKIE } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  await destroySession(env, readCookie(request, SESSION_COOKIE));
  return json({ ok: true }, 200, { "Set-Cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
}
