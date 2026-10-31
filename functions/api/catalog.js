// GET /api/catalog - the public list of published products (the store front page).
import { json } from "../_lib/commerce.js";
import { listProducts, coverUrl } from "../_lib/products.js";

export async function onRequestGet({ env }) {
  if (!env.ORDERS_DB) return json({ products: [] });
  const rows = await listProducts(env, { publishedOnly: true });
  return json({
    products: rows.map((p) => ({
      slug: p.slug,
      productId: p.id,
      name: p.productName,
      eyebrow: p.eyebrow,
      headline: p.headline,
      price: p.price,
      mrp: p.mrp || 0,
      currency: p.currency || "INR",
      coverImage: coverUrl(p),
      videoUrl: p.videoUrl || ""
    }))
  });
}
