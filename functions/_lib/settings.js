// Storefront settings saved by the owner in D1 (table: store_settings).
import { safeAmount } from "./commerce.js";

const KEY = "store_config";

export async function readStoredConfig(env) {
  if (!env.ORDERS_DB) return null;
  try {
    const row = await env.ORDERS_DB.prepare("SELECT value FROM store_settings WHERE key = ? LIMIT 1").bind(KEY).first();
    return row ? JSON.parse(row.value) : null;
  } catch (error) {
    console.error("Settings read failed", error);
    return null;
  }
}

export async function writeStoredConfig(env, config) {
  await env.ORDERS_DB.prepare(
    "INSERT INTO store_settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
  ).bind(KEY, JSON.stringify(config)).run();
}

const clean = (value, max) => String(value ?? "").trim().slice(0, max);
const digits = (value) => String(value ?? "").replace(/\D/g, "");

export function validateDriveUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hostname !== "drive.google.com") return "";
    if (!(/^\/file\/d\/[a-zA-Z0-9_-]+\/?/.test(url.pathname) || url.pathname === "/open" || url.pathname === "/drive/folders" || /^\/drive\/folders\/[a-zA-Z0-9_-]+/.test(url.pathname))) return "";
    return url.toString().slice(0, 500);
  } catch { return ""; }
}

