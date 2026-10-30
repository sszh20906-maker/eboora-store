// Product catalog. Each product has its own link (slug), price, file, cover and Meta pixel.
// The first product is created automatically from the old single-store settings, so existing data keeps working.
import { readMedia, readStoredConfig } from "./settings.js";

export const DEFAULT_PRODUCT_ID = "eboora-product";
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MEDIA_FIELDS = ["coverKey", "coverType", "fileKey", "fileName", "fileSize", "fileType"];
const COLUMNS = "id, slug, status, data, created_at, updated_at";

export const slugify = (text) => String(text ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export function pickMedia(data) {
  const out = {};
  for (const key of MEDIA_FIELDS) if (data && data[key] !== undefined && data[key] !== null) out[key] = data[key];
  return out;
}

function parseRow(row) {
  if (!row) return null;
  return { ...JSON.parse(row.data || "{}"), id: row.id, slug: row.slug, status: row.status, created_at: row.created_at, updated_at: row.updated_at };
}

export async function writeProduct(env, product) {
  const { id, slug, status, created_at, updated_at, ...data } = product;
  await env.ORDERS_DB.prepare(
    "INSERT INTO products (id, slug, status, data, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now')) ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, status = excluded.status, data = excluded.data, updated_at = excluded.updated_at"
  ).bind(id, slug, status, JSON.stringify(data)).run();
}

export async function slugTaken(env, slug, exceptId) {
  const row = await env.ORDERS_DB.prepare("SELECT id FROM products WHERE slug = ? AND id != ? LIMIT 1").bind(slug, exceptId || "").first();
  return Boolean(row);
}

export async function uniqueSlug(env, base, exceptId) {
  let candidate = base || "product";
  for (let i = 2; i < 50 && (await slugTaken(env, candidate, exceptId)); i++) candidate = `${base}-${i}`;
  return candidate;
}

// Turns the old single-store settings into the first product (only once).
async function migrateLegacy(env) {
  const exists = await env.ORDERS_DB.prepare("SELECT id FROM products WHERE id = ? LIMIT 1").bind(DEFAULT_PRODUCT_ID).first();
  if (exists) return;
  const legacy = await readStoredConfig(env);
  if (!legacy?.productName) return;
  const media = (await readMedia(env)) || {};
  const slug = await uniqueSlug(env, slugify(legacy.productName) || "product", DEFAULT_PRODUCT_ID);
  await writeProduct(env, { ...legacy, ...pickMedia(media), id: DEFAULT_PRODUCT_ID, slug, status: "published" });
}

export async function getProductById(env, id) {
  if (!env.ORDERS_DB || !id) return null;
  await migrateLegacy(env);
  const row = await env.ORDERS_DB.prepare(`SELECT ${COLUMNS} FROM products WHERE id = ? LIMIT 1`).bind(id).first();
  return parseRow(row);
}

export async function getProductBySlug(env, slug) {
  if (!env.ORDERS_DB || !slug) return null;
  await migrateLegacy(env);
  const row = await env.ORDERS_DB.prepare(`SELECT ${COLUMNS} FROM products WHERE slug = ? LIMIT 1`).bind(slug).first();
  return parseRow(row);
}

export async function listProducts(env, { publishedOnly = false } = {}) {
  await migrateLegacy(env);
  const where = publishedOnly ? " WHERE status = 'published'" : "";
  const result = await env.ORDERS_DB.prepare(`SELECT ${COLUMNS} FROM products${where} ORDER BY created_at DESC`).all();
  return (result.results || []).map(parseRow);
}

export async function countOrders(env, id) {
  const row = await env.ORDERS_DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE product_id = ?").bind(id).first();
  return Number(row?.n) || 0;
}

export async function deleteProductRow(env, id) {
  await env.ORDERS_DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
}

export function coverUrl(p) {
  return p.coverKey
    ? `/api/media/product/${encodeURIComponent(p.id)}?v=${encodeURIComponent(p.updated_at || "1")}`
    : (p.coverImage || "/assets/cover.svg");
}

// What the public page may see: no storage keys, no internal ids.
export function publicProduct(p) {
  const out = { ...p, productId: p.id, coverImage: coverUrl(p) };
  for (const key of ["coverKey", "coverType", "fileKey", "fileName", "fileSize", "fileType", "id", "created_at"]) delete out[key];
  return out;
}
