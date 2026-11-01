// POST /api/create-order
// Price, coupon and Cashfree credentials are decided on the server. The browser sends customer details, the product and an optional code.
import { json, cashfreeBase, cashfreeMode, hasCashfreeConfig, normalizePhone, safeAmount } from "../_lib/commerce.js";
import { readStoredConfig } from "../_lib/settings.js";
import { clientIp, countHit } from "../_lib/ratelimit.js";
import { quoteCoupon, normalizeCode } from "../_lib/coupons.js";
import { DEFAULT_PRODUCT_ID, getProductById } from "../_lib/products.js";

// v71: sites allowed to start a checkout. Payments work from these domains even if SITE_URL is stale.
const ALLOWED_SITES = ["https://eboora.shop", "https://www.eboora.shop", "https://eboora-store.pages.dev"];

export async function onRequestPost({ request, env }) {
  if (!hasCashfreeConfig(env)) return json({ error: "Payments are not configured yet. Please contact support." }, 503);
  if (!env.ORDERS_DB) return json({ error: "Order storage is not configured yet. Please contact support." }, 503);
  if ((await countHit(env, "checkout:" + clientIp(request), 600)) > 30) {
    return json({ error: "Too many checkout attempts. Please wait a few minutes and try again." }, 429);
  }
  if (!env.SITE_URL || !env.SITE_URL.startsWith("https://")) return json({ error: "The secure site URL is not configured." }, 503);

  // Prevent cross-origin sites from using this endpoint as an order-creation proxy.
  const origin = request.headers.get("Origin");
  try {
    const configuredSite = String(env.SITE_URL || "").replace(/\/$/, "");
    if (origin && !ALLOWED_SITES.includes(new URL(origin).origin) && (!configuredSite || new URL(origin).origin !== new URL(configuredSite).origin)) return json({ error: "Invalid request origin.", received: origin, expected: configuredSite }, 403);
  } catch { return json({ error: "Invalid site configuration." }, 503); }

  let input;
  try { input = await request.json(); } catch { return json({ error: "Please enter your checkout details and try again." }, 400); }
  if (!input || typeof input !== "object") return json({ error: "Please enter your checkout details and try again." }, 400);

  const customerName = String(input.customer_name || "").trim().replace(/\s+/g, " ").slice(0, 80);
  const customerEmail = String(input.customer_email || "").trim().toLowerCase().slice(0, 160);
  const customerPhone = normalizePhone(input.customer_phone);
  const emailOk = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(customerEmail);
  if (customerName.length < 2 || !emailOk || !customerPhone) {
    return json({ error: "Enter a valid name, email address and 10-digit Indian mobile number." }, 400);
  }
  if ((await countHit(env, "checkout-phone:" + customerPhone, 600)) > 5) {
    return json({ error: "Too many checkout attempts for this number. Please wait a few minutes and try again." }, 429);
  }

  // The product is looked up on the server; the browser only names it.
  const productId = String(input.product_id || DEFAULT_PRODUCT_ID).slice(0, 60);
  let product = await getProductById(env, productId);
  if (!product && productId === DEFAULT_PRODUCT_ID) {
    const stored = await readStoredConfig(env);
    product = { id: DEFAULT_PRODUCT_ID, status: "published", productName: stored?.productName || env.PRODUCT_NAME, price: stored?.price ?? env.PRODUCT_PRICE_INR };
  }
  if (!product || product.status !== "published") return json({ error: "This product is not available right now." }, 404);
  const listPrice = safeAmount(product.price);
  if (listPrice === null) return json({ error: "This product's price is not set correctly." }, 503);
  const productName = String(product.productName || env.PRODUCT_NAME || "Digital product").slice(0, 100);

  // Optional discount code, validated on the server.
  let amount = listPrice;
  let coupon = null;
  // Block a second purchase of the same product with the same email once it is already paid.
  if (env.ORDERS_DB) {
    const alreadyPaid = await env.ORDERS_DB.prepare("SELECT order_id FROM orders WHERE customer_email = ? AND product_id = ? AND status = 'PAID' LIMIT 1").bind(customerEmail, product.id).first();
    if (alreadyPaid) return json({ error: "Ye email se ye product already kharida ja chuka hai. Download link ke liye 'Lost your download link?' use karo." }, 409);
  }
  const couponCode = normalizeCode(input.coupon_code);
  if (couponCode) {
    const quote = await quoteCoupon(env, couponCode, listPrice);
    if (!quote.valid) return json({ error: quote.error }, 400);
    amount = quote.finalPrice;
    coupon = quote;
  }

  const orderId = `ck_${Date.now().toString(36)}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const customerId = `c_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const siteUrl = (origin && ALLOWED_SITES.includes(new URL(origin).origin)) ? new URL(origin).origin : String(env.SITE_URL).replace(/\/$/, "");
  const payload = {
    order_id: orderId,
    order_amount: amount,
    order_currency: env.PRODUCT_CURRENCY || "INR",
    customer_details: { customer_id: customerId, customer_name: customerName, customer_email: customerEmail, customer_phone: customerPhone },
    order_meta: {
      return_url: `${siteUrl}/thank-you.html?order_id={order_id}`,
      notify_url: `${siteUrl}/api/cashfree-webhook`
    },
    order_note: productName,
    order_tags: { product_id: product.id }
  };

  let cashfreeResponse;
  try {
    cashfreeResponse = await fetch(`${cashfreeBase(env)}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "x-client-id": env.CASHFREE_APP_ID,
        "x-client-secret": env.CASHFREE_SECRET_KEY,
        "x-api-version": env.CASHFREE_API_VERSION || "2026-01-01",
        "x-request-id": crypto.randomUUID()
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error("Cashfree create-order network error", error);
    return json({ error: "Cashfree could not be reached. Please try again." }, 502);
  }

  const result = await cashfreeResponse.json().catch(() => ({}));
  if (!cashfreeResponse.ok || !result.payment_session_id) {
    console.error("Cashfree create-order failed", cashfreeResponse.status, result.type || result.code || "unknown_error");
    return json({ error: "Cashfree could not create the payment session. Please try again in a moment." }, 502);
  }

  try {
    await env.ORDERS_DB.prepare(`
      INSERT INTO orders
        (order_id, product_id, amount, currency, customer_name, customer_email, customer_phone, status, email_status, meta_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'CREATED', 'PENDING', 'PENDING', datetime('now'), datetime('now'))
    `).bind(orderId, product.id, amount, payload.order_currency, customerName, customerEmail, customerPhone).run();
  } catch (error) {
    // Fail closed: no payment session without a local order record.
    console.error("Order database insert failed", error);
    return json({ error: "We could not save your order securely. Please contact support before trying again." }, 503);
  }

  if (coupon) {
    try {
      await env.ORDERS_DB.prepare("INSERT INTO order_discounts (order_id, code, original_amount, discount_amount) VALUES (?, ?, ?, ?)")
        .bind(orderId, coupon.code, listPrice, coupon.discount).run();
    } catch (error) {
      console.error("Could not record discount for order", orderId, error);
    }
  }

  return json({
    order_id: orderId,
    payment_session_id: result.payment_session_id,
    amount,
    original_amount: listPrice,
    currency: payload.order_currency,
    mode: cashfreeMode(env)
  }, 201);
}
