// GET /api/media/product/{id} - a published product's cover image. Product files are never served here.
import { getProductById } from "../../../_lib/products.js";

export async function onRequestGet({ params, env }) {
  const product = await getProductById(env, String(params.id || ""));
  if (!product || product.status !== "published" || !product.coverKey || !env.PRODUCTS_BUCKET) {
    return new Response("Not found", { status: 404 });
  }
  const object = await env.PRODUCTS_BUCKET.get(product.coverKey);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: { "Content-Type": product.coverType || "image/jpeg", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" }
  });
}
