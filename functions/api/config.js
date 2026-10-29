// GET /api/config - public storefront settings saved by the owner (contains no secrets).
import { json } from "../_lib/commerce.js";
import { readStoredConfig } from "../_lib/settings.js";

export async function onRequestGet({ env }) {
  const config = await readStoredConfig(env);
  if (!config) return json({ configured: false }, 404);
  return json({ ...config, productId: env.PRODUCT_ID || "eboora-product" });
}
