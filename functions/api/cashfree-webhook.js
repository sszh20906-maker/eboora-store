// POST /api/cashfree-webhook
// Cashfree-signed payment webhook -> verified D1 order state -> private download email + Meta CAPI.
import { json, makeDownloadUrl, amountMatches, constantTimeEqual } from "../_lib/commerce.js";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function validCashfreeSignature(rawBody, timestamp, signature, secret) {
  if (!timestamp || !signature || !secret) return false;
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(timestamp + rawBody));
    const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
    return constantTimeEqual(expected, signature);
  } catch { return false; }
}

async function sendDownloadEmail(env, record, orderId, downloadUrl) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL || !record.customer_email) throw new Error("Resend email configuration or customer email is missing.");
  const product = env.PRODUCT_NAME || "your digital product";
  const brand = env.BRAND_NAME || "Eboora-Store";
  const safeUrl = esc(downloadUrl);
  const html = `<div style="font-family:Arial,sans-serif;max-width:540px;margin:auto;color:#111827;line-height:1.65">
<h1 style="font-size:24px;line-height:1.2">Your download is ready</h1>
<p>Thank you for purchasing <strong>${esc(product)}</strong>. Your payment has been confirmed.</p>
<p><a href="${safeUrl}" style="display:inline-block;background:#3E49E8;color:#fff;padding:14px 22px;border-radius:10px;text-decoration:none;font-weight:bold">Download your files</a></p>
<p style="font-size:13px;color:#5E6678">For your security, this link checks the order status before sending the file. Keep it private.</p>
<p style="font-size:13px;color:#5E6678">Order ID: ${esc(orderId)}<br>Need help? Reply to this email.${brand ? `<br>${esc(brand)}` : ""}</p></div>`;
  const body = { from: env.FROM_EMAIL, to: [record.customer_email], subject: `Your ${product} download`, html };
  if (env.REPLY_TO) body.reply_to = env.REPLY_TO;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `download-${orderId}`
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    console.error("Resend failed", response.status, await response.text());
    throw new Error("Download email delivery failed.");
  }
}

const sha256 = async (value) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

