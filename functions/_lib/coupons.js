// Discount codes. The browser only sends a code; the discount is always calculated here.
export const COUPON_CODE_RE = /^[A-Z0-9_-]{3,20}$/;
export const normalizeCode = (code) => String(code ?? "").trim().toUpperCase();

export function discountFor(coupon, price) {
  const raw = coupon.type === "percent" ? price * (Number(coupon.value) / 100) : Number(coupon.value);
  const capped = Math.min(raw, price - 1); // a coupon can never bring the price below Rs 1
  return Math.max(0, Math.round(capped * 100) / 100);
}

export function couponProblem(row, today = new Date().toISOString().slice(0, 10)) {
  if (!row || !Number(row.active)) return "This code is not valid.";
  if (row.expires_at && String(row.expires_at) < today) return "This code has expired.";
  if (row.max_uses != null && Number(row.used_count) >= Number(row.max_uses)) return "This code has been fully used.";
  return null;
}

export async function findCoupon(env, code) {
  const c = normalizeCode(code);
  if (!COUPON_CODE_RE.test(c)) return null;
  const row = await env.ORDERS_DB.prepare("SELECT code, type, value, max_uses, used_count, expires_at, active FROM coupons WHERE code = ? LIMIT 1").bind(c).first();
  return row || null;
}

export async function quoteCoupon(env, code, price) {
  const row = await findCoupon(env, code);
  const problem = couponProblem(row);
  if (problem) return { valid: false, error: problem };
  const discount = discountFor(row, price);
  if (discount <= 0) return { valid: false, error: "This code does not reduce the price." };
  return {
    valid: true,
    code: row.code,
    discount,
    finalPrice: Math.round((price - discount) * 100) / 100,
    label: row.type === "percent" ? `${Number(row.value)}% off` : `₹${Number(row.value)} off`
  };
}

// Counts a coupon once, when its order is confirmed paid. Duplicate webhooks cannot count it twice.
export async function redeemCoupon(env, orderId) {
  const claim = await env.ORDERS_DB.prepare("INSERT OR IGNORE INTO order_notifications (order_id, kind) VALUES (?, 'coupon_redeemed')").bind(orderId).run();
  if (claim?.meta?.changes !== 1) return;
  const link = await env.ORDERS_DB.prepare("SELECT code FROM order_discounts WHERE order_id = ? LIMIT 1").bind(orderId).first();
  if (!link) return;
  await env.ORDERS_DB.prepare("UPDATE coupons SET used_count = used_count + 1 WHERE code = ?").bind(link.code).run();
}
