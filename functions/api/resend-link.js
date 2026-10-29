// POST /api/resend-link {email} - emails the download links of recent paid orders.
// Always gives the same answer, so it cannot be used to find out who has bought.
import { json, makeDownloadUrl } from "../_lib/commerce.js";
import { clientIp, countHit } from "../_lib/ratelimit.js";

const SAME_ANSWER = "If we find a paid order for this email, the download link has been sent. Check your inbox and spam folder.";
const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestPost({ request, env }) {
  if (!env.ORDERS_DB || !env.RESEND_API_KEY || !env.FROM_EMAIL || !String(env.SITE_URL || "").startsWith("https://")) {
    return json({ error: "Download links cannot be sent right now. Please contact support." }, 503);
  }
  if ((await countHit(env, "resend-ip:" + clientIp(request), 3600)) > 10) {
    return json({ error: "Too many requests. Please try again later." }, 429);
  }
  let input;
  try { input = await request.json(); } catch { return json({ error: "Enter a valid email address." }, 400); }
  const email = String(input?.email ?? "").trim().toLowerCase().slice(0, 160);
  if (!EMAIL_RE.test(email)) return json({ error: "Enter a valid email address." }, 400);
  if ((await countHit(env, "resend-email:" + (await sha256Hex(email)), 3600)) > 3) {
    return json({ error: "Too many requests for this email. Please try again later." }, 429);
  }

  const rows = await env.ORDERS_DB.prepare("SELECT order_id FROM orders WHERE customer_email = ? AND status = 'PAID' ORDER BY paid_at DESC LIMIT 3").bind(email).all();
  const orderIds = (rows.results || []).map((r) => r.order_id);
  if (orderIds.length) {
    try {
      const links = await Promise.all(orderIds.map((id) => makeDownloadUrl(env, id)));
      const items = links.map((url, i) => `<li><a href="${esc(url)}">Download order ${esc(orderIds[i])}</a></li>`).join("");
      const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827"><h2>Your download links</h2><p>Here are your recent purchases. Each link stays valid for 30 days.</p><ul>${items}</ul><p>Need help? Reply to this email.</p></div>`;
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.FROM_EMAIL, to: [email], subject: "Your download links", html })
      });
      if (!response.ok) console.error("Resend download links failed", response.status);
    } catch (error) {
      console.error("Resend download links error", error);
    }
  }
  // Same answer whether or not an order exists.
  return json({ ok: true, message: SAME_ANSWER });
}
