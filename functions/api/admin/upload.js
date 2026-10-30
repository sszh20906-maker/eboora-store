// POST /api/admin/upload?id=<product>&kind=cover|file   - uploads a product's cover or file into private storage.
// DELETE /api/admin/upload?id=<product>&kind=cover|file - removes it from storage and from the product.
import { json } from "../../_lib/commerce.js";
import { requireAdmin } from "../../_lib/admin.js";
import { getProductById, writeProduct } from "../../_lib/products.js";
import { writeSetting } from "../../_lib/settings.js";

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
  // Covers can be stored in D1 when R2 is unavailable; large product files still need R2 or Drive.

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const rule = RULES[kind];
  if (!rule) return json({ error: "Upload type must be cover or file." }, 400);
  if (kind === "file" && !env.PRODUCTS_BUCKET) return json({ error: "Product files ke liye Google Drive link use karo (R2 connected nahi hai)." }, 503);
  const product = await getProductById(env, url.searchParams.get("id") || "");
  if (!product) return json({ error: "Product not found. Pehle product save karo." }, 404);

  const type = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  const ext = rule.types[type];
  if (!ext) {
    return json({ error: kind === "cover" ? "Cover JPG, PNG ya WebP honi chahiye." : "Is file type ki ijaazat nahi hai. PDF, ZIP, EPUB, MP4, MP3, DOCX, XLSX, JPG ya PNG upload karo." }, 415);
  }
  if (!request.body) return json({ error: "Empty upload." }, 400);
  const bytes = await readLimited(request.body, kind === "cover" && !env.PRODUCTS_BUCKET ? 350 * 1024 : rule.max);
  if (!bytes) return json({ error: `File bahut badi hai. Maximum ${rule.max / MB} MB.` }, 413);
  if (!bytes.byteLength) return json({ error: "Empty file." }, 400);

  if (kind === "cover" && !env.PRODUCTS_BUCKET) {
    // D1's store_settings table stores a small base64 cover; no new binding or credit card needed.
    // Validate signatures rather than trusting the browser-provided MIME header.
    const valid = type === "image/png" ? bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
      : type === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : type === "image/webp" ? String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP" : false;
    if (!valid) return json({ error: "Image file invalid hai." }, 415);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const oldKey = product.coverKey;
    try {
      await writeSetting(env, `cover_d1_${product.id}`, { type, base64: btoa(binary) });
      const next = { ...product, coverStorage: "d1", coverType: type };
      delete next.coverKey;
      await writeProduct(env, next);
      if (oldKey && env.PRODUCTS_BUCKET) await env.PRODUCTS_BUCKET.delete(oldKey).catch((e) => console.error("Old cover cleanup failed", e));
      return json({ ok: true, product: await getProductById(env, product.id) }, 201);
    } catch (error) { console.error("D1 cover upload failed", error); return json({ error: "D1 cover save nahi hua. Try again." }, 503); }
  }

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
    ? { coverKey: key, coverType: type, coverStorage: "r2" }
    : { fileKey: key, fileName: `${base}.${ext}`, fileSize: bytes.byteLength, fileType: type };
  try {
    await writeProduct(env, { ...product, ...updates });
  } catch (error) {
    console.error("Product media save failed", error);
    await env.PRODUCTS_BUCKET.delete(key).catch(() => {});
    return json({ error: "Upload could not be saved. Please try again." }, 503);
  }
  // A replaced file is removed from storage, so nothing stale stays behind.
  if (kind === "cover") {
    // An earlier D1 cover must not remain orphaned after switching to R2.
    await env.ORDERS_DB.prepare("DELETE FROM store_settings WHERE key = ?").bind(`cover_d1_${product.id}`).run().catch((e) => console.error("Old D1 cover cleanup failed", e));
  }
  if (previousKey && previousKey !== key) await env.PRODUCTS_BUCKET.delete(previousKey).catch((e) => console.error("Old file cleanup failed", e));
  return json({ ok: true, product: await getProductById(env, product.id) }, 201);
}

export async function onRequestDelete({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  // D1 covers can be removed without an R2 binding.

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  if (kind !== "cover" && kind !== "file") return json({ error: "Upload type must be cover or file." }, 400);
  if (kind === "file" && !env.PRODUCTS_BUCKET) return json({ error: "R2 file storage unavailable." }, 503);
  const product = await getProductById(env, url.searchParams.get("id") || "");
  if (!product) return json({ error: "Product not found." }, 404);

  const key = kind === "cover" ? product.coverKey : product.fileKey;
  const next = { ...product };
  if (kind === "cover") {
    delete next.coverKey;
    delete next.coverType;
    delete next.coverStorage;
    // Cleanup occurs only after the product record has been updated successfully.
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
  if (kind === "cover") {
    await env.ORDERS_DB.prepare("DELETE FROM store_settings WHERE key = ?").bind(`cover_d1_${product.id}`).run().catch((e) => console.error("D1 cover cleanup failed", e));
  }
  if (key && env.PRODUCTS_BUCKET) await env.PRODUCTS_BUCKET.delete(key).catch((e) => console.error("Storage delete failed", e));
  return json({ ok: true, product: await getProductById(env, product.id) });
}
