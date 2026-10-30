// GET /api/media/product/{id} - a published product's cover image. Product files are never served here.
import { getProductById } from "../../../_lib/products.js";
import { readSetting } from "../../../_lib/settings.js";

export async function onRequestGet({ params, env }) {
  const product = await getProductById(env, String(params.id || ""));
  if (!product || product.status !== "published") return new Response("Not found", { status: 404 });
  if (product.coverStorage === "d1") {
    const stored = await readSetting(env, `cover_d1_${product.id}`);
    if (!stored || !["image/png", "image/jpeg", "image/webp"].includes(stored.type) || !stored.base64) return new Response("Not found", { status: 404 });
    const binary = atob(stored.base64);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new Response(bytes, { headers: { "Content-Type": stored.type, "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" } });
  }
  if (!product.coverKey || !env.PRODUCTS_BUCKET) {
    return new Response("Not found", { status: 404 });
  }
  const object = await env.PRODUCTS_BUCKET.get(product.coverKey);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: { "Content-Type": product.coverType || "image/jpeg", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" }
  });
}
