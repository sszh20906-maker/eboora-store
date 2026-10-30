// POST /api/admin/upload?id=<product>&kind=cover|file   - uploads a product's cover or file into private storage.
// DELETE /api/admin/upload?id=<product>&kind=cover|file - removes it from storage and from the product.
import { json } from "../../_lib/commerce.js";
import { requireAdmin } from "../../_lib/admin.js";
import { getProductById, writeProduct } from "../../_lib/products.js";

const MB = 1024 * 1024;
const RULES = {
  cover: { max: 2 * MB, types: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } },
  file: {
    max: 50 * MB,
    types: {
      "application/pdf": "pdf", "application/zip": "zip", "application/x-zip-compressed": "zip", "application/epub+zip": "epub",
      "video/mp4": "mp4", "audio/mpeg": "mp3",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
      "image/jpeg": "jpg", "image/png": "png"
    }
  }
};

// Counts bytes while reading, so an oversized upload stops early and never fills memory.
async function readLimited(stream, max) {
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.byteLength; }
  return out;
}

const cleanName = (name) => String(name || "download").replace(/[^A-Za-z0-9 ._-]/g, "_").replace(/\s+/g, " ").trim().slice(0, 100) || "download";

export async function onRequestPost({ request, env }) {
  const denied = await requireAdmin(request, env, { binary: true });
  if (denied) return denied;
  if (!env.PRODUCTS_BUCKET) return json({ error: "File storage is not connected yet (R2 bucket PRODUCTS_BUCKET)." }, 503);

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const rule = RULES[kind];
  if (!rule) return json({ error: "Upload type must be cover or file." }, 400);
  const product = await getProductById(env, url.searchParams.get("id") || "");
  if (!product) return json({ error: "Product not found. Pehle product save karo." }, 404);

  const type = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  const ext = rule.types[type];
  if (!ext) {
    return json({ error: kind === "cover" ? "Cover JPG, PNG ya WebP honi chahiye." : "Is file type ki ijaazat nahi hai. PDF, ZIP, EPUB, MP4, MP3, DOCX, XLSX, JPG ya PNG upload karo." }, 415);
  }
  if (!request.body) return json({ error: "Empty upload." }, 400);
  const bytes = await readLimited(request.body, rule.max);
  if (!bytes) return json({ error: `File bahut badi hai. Maximum ${rule.max / MB} MB.` }, 413);
  if (!bytes.byteLength) return json({ error: "Empty file." }, 400);

  const original = cleanName(decodeURIComponent(request.headers.get("X-File-Name") || "download"));
  const base = original.replace(/\.[^.]+$/, "") || "download";
  const key = `${kind === "cover" ? "covers" : "files"}/${product.id}/${crypto.randomUUID()}.${ext}`;

  try {
    await env.PRODUCTS_BUCKET.put(key, bytes, { httpMetadata: { contentType: type } });
  } catch (error) {
    console.error("Storage upload failed", kind, error);
    return json({ error: "Upload could not be saved. Please try again." }, 503);
  }

  const previousKey = kind === "cover" ? product.coverKey : product.fileKey;
  const updates = kind === "cover"
    ? { coverKey: key, coverType: type }
    : { fileKey: key, fileName: `${base}.${ext}`, fileSize: bytes.byteLength, fileType: type };
  try {
    await writeProduct(env, { ...product, ...updates });
  } catch (error) {
    console.error("Product media save failed", error);
    await env.PRODUCTS_BUCKET.delete(key).catch(() => {});
    return json({ error: "Upload could not be saved. Please try again." }, 503);
  }
  // A replaced file is removed from storage, so nothing stale stays behind.
  if (previousKey && previousKey !== key) await env.PRODUCTS_BUCKET.delete(previousKey).catch((e) => console.error("Old file cleanup failed", e));
  return json({ ok: true, product: await getProductById(env, product.id) }, 201);
}

export async function onRequestDelete({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  if (!env.PRODUCTS_BUCKET) return json({ error: "File storage is not connected yet (R2 bucket PRODUCTS_BUCKET)." }, 503);

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  if (kind !== "cover" && kind !== "file") return json({ error: "Upload type must be cover or file." }, 400);
  const product = await getProductById(env, url.searchParams.get("id") || "");
  if (!product) return json({ error: "Product not found." }, 404);

  const key = kind === "cover" ? product.coverKey : product.fileKey;
  const next = { ...product };
  if (kind === "cover") {
    delete next.coverKey;
    delete next.coverType;
  } else {
    delete next.fileKey;
    delete next.fileName;
    delete next.fileSize;
    delete next.fileType;
  }
  try {
    await writeProduct(env, next);
  } catch (error) {
    console.error("Product media removal failed", error);
    return json({ error: "Could not remove. Please try again." }, 503);
  }
  if (key) await env.PRODUCTS_BUCKET.delete(key).catch((e) => console.error("Storage delete failed", e));
  return json({ ok: true, product: await getProductById(env, product.id) });
}
