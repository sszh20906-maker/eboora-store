// POST /api/cashfree-webhook
// Cashfree-signed payment webhook -> verified D1 order state -> private download email + Meta CAPI.
import { json, makeDownloadUrl, amountMatches, constantTimeEqual } from "../_lib/commerce.js";
import { readStoredConfig } from "../_lib/settings.js";
import { getProductById } from "../_lib/products.js";
import { redeemCoupon } from "../_lib/coupons.js";

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
  const product = (await getProductById(env, record.product_id))?.productName || env.PRODUCT_NAME || "your digital product";
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

// Owner alert for every confirmed sale. Sent once per order; if sending fails, the claim is released so a retry can send it.
async function sendOwnerSaleEmail(env, record, orderId, amount, currency, phone) {
  const to = env.OWNER_EMAIL || (await readStoredConfig(env))?.email;
  if (!to || !env.RESEND_API_KEY || !env.FROM_EMAIL) return;
  const product = (await getProductById(env, record.product_id))?.productName || env.PRODUCT_NAME || "your product";
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
<h2 style="margin:0 0 8px">New sale: ${esc(product)}</h2>
<p><strong>Amount:</strong> ${esc(currency)} ${esc(amount)}<br>
<strong>Buyer:</strong> ${esc(record.customer_name)}<br>
<strong>Email:</strong> ${esc(record.customer_email)}<br>
<strong>Phone:</strong> ${esc(phone)}<br>
<strong>Order ID:</strong> ${esc(orderId)}</p></div>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `owner-sale-${orderId}`
    },
    body: JSON.stringify({ from: env.FROM_EMAIL, to: [to], subject: `New sale: ${product} (${orderId})`, html })
  });
  if (!response.ok) throw new Error("Owner alert email failed with status " + response.status);
}

const sha256 = async (value) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

async function sendMetaPurchase(env, record, orderId, amount, currency, customerPhone) {
  // Pixel ID comes from the owner's settings; the access token stays a Cloudflare secret (META_CAPI_TOKEN).
  const product = await getProductById(env, record.product_id);
  const productPixel = product?.pixelId && product.pixelId !== "YOUR_PIXEL_ID" ? product.pixelId : "";
  const stored = await readStoredConfig(env);
  const pixelId = String(productPixel || stored?.pixelId || env.META_PIXEL_ID || "").trim();
  if (!/^\d{5,20}$/.test(pixelId) || !env.META_CAPI_TOKEN) return "SKIPPED";
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
  const response = await fetch(`https://graph.facebook.com/v26.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(env.META_CAPI_TOKEN)}`, {
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

// Timestamp is signed by Cashfree. Accept milliseconds or seconds and allow retries
// for up to 24 hours; payment-id deduplication also protects against replay.
function freshWebhookTimestamp(value, now = Date.now()) {
  if (!/^\d{10,13}$/.test(String(value || ""))) return false;
  const number = Number(value);
  const ms = String(value).length === 10 ? number * 1000 : number;
  return Number.isFinite(ms) && ms <= now + 5 * 60_000 && ms >= now - 24 * 60 * 60_000;
}

// A failed *attempt* must not mark the whole order FAILED: a customer can
// retry with a different payment attempt and still pay successfully.
async function acknowledgeFailedAttempt(env, body) {
  const orderId = String(body.data?.order?.order_id || "");
  if (!/^[A-Za-z0-9_-]{3,80}$/.test(orderId)) return new Response("missing order id", { status: 400 });
  if (!env.ORDERS_DB) return new Response("order storage unavailable", { status: 503 });
  return new Response("ok", { status: 200 });
}

export async function onRequestPost({ request, env }) {
  const rawBody = await request.text();
  if (rawBody.length > 256_000) return new Response("payload too large", { status: 413 });
  const webhookTimestamp = request.headers.get("x-webhook-timestamp");
  // Requests without a signature (e.g. Cashfree's endpoint test) get a 200 and are never processed.
  if (!request.headers.get("x-webhook-signature")) return new Response("ok: unsigned request ignored", { status: 200 });
  const valid = await validCashfreeSignature(
    rawBody,
    webhookTimestamp,
    request.headers.get("x-webhook-signature"),
    (env.CASHFREE_WEBHOOK_SECRET || env.CASHFREE_SECRET_KEY)
  );
  if (!valid) return new Response("bad signature", { status: 401, headers: { "Cache-Control": "no-store" } });
  if (!freshWebhookTimestamp(webhookTimestamp)) return new Response("stale timestamp", { status: 401 });

  let body;
  try { body = JSON.parse(rawBody); }
  catch { return new Response("bad json", { status: 400 }); }
  if (body.type === "PAYMENT_FAILED_WEBHOOK") return acknowledgeFailedAttempt(env, body);
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

  const paymentId = String(payment.cf_payment_id ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(paymentId)) return new Response("missing payment id", { status: 400 });

  const paidAmount = payment.payment_amount ?? cashfreeOrder.order_amount;
  const currency = payment.payment_currency || cashfreeOrder.order_currency || "INR";
  if (!amountMatches(paidAmount, record.amount) || currency !== record.currency) {
    console.error("Webhook payment amount/currency mismatch", orderId);
    return new Response("amount mismatch", { status: 400 });
  }

  // A Cashfree payment ID must never be applied to two different orders.
  // Requires migration v32-payment-security.sql before deploying this code.
  try {
    const claim = await env.ORDERS_DB.prepare(
      "INSERT OR IGNORE INTO payment_receipts (cf_payment_id, order_id) VALUES (?, ?)"
    ).bind(paymentId, orderId).run();
    if (claim?.meta?.changes !== 1) {
      const prior = await env.ORDERS_DB.prepare(
        "SELECT order_id FROM payment_receipts WHERE cf_payment_id = ?"
      ).bind(paymentId).first();
      if (!prior || prior.order_id !== orderId) {
        console.error("Payment ID reused for a different order", orderId);
        return new Response("payment conflict", { status: 409 });
      }
    }
  } catch (error) {
    console.error("Payment receipt storage unavailable", error);
    return new Response("payment storage unavailable", { status: 503 });
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

  // Owner alert: claim the order first so duplicate webhooks cannot send it twice.
  try {
    const claim = await env.ORDERS_DB.prepare("INSERT OR IGNORE INTO order_notifications (order_id, kind) VALUES (?, 'owner_sale')").bind(orderId).run();
    if (claim?.meta?.changes === 1) {
      try {
        await sendOwnerSaleEmail(env, record, orderId, Number(record.amount), record.currency, customer.customer_phone || record.customer_phone);
      } catch (error) {
        failed = true;
        console.error("Owner sale alert failed", orderId, error);
        await env.ORDERS_DB.prepare("DELETE FROM order_notifications WHERE order_id = ? AND kind = 'owner_sale'").bind(orderId).run();
      }
    }
  } catch (error) {
    console.error("Owner alert bookkeeping failed", orderId, error);
  }

  // Count a discount code once, now that the payment is confirmed.
  try {
    await redeemCoupon(env, orderId);
  } catch (error) {
    console.error("Coupon redemption bookkeeping failed", orderId, error);
  }

  // A non-2xx response invites Cashfree to retry. Existing sent states prevent duplicate work.
  return failed ? new Response("retry processing", { status: 500 }) : new Response("ok", { status: 200 });
}

