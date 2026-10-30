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

  if (input.deliveryUrl && !validateDriveUrl(input.deliveryUrl)) errors.push("Sirf valid Google Drive sharing link use karo.");
  if (!productName) errors.push("Product name zaroori hai.");
  if (!headline) errors.push("Headline zaroori hai.");
  if (!description) errors.push("Description zaroori hai.");
  if (price === null) errors.push("Price 1 se 10,00,000 ke beech hona chahiye.");
  if (mrpInput > 0 && mrp === null) errors.push("Original price galat hai.");
  if (mrp && price !== null && mrp <= price) errors.push("Original price selling price se zyada honi chahiye, ya khali chhod do.");
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) errors.push("Support email sahi nahi hai.");
  if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 15)) errors.push("WhatsApp number country code ke saath 10 se 15 digits ka hona chahiye, ya khali chhod do.");
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

  const config = {
    brand: clean(input.brand, 60) || "Eboora-Store",
    email,
    productName,
    eyebrow: clean(input.eyebrow, 40) || "Digital download",
    headline,
    description,
    price,
    mrp: mrp || 0,
    currency: "INR",
    coverImage,
    deliveryUrl: validateDriveUrl(input.deliveryUrl),
    theme: ["navy", "forest", "violet", "sunset"].includes(input.theme) ? input.theme : "navy",
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