async function sendMetaPurchase(env, record, orderId, amount, currency, customerPhone) {
  if (!env.META_PIXEL_ID || env.META_PIXEL_ID === "YOUR_PIXEL_ID" || !env.META_CAPI_TOKEN) return "SKIPPED";
  const userData = {};
  if (record.customer_email) userData.em = [await sha256(String(record.customer_email).trim().toLowerCase())];
  if (customerPhone) {
    let phone = String(customerPhone).replace(/\D/g, "");
    // Meta matches best with full international format, so add India country code to 10-digit numbers.
    if (phone.length === 10) phone = "91" + phone;
    if (phone.length >= 11) userData.ph = [await sha256(phone)];
  }
  const site = String(env.SITE_URL || "").replace(/\/$/, "");
  const payload = {
    data: [{
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      event_id: orderId,
      action_source: "website",
      event_source_url: `${site}/thank-you.html`,
      user_data: userData,
      custom_data: { value: amount, currency, order_id: orderId, content_ids: [record.product_id], content_type: "product", num_items: 1 }
    }]
  };
  if (env.META_TEST_CODE) payload.test_event_code = env.META_TEST_CODE;
  const response = await fetch(`https://graph.facebook.com/v26.0/${encodeURIComponent(env.META_PIXEL_ID)}/events?access_token=${encodeURIComponent(env.META_CAPI_TOKEN)}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
  });
  if (!response.ok) {
    console.error("Meta CAPI failed", response.status, await response.text());
    throw new Error("Meta Conversions API delivery failed.");
  }
  const result = await response.json().catch(() => ({}));
  if (result.events_received === 0 || result.error) throw new Error("Meta did not accept the Purchase event.");
  return "SENT";
}

export async function onRequestPost({ request, env }) {
  const rawBody = await request.text();
  const valid = await validCashfreeSignature(
    rawBody,
    request.headers.get("x-webhook-timestamp"),
    request.headers.get("x-webhook-signature"),
    (env.CASHFREE_WEBHOOK_SECRET || env.CASHFREE_SECRET_KEY)
  );
  if (!valid) return new Response("bad signature", { status: 401, headers: { "Cache-Control": "no-store" } });

  let body;
  try { body = JSON.parse(rawBody); }
  catch { return new Response("bad json", { status: 400 }); }
  if (body.type !== "PAYMENT_SUCCESS_WEBHOOK") return new Response("ignored", { status: 200 });
  if (!env.ORDERS_DB) {
    console.error("Webhook received but ORDERS_DB is not configured");
    return new Response("order storage unavailable", { status: 503 });
  }

  const data = body.data || {};
  const cashfreeOrder = data.order || {};
  const payment = data.payment || {};
  const customer = data.customer_details || cashfreeOrder.customer_details || {};
  const orderId = String(cashfreeOrder.order_id || "");
  if (!/^[A-Za-z0-9_-]{3,80}$/.test(orderId)) return new Response("missing order id", { status: 400 });
  // Not an error: acknowledge so Cashfree does not keep retrying a non-success event.
  if (payment.payment_status !== "SUCCESS") return new Response("ignored", { status: 200 });

  let record;
  try { record = await env.ORDERS_DB.prepare("SELECT * FROM orders WHERE order_id = ? LIMIT 1").bind(orderId).first(); }
  catch (error) { console.error("Webhook order lookup failed", error); return new Response("database unavailable", { status: 503 }); }
  if (!record) {
    console.error("Ignoring Cashfree webhook for unknown local order", orderId);
    return new Response("unknown order", { status: 200 });
  }

  const paidAmount = payment.payment_amount ?? cashfreeOrder.order_amount;
  const currency = payment.payment_currency || cashfreeOrder.order_currency || "INR";
  if (!amountMatches(paidAmount, record.amount) || currency !== record.currency) {
    console.error("Webhook payment amount/currency mismatch", orderId);
    return new Response("amount mismatch", { status: 400 });
  }

  try {
    await env.ORDERS_DB.prepare("UPDATE orders SET status = 'PAID', paid_at = COALESCE(paid_at, datetime('now')), updated_at = datetime('now') WHERE order_id = ?").bind(orderId).run();
  } catch (error) { console.error("Could not mark order paid", error); return new Response("database update failed", { status: 503 }); }

  let failed = false;
  // The idempotency key at Resend and the order_id event_id make retries safe.
  try {
    const latest = await env.ORDERS_DB.prepare("SELECT * FROM orders WHERE order_id = ? LIMIT 1").bind(orderId).first();
    if (latest.email_status !== "SENT") {
      const url = await makeDownloadUrl(env, orderId);
      await sendDownloadEmail(env, latest, orderId, url);
      await env.ORDERS_DB.prepare("UPDATE orders SET email_status = 'SENT', updated_at = datetime('now') WHERE order_id = ?").bind(orderId).run();
    }
  } catch (error) {
    failed = true;
    console.error("Purchase email processing failed", orderId, error);
    try { await env.ORDERS_DB.prepare("UPDATE orders SET email_status = 'FAILED', updated_at = datetime('now') WHERE order_id = ?").bind(orderId).run(); } catch (_) {}
  }

  try {
    const latest = await env.ORDERS_DB.prepare("SELECT * FROM orders WHERE order_id = ? LIMIT 1").bind(orderId).first();
    if (latest.meta_status !== "SENT" && latest.meta_status !== "SKIPPED") {
      const metaStatus = await sendMetaPurchase(env, latest, orderId, Number(record.amount), record.currency, customer.customer_phone || record.customer_phone);
      await env.ORDERS_DB.prepare("UPDATE orders SET meta_status = ?, updated_at = datetime('now') WHERE order_id = ?").bind(metaStatus, orderId).run();
    }
  } catch (error) {
    failed = true;
    console.error("Meta Purchase event processing failed", orderId, error);
  }

  // A non-2xx response invites Cashfree to retry. Existing sent states prevent duplicate work.
  return failed ? new Response("retry processing", { status: 500 }) : new Response("ok", { status: 200 });
}

