// GET /api/verify-order?order_id=...
// The customer-facing page never decides payment success from the URL alone.
import { json, fetchCashfreeOrder, validOrderId, amountMatches, makeDownloadUrl, maskEmail, fetchCashfreePayments } from "../_lib/commerce.js";
import { clientIp, countHit } from "../_lib/ratelimit.js";
import { getProductById } from "../_lib/products.js";
import { sendDownloadEmail } from "../_lib/email.js";

// The support contact of the product that was bought (not the store-wide one).
async function supportFor(env, productId) {
  const p = await getProductById(env, productId);
  return p ? { email: p.email || "", whatsapp: String(p.whatsapp || "").replace(/\D/g, "") } : null;
}

export async function onRequestGet({ request, env }) {
  if (!env.ORDERS_DB) return json({ paid: false, status: "ORDER_STORAGE_NOT_CONFIGURED" }, 503);
  const orderId = new URL(request.url).searchParams.get("order_id");
  if (!validOrderId(orderId)) return json({ paid: false, status: "INVALID_ORDER_ID" }, 400);
  if ((await countHit(env, "verify:" + clientIp(request), 600)) > 60) return json({ paid: false, status: "TOO_MANY_REQUESTS" }, 429);

  let record;
  try {
    record = await env.ORDERS_DB.prepare("SELECT * FROM orders WHERE order_id = ? LIMIT 1").bind(orderId).first();
  } catch (error) {
    console.error("Order database lookup failed", error);
    return json({ paid: false, status: "ORDER_LOOKUP_FAILED" }, 503);
  }
  if (!record) return json({ paid: false, status: "ORDER_NOT_FOUND" }, 404);

  let cashfreeOrder;
  try { cashfreeOrder = await fetchCashfreeOrder(env, orderId); }
  catch (error) {
    console.error("Cashfree verification failed", error.status || "network", error.message);
    return json({ paid: false, status: "PAYMENT_STATUS_TEMPORARILY_UNAVAILABLE" }, 502);
  }

  if (!amountMatches(cashfreeOrder.order_amount, record.amount) || (cashfreeOrder.order_currency || "INR") !== record.currency) {
    console.error("Cashfree and local order mismatch", orderId);
    return json({ paid: false, status: "ORDER_AMOUNT_MISMATCH" }, 409);
  }
  if (cashfreeOrder.order_status !== "PAID") {
    const failure = await failureReason(env, orderId, cashfreeOrder.order_status);
    if (failure) return json({ paid: false, status: "FAILED", reason: failure, productSlug: (await productTracking(env, record.product_id)).slug || "" });
    return json({ paid: false, status: String(cashfreeOrder.order_status || "PENDING") });
  }

  try {
    await env.ORDERS_DB.prepare("UPDATE orders SET status = 'PAID', paid_at = COALESCE(paid_at, datetime('now')), updated_at = datetime('now') WHERE order_id = ?").bind(orderId).run();
    const downloadUrl = await makeDownloadUrl(env, orderId);
    try {
    const rec = await env.ORDERS_DB.prepare("SELECT * FROM orders WHERE order_id = ? LIMIT 1").bind(orderId).first();
    if (rec && rec.email_status !== "SENT") {
      const url = await makeDownloadUrl(env, orderId);
      await sendDownloadEmail(env, rec, orderId, url);
      await env.ORDERS_DB.prepare("UPDATE orders SET email_status = 'SENT', updated_at = datetime('now') WHERE order_id = ?").bind(orderId).run();
    }
  } catch (error) { console.error("Download email from verify failed", orderId, error); }
  return json({
      paid: true,
      amount: record.amount,
      currency: record.currency,
      download_url: downloadUrl,
      email_hint: maskEmail(record.customer_email),
      support: await supportFor(env, record.product_id), ...(await productTracking(env, record.product_id))
    });
  } catch (error) {
    console.error("Could not prepare verified download", error);
    return json({ paid: false, status: "DELIVERY_NOT_READY" }, 503);
  }
}


// v70: product's own Meta pixel ID (valid digits only), so the thank-you page tracks the purchase with the right pixel.
async function productTracking(env, productId){
  try{
    const p = await getProductById(env, productId);
    const pixel = String((p && p.pixelId) || "");
    return {
      pixelId: /^\d{5,20}$/.test(pixel) ? pixel : "",
      productId: String(productId || ""),
      productName: (p && p.name) ? String(p.name) : "",
      slug: (p && p.slug) ? String(p.slug) : ""
    };
  }catch(_){ return {pixelId:"", productId:String(productId||""), productName:"",slug:""}; }
}

// v72: turn Cashfree's attempt history into a clear reason. Returns "" while a payment is still possible or pending.
async function failureReason(env, orderId, orderStatus){
  const status = String(orderStatus || "").toUpperCase();
  if (["EXPIRED", "TERMINATED", "TERMINATION_REQUESTED", "CANCELLED"].includes(status)) return "The payment window expired or was cancelled.";
  try{
    const attempts = await fetchCashfreePayments(env, orderId);
    if (!attempts.length) return "";
    // Evaluate the newest attempt only. Older failed attempts must not keep a
    // later in-progress retry pending forever, and a failed attempt must not
    // mark an order failed if a newer attempt is still pending.
    const sorted = [...attempts].sort((a,b) => {
      const ta = Date.parse(a.payment_time || a.payment_completion_time || a.created_at || "") || 0;
      const tb = Date.parse(b.payment_time || b.payment_completion_time || b.created_at || "") || 0;
      return tb - ta;
    });
    const latest = sorted[0] || {};
    const latestStatus = String(latest.payment_status || "").toUpperCase();
    if (["SUCCESS", "PENDING", "NOT_ATTEMPTED", "PROCESSING"].includes(latestStatus)) return "";
    if (latestStatus === "USER_DROPPED") return "You closed the payment page before completing the payment.";
    if (latestStatus === "FAILED" || latestStatus === "CANCELLED" || latestStatus === "VOID") {
      const message = String(latest.payment_message || latest.error_details?.error_description || latest.error_details?.error_reason || "").trim();
      return message ? "Payment failed: " + message.slice(0, 160) : "Payment failed. Please try again.";
    }
    return "";
  }catch(error){
    console.error("Cashfree payment attempts lookup failed", error.status || "network", error.message);
    return "";
  }
}
