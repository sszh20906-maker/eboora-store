// GET /api/download?order_id=...&exp=...&token=...
// Serves a private R2 object only when the signed link is valid, unexpired, and the local order and Cashfree payment match.
import { json, fetchCashfreeOrder, validOrderId, amountMatches, makeDownloadToken, constantTimeEqual } from "../_lib/commerce.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("order_id");
  const providedToken = url.searchParams.get("token") || "";
  const expiresAt = Number(url.searchParams.get("exp"));
  if (!validOrderId(orderId) || !providedToken || !Number.isInteger(expiresAt)) {
    return json({ error: "This download link is incomplete. Please open the link from your purchase email or the thank-you page." }, 400);
  }
  if (!env.ORDERS_DB || !env.PRODUCTS_BUCKET || !env.PRODUCT_FILE_KEY || !env.DOWNLOAD_TOKEN_SECRET) {
    return json({ error: "Secure download delivery is not configured. Please contact support." }, 503);
  }

  let expectedToken;
  try { expectedToken = await makeDownloadToken(env, orderId, expiresAt); }
  catch (error) { console.error("Download token configuration error", error); return json({ error: "Secure download delivery is not configured." }, 503); }
  if (!constantTimeEqual(providedToken, expectedToken)) {
    return json({ error: "This download link is invalid. Please use the original link." }, 403);
  }
  if (expiresAt < Math.floor(Date.now() / 1000)) {
    return json({ error: "This download link has expired. Open your purchase confirmation page to get a fresh link." }, 410);
  }

  let record;
  try { record = await env.ORDERS_DB.prepare("SELECT * FROM orders WHERE order_id = ? LIMIT 1").bind(orderId).first(); }
  catch (error) { console.error("Download database lookup failed", error); return json({ error: "Download is temporarily unavailable. Please try again." }, 503); }
  if (!record || record.product_id !== String(env.PRODUCT_ID || "eboora-product")) return json({ error: "No matching purchase was found for this download." }, 404);

  let order;
  try { order = await fetchCashfreeOrder(env, orderId); }
  catch (error) { console.error("Download payment verification failed", error.status || "network", error.message); return json({ error: "We could not verify the payment right now. Please try again in a minute." }, 502); }
  if (order.order_status !== "PAID" || !amountMatches(order.order_amount, record.amount) || (order.order_currency || "INR") !== record.currency) {
    return json({ error: "Payment has not been confirmed for this order yet. If money was deducted, please contact support." }, 403);
  }

  try {
    await env.ORDERS_DB.prepare("UPDATE orders SET status = 'PAID', paid_at = COALESCE(paid_at, datetime('now')), updated_at = datetime('now') WHERE order_id = ?").bind(orderId).run();
    const object = await env.PRODUCTS_BUCKET.get(env.PRODUCT_FILE_KEY);
    if (!object) return json({ error: "The product file is not available yet. Please contact support." }, 503);
    const filename = String(env.PRODUCT_FILENAME || "digital-product-download.zip").replace(/[\r\n"\\]/g, "").slice(0, 100) || "download.zip";
    const headers = new Headers({
      "Content-Type": object.httpMetadata?.contentType || "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    });
    if (object.size) headers.set("Content-Length", String(object.size));
    if (object.httpEtag) headers.set("ETag", object.httpEtag);
    return new Response(object.body, { status: 200, headers });
  } catch (error) {
    console.error("Private product download failed", error);
    return json({ error: "Download is temporarily unavailable. Please try again or contact support." }, 503);
  }
}
