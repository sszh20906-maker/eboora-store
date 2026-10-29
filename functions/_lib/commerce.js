const encoder = new TextEncoder();

export const json = (value, status = 200, extraHeaders = {}) => new Response(JSON.stringify(value), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders
  }
});

export function cashfreeBase(env) {
  return env.CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
}

export function cashfreeMode(env) {
  return env.CASHFREE_ENV === "production" ? "production" : "sandbox";
}

export function hasCashfreeConfig(env) {
  return Boolean(env.CASHFREE_APP_ID && env.CASHFREE_SECRET_KEY);
}

export async function fetchCashfreeOrder(env, orderId) {
  if (!hasCashfreeConfig(env)) throw new Error("Cashfree API credentials are not configured.");
  const response = await fetch(`${cashfreeBase(env)}/orders/${encodeURIComponent(orderId)}`, {
    headers: {
      "x-client-id": env.CASHFREE_APP_ID,
      "x-client-secret": env.CASHFREE_SECRET_KEY,
      "x-api-version": env.CASHFREE_API_VERSION || "2026-01-01",
      "Accept": "application/json"
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("Cashfree order lookup failed.");
    error.status = response.status;
    error.response = body;
    throw error;
  }
  return body;
}

async function hmacHex(secret, value) {
  if (!secret || secret.length < 32) throw new Error("DOWNLOAD_TOKEN_SECRET must contain at least 32 characters.");
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const DOWNLOAD_TTL_SECONDS = 30 * 24 * 60 * 60;

export async function makeDownloadToken(env, orderId, expiresAt) {
  return hmacHex(env.DOWNLOAD_TOKEN_SECRET, `eboora-store-download:v2:${orderId}:${expiresAt}`);
}

export function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function makeDownloadUrl(env, orderId) {
  const site = String(env.SITE_URL || "").replace(/\/$/, "");
  if (!site.startsWith("https://")) throw new Error("SITE_URL must be the public HTTPS site URL.");
  const expiresAt = Math.floor(Date.now() / 1000) + DOWNLOAD_TTL_SECONDS;
  const token = await makeDownloadToken(env, orderId, expiresAt);
  return `${site}/api/download?order_id=${encodeURIComponent(orderId)}&exp=${expiresAt}&token=${token}`;
}

export function validOrderId(orderId) {
  return typeof orderId === "string" && /^[A-Za-z0-9_-]{3,80}$/.test(orderId);
}

export function safeAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= 1000000 ? Math.round(n * 100) / 100 : null;
}

export function amountMatches(a, b) {
  return Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Math.abs(Number(a) - Number(b)) < 0.005;
}

export function maskEmail(email) {
  if (!email || !String(email).includes("@")) return "";
  const [user, domain] = String(email).split("@");
  return `${user.slice(0, 2)}***@${domain}`;
}

export function normalizePhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  return digits.length === 10 ? digits : "";
}
