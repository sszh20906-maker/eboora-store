// GET /api/coupon?code=...&product=... - checks a discount code for one product and returns the discounted price. Nothing is reserved here.
import { json, safeAmount } from "../_lib/commerce.js";
import { readStoredConfig } from "../_lib/settings.js";
import { clientIp, countHit } from "../_lib/ratelimit.js";
import { quoteCoupon } from "../_lib/coupons.js";
import { DEFAULT_PRODUCT_ID, getProductById } from "../_lib/products.js";

export async function onRequestGet({ request, env }) {
  if (!env.ORDERS_DB) return json({ valid: false, error: "Coupons are not available right now." }, 503);
  if ((await countHit(env, "coupon-check:" + clientIp(request), 600)) > 60) {
    return json({ valid: false, error: "Too many attempts. Please wait a few minutes." }, 429);
  }
  const url = new URL(request.url);
  const productId = url.searchParams.get("product") || DEFAULT_PRODUCT_ID;
  let product = await getProductById(env, productId);
  if (!product && productId === DEFAULT_PRODUCT_ID) {
    const stored = await readStoredConfig(env);
    product = { id: DEFAULT_PRODUCT_ID, status: "published", price: stored?.price ?? env.PRODUCT_PRICE_INR };
  }
  if (!product || product.status !== "published") return json({ valid: false, error: "This product is not available." }, 404);
  const price = safeAmount(product.price);
  if (price === null) return json({ valid: false, error: "The product price is not set." }, 503);
  const quote = await quoteCoupon(env, url.searchParams.get("code") || "", price);
  if (!quote.valid) return json({ valid: false, error: quote.error });
  return json({ valid: true, code: quote.code, label: quote.label, price, finalPrice: quote.finalPrice });
}