export function validateConfig(input) {
  const errors = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return { errors: ["Invalid data."], config: null };

  const productName = clean(input.productName, 100);
  const headline = clean(input.headline, 120);
  const description = clean(input.description, 2000);
  const email = clean(input.email, 160).toLowerCase();
  const price = safeAmount(input.price);
  const mrpInput = Number(input.mrp || 0);
  const mrp = mrpInput > 0 ? safeAmount(mrpInput) : 0;
  const whatsapp = digits(input.whatsapp);
  const pixel = digits(input.pixelId);
  const coverRaw = clean(input.coverImage, 300);
  const coverImage = coverRaw.startsWith("/") || coverRaw.startsWith("https://") ? coverRaw : "/assets/cover.svg";

  if (input.deliveryUrl && !validateDriveUrl(input.deliveryUrl)) errors.push("Enter a valid Google Drive sharing link.");
  if (!productName) errors.push("Product name is required.");
  if (!headline) errors.push("Headline is required.");
  if (!description) errors.push("Description is required.");
  if (price === null) errors.push("Price must be between ₹1 and ₹10,00,000.");
  if (mrpInput > 0 && mrp === null) errors.push("Original price is invalid.");
  if (mrp && price !== null && mrp <= price) errors.push("Original price must exceed the selling price or be left blank.");
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) errors.push("Enter a valid support email.");
  if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 15)) errors.push("WhatsApp must contain 10–15 digits including country code, or be left blank.");
  if (errors.length) return { errors, config: null };

  const benefits = (Array.isArray(input.benefits) ? input.benefits : [])
    .map((b) => ({ title: clean(b?.title, 100), description: clean(b?.description, 300) }))
    .filter((b) => b.title).slice(0, 12);
  const included = (Array.isArray(input.included) ? input.included : [])
    .map((x) => ({ title: clean(typeof x === "string" ? x : x?.title, 120) }))
    .filter((x) => x.title).slice(0, 20);
  const faqs = (Array.isArray(input.faqs) ? input.faqs : [])
    .map((f) => ({ question: clean(f?.question, 200), answer: clean(f?.answer, 1000) }))
    .filter((f) => f.question && f.answer).slice(0, 20);

  const reviews = (Array.isArray(input.reviews) ? input.reviews : [])
    .map((r) => ({ name: clean(r?.name, 60) || "Customer", text: clean(r?.text, 500) }))
    .filter((r) => r.text).slice(0, 10);

  const galleryInput = Array.isArray(input.galleryImages) ? input.galleryImages : String(input.galleryImages || '').split(/\r?\n/);
  const galleryImages = [];
  for (const raw of galleryInput) {
    const value = clean(raw, 500);
    if (!value) continue;
    try {
      const u = new URL(value);
      if (u.protocol !== 'https:' || u.username || u.password || u.port || !['http:','https:'].includes(u.protocol)) throw new Error('Invalid image URL');
      if (!/^image\//i.test(String(u.pathname).match(/\.(jpe?g|png|webp|avif|gif)$/i)?.[0] ? 'image/ok' : '')) throw new Error('Use a direct image URL ending in JPG, PNG, WebP, AVIF or GIF.');
      if (!galleryImages.includes(u.toString())) galleryImages.push(u.toString());
    } catch (error) { errors.push(error.message === 'Invalid image URL' ? 'Gallery images must use secure HTTPS URLs without credentials.' : error.message); }
    if (galleryImages.length >= 8) break;
  }
  const videoUrl = clean(input.videoUrl, 400);
  let approvedVideo = '';
  if (videoUrl) {
    try {
      const u = new URL(videoUrl);
      const host = u.hostname.toLowerCase();
      const youtube = ['youtube.com','www.youtube.com','m.youtube.com'].includes(host) && u.pathname === '/watch' && /^[a-zA-Z0-9_-]{11}$/.test(u.searchParams.get('v') || '');
      const short = host === 'youtu.be' && /^\/[a-zA-Z0-9_-]{11}$/.test(u.pathname);
      if (u.protocol !== 'https:' || u.username || u.password || u.port || !(youtube || short)) throw new Error('Invalid video URL');
      approvedVideo = videoUrl;
    } catch { errors.push('Use a valid YouTube video URL.'); }
  }
  if (errors.length) return { errors, config: null };
  const config = {
    brand: clean(input.brand, 60) || "Eboora-Store",
    email,
    productName,
    eyebrow: clean(input.eyebrow, 40) || "Digital download",
    headline,
    headlineFont: ["Manrope", "system-ui", "Georgia", "Arial", "Poppins", "Montserrat", "Playfair Display", "Space Grotesk"].includes(input.headlineFont) ? input.headlineFont : "Manrope",
    headlineSize: Number.isFinite(Number(input.headlineSize)) && Number(input.headlineSize) >= 24 && Number(input.headlineSize) <= 64 ? Number(input.headlineSize) : 48,
    headlineColor: /^#[0-9a-fA-F]{6}$/.test(String(input.headlineColor || "")) ? input.headlineColor : "#15172b",
    description,
    videoUrl: approvedVideo,
    galleryImages,
    descriptionFont: ['system-ui','Arial','Georgia','Manrope','Poppins','Montserrat','Space Grotesk'].includes(input.descriptionFont) ? input.descriptionFont : 'system-ui',
    descriptionSize: Number(input.descriptionSize) >= 13 && Number(input.descriptionSize) <= 24 ? Number(input.descriptionSize) : 17,
    descriptionColor: /^#[0-9a-fA-F]{6}$/.test(String(input.descriptionColor || '')) ? input.descriptionColor : '#475569',
    price,
    mrp: mrp || 0,
    currency: "INR",
    coverImage,
    deliveryUrl: validateDriveUrl(input.deliveryUrl),
    theme: ["navy", "forest", "violet", "sunset", "aggressive", "luxury", "soft", "tech"].includes(input.theme) ? input.theme : "tech",
    accentColor: /^#[0-9a-fA-F]{6}$/.test(String(input.accentColor || "")) ? input.accentColor : "",
    benefits,
    included,
    faqs,
    maker: { name: clean(input.makerName, 80) || "Eboora Creator", line: clean(input.makerLine, 300) },
    legal: clean(input.legal, 200),
    whatsapp,
    responseTime: clean(input.responseTime, 60) || "1 business day",
    pixelId: pixel.length >= 5 && pixel.length <= 20 ? pixel : "YOUR_PIXEL_ID",
    reviews
  };
  return { errors: [], config };
}

// Generic owner settings (stored in store_settings). Used for media keys and the Meta pixel.
export async function readSetting(env, key) {
  if (!env.ORDERS_DB) return null;
  try {
    const row = await env.ORDERS_DB.prepare("SELECT value FROM store_settings WHERE key = ? LIMIT 1").bind(key).first();
    return row ? JSON.parse(row.value) : null;
  } catch (error) {
    console.error("Setting read failed", key, error);
    return null;
  }
}

export async function writeSetting(env, key, value) {
  await env.ORDERS_DB.prepare(
    "INSERT INTO store_settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
  ).bind(key, JSON.stringify(value)).run();
}

export const readMedia = (env) => readSetting(env, "media");
export const writeMedia = (env, media) => writeSetting(env, "media", media);
