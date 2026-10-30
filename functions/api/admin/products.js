// Owner product manager: list, create/update, and delete (archive when orders exist).
import { json } from "../../_lib/commerce.js";
import { requireAdmin } from "../../_lib/admin.js";
import { validateConfig } from "../../_lib/settings.js";
import { SLUG_RE, slugify, listProducts, getProductById, slugTaken, writeProduct, deleteProductRow, countOrders, pickMedia, coverUrl } from "../../_lib/products.js";

const adminView = (p) => ({ ...p, coverUrl: p.coverKey ? coverUrl(p) : null, hasFile: Boolean(p.fileKey) });

export async function onRequestGet({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const rows = await listProducts(env);
  return json({ products: rows.map(adminView) });
}

export async function onRequestPost({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  let input;
  try { input = await request.json(); } catch { return json({ error: "Invalid data sent." }, 400); }

  const { errors, config } = validateConfig(input);
  if (errors.length) return json({ error: errors.join(" ") }, 400);

  const slug = slugify(input.slug || config.productName);
  if (!SLUG_RE.test(slug) || slug.length < 3) {
    return json({ error: "Link (URL) sirf chhote letters, numbers aur hyphen (-) se ban sakta hai, kam se kam 3 characters." }, 400);
  }
  const id = /^[a-z0-9-]{3,40}$/.test(String(input.id || "")) ? String(input.id) : `p-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  if (await slugTaken(env, slug, id)) return json({ error: "Ye link pehle se kisi aur product ka hai. Dusra link chunein." }, 409);

  const previous = await getProductById(env, id);
  const status = input.status === "draft" ? "draft" : "published";
  try {
    await writeProduct(env, { id, slug, status, ...config, ...pickMedia(previous || {}) });
  } catch (error) {
    console.error("Product save failed", error);
    return json({ error: "Product could not be saved. Please try again." }, 503);
  }
  const saved = await getProductById(env, id);
  return json({ ok: true, product: adminView(saved) }, previous ? 200 : 201);
}

export async function onRequestDelete({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get("id") || "";
  const product = await getProductById(env, id);
  if (!product) return json({ error: "Product not found." }, 404);

  // Products that already have orders are hidden, not deleted, so buyers keep their downloads.
  if ((await countOrders(env, id)) > 0) {
    await writeProduct(env, { ...product, status: "archived" });
    return json({ ok: true, archived: true, message: "Is product par orders hain, isliye ye hidden kar diya gaya. Buyers ke download chalte rahenge." });
  }
  await deleteProductRow(env, id);
  for (const key of [product.coverKey, product.fileKey]) {
    if (key && env.PRODUCTS_BUCKET) await env.PRODUCTS_BUCKET.delete(key).catch((e) => console.error("Storage delete failed", e));
  }
  return json({ ok: true, archived: false });
}
