import assert from "node:assert/strict";
import { makeDb, ADMIN_COOKIE } from "./helpers/mockdb.mjs";
import { checkPassword, makePasswordHash } from "../functions/_lib/auth.js";
import { requireAdmin } from "../functions/_lib/admin.js";
import { onRequestPost as login } from "../functions/api/admin/login.js";
import { onRequestPost as logout } from "../functions/api/admin/logout.js";
import { onRequestGet as adminConfig } from "../functions/api/admin/config.js";

const EMAIL = "owner@example.test";
const PASSWORD = "owner-test-password-123";
const HASH = await makePasswordHash(PASSWORD);
const makeEnv = (db) => ({ ORDERS_DB: db, ADMIN_EMAIL: EMAIL, ADMIN_PASSWORD_HASH: HASH, PRODUCT_ID: "eboora-product" });
const loginReq = (body) => new Request("https://shop.example.test/api/admin/login", {
  method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.200" }, body: JSON.stringify(body)
});

// 1. Password hashing
{
  assert.equal(await checkPassword(PASSWORD, HASH), true);
  assert.equal(await checkPassword("wrong-password", HASH), false);
  assert.equal(await checkPassword(PASSWORD, "not-a-hash"), false);
  assert.ok(!HASH.includes(PASSWORD), "the password must not appear in the stored hash");
  console.log("Password hashing test passed.");
}

// 2. Login: wrong details refused; right details give a secure cookie; logout ends the session
{
  const db = makeDb();
  const env = makeEnv(db);
  assert.equal((await login({ request: loginReq({ email: EMAIL, password: "nope" }), env })).status, 401);
  assert.equal((await login({ request: loginReq({ email: "someone@example.test", password: PASSWORD }), env })).status, 401);

  const ok = await login({ request: loginReq({ email: "OWNER@example.test", password: PASSWORD }), env });
  assert.equal(ok.status, 200);
  const setCookie = ok.headers.get("Set-Cookie");
  assert.ok(/HttpOnly/.test(setCookie) && /Secure/.test(setCookie) && /SameSite=Strict/.test(setCookie), "cookie must be HttpOnly, Secure and SameSite=Strict");
  const token = setCookie.match(/eboora_admin=([^;]+)/)[1];
  const withCookie = new Request("https://shop.example.test/api/admin/config", { headers: { Cookie: "eboora_admin=" + token } });
  assert.equal(await requireAdmin(withCookie, env), null);

  await logout({ request: new Request("https://shop.example.test/api/admin/logout", { method: "POST", headers: { Cookie: "eboora_admin=" + token, "Content-Type": "application/json" }, body: "{}" }), env });
  assert.equal((await requireAdmin(withCookie, env)).status, 401, "after logout the cookie must stop working");
  console.log("Login, cookie and logout test passed.");
}

// 3. Expired sessions, missing sessions and cross-site form posts are refused
{
  const db = makeDb();
  const env = makeEnv(db);
  const ok = await login({ request: loginReq({ email: EMAIL, password: PASSWORD }), env });
  const token = ok.headers.get("Set-Cookie").match(/eboora_admin=([^;]+)/)[1];
  for (const s of db.sessions.values()) s.expires_at = 1;
  assert.equal((await requireAdmin(new Request("https://x/api/admin/config", { headers: { Cookie: "eboora_admin=" + token } }), env)).status, 401);

  assert.equal((await requireAdmin(new Request("https://x/api/admin/config"), makeEnv(makeDb()))).status, 401);
  const formPost = new Request("https://x/api/admin/config", { method: "PUT", headers: { Cookie: ADMIN_COOKIE }, body: "{}" });
  assert.equal((await requireAdmin(formPost, makeEnv(makeDb()))).status, 415);

  const res = await adminConfig({ request: new Request("https://x/api/admin/config", { headers: { Cookie: ADMIN_COOKIE } }), env: makeEnv(makeDb()) });
  assert.equal(res.status, 200);
  console.log("Session refusal test passed.");
}

console.log("All auth tests passed.");
