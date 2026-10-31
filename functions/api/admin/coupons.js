// GET lists discount codes; POST creates or updates one. Owner only.
import { json } from "../../_lib/commerce.js";
import { requireAdmin } from "../../_lib/admin.js";
import { COUPON_CODE_RE, normalizeCode } from "../../_lib/coupons.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function onRequestGet({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const result = await env.ORDERS_DB.prepare("SELECT code, type, value, max_uses, used_count, expires_at, active FROM coupons ORDER BY created_at DESC LIMIT 100").all();
  return json({ coupons: result.results || [] });
}

export async function onRequestPost({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  let input;
  try { input = await request.json(); } catch { return json({ error: "Invalid data sent." }, 400); }

  const code = normalizeCode(input?.code);
  if (!COUPON_CODE_RE.test(code)) return json({ error: "Code 3 to 20 characters long honi chahiye (A-Z, 0-9, - or _)." }, 400);
  if (input.type !== "percent" && input.type !== "fixed") return json({ error: "Type percent ya fixed hona chahiye." }, 400);
  const value = Number(input.value);
  if (input.type === "percent" && !(value > 0 && value <= 90)) return json({ error: "Percent 1 se 90 ke beech hona chahiye." }, 400);
  if (input.type === "fixed" && !(value > 0 && value <= 100000)) return json({ error: "Amount 1 se 100000 ke beech hona chahiye." }, 400);
  const maxUses = input.max_uses === "" || input.max_uses == null ? null : Number(input.max_uses);
  if (maxUses !== null && !(Number.isInteger(maxUses) && maxUses >= 1 && maxUses <= 100000)) {
    return json({ error: "Max uses 1 ya usse zyada hona chahiye, ya khali chhod do." }, 400);
  }
  const expiresAt = input.expires_at ? String(input.expires_at) : null;
  if (expiresAt !== null && !DATE_RE.test(expiresAt)) return json({ error: "Expiry date sahi format mein do." }, 400);
  const active = input.active === false ? 0 : 1;

  try {
    await env.ORDERS_DB.prepare(`
      INSERT INTO coupons (code, type, value, max_uses, used_count, expires_at, active, created_at)
      VALUES (?, ?, ?, ?, 0, ?, ?, datetime('now'))
      ON CONFLICT(code) DO UPDATE SET type = excluded.type, value = excluded.value, max_uses = excluded.max_uses,
        expires_at = excluded.expires_at, active = excluded.active
    `).bind(code, input.type, value, maxUses, expiresAt, active).run();
  } catch (error) {
    console.error("Coupon save failed", error);
    return json({ error: "Coupon could not be saved. Please try again." }, 503);
  }
  return json({ ok: true, code });
}

// DELETE /api/admin/coupons?code=... - permanently removes a discount code (owner only).
export async function onRequestDelete({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const code = normalizeCode(new URL(request.url).searchParams.get("code"));
  if (!COUPON_CODE_RE.test(code)) return json({ error: "Coupon code sahi nahi hai." }, 400);
  try {
    await env.ORDERS_DB.prepare("DELETE FROM coupons WHERE code = ?").bind(code).run();
  } catch (error) {
    console.error("Coupon delete failed", error);
    return json({ error: "Coupon delete nahi hua. Phir se try karo." }, 503);
  }
  return json({ ok: true, code });
}
