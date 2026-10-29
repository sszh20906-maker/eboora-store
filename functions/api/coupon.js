// GET /api/coupon?code=... - checks a discount code and returns the discounted price. Nothing is reserved here.
import { json, safeAmount } from "../_lib/commerce.js";
import { readStoredConfig } from "../_lib/settings.js";
import { clientIp, countHit } from "../_lib/ratelimit.js";
import { quoteCoupon } from "../_lib/coupons.js";

export async function onRequestGet({ request, env }) {
  if (!env.ORDERS_DB) return json({ valid: false, error: "Coupons are not available right now." }, 503);
  if ((await countHit(env, "coupon-check:" + clientIp(request), 600)) > 60) {
    return json({ valid: false, error: "Too many attempts. Please wait a few minutes." }, 429);
  }
  const stored = await readStoredConfig(env);
  const price = safeAmount(stored?.price ?? env.PRODUCT_PRICE_INR);
  if (price === null) return json({ valid: false, error: "The product price is not set." }, 503);
  const quote = await quoteCoupon(env, new URL(request.url).searchParams.get("code") || "", price);
  if (!quote.valid) return json({ valid: false, error: quote.error });
  return json({ valid: true, code: quote.code, label: quote.label, price, finalPrice: quote.finalPrice });
}
