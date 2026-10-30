// GET /api/config - public storefront settings saved by the owner (contains no secrets).
import { json } from "../_lib/commerce.js";
import { readStoredConfig, readMedia } from "../_lib/settings.js";

export async function onRequestGet({ env }) {
  const config = await readStoredConfig(env);
  if (!config) return json({ configured: false }, 404);
  const media = await readMedia(env);
  const coverImage = media?.coverKey ? `/api/media/cover?v=${encodeURIComponent(media.updatedAt || "1")}` : config.coverImage;
  return json({ ...config, coverImage, productId: env.PRODUCT_ID || "eboora-product" });
}
