// GET /api/products/{slug} - one published product's landing page details (no secrets, no storage keys).
import { json } from "../../_lib/commerce.js";
import { getProductBySlug, publicProduct } from "../../_lib/products.js";

export async function onRequestGet({ params, env }) {
  if (!env.ORDERS_DB) return json({ error: "Store is not connected yet." }, 503);
  const product = await getProductBySlug(env, String(params.slug || "").toLowerCase());
  if (!product || product.status !== "published") return json({ error: "This product is not available." }, 404);
  return json(publicProduct(product));
}
