// Owner login: the password is stored only as a PBKDF2 hash, and sessions are random tokens stored only as hashes.
import { constantTimeEqual } from "./commerce.js";

export const SESSION_COOKIE = "eboora_admin";
export const SESSION_SECONDS = 12 * 60 * 60;
const ITERATIONS = 100000; // Workers' maximum for PBKDF2

const toBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const toBase64Url = (bytes) => toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}

export async function makePasswordHash(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(await derive(password, salt, ITERATIONS))}`;
}

export async function checkPassword(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 10000 || iterations > 1000000) return false;
  let salt;
  try { salt = fromBase64(parts[2]); } catch { return false; }
  return constantTimeEqual(toBase64(await derive(String(password), salt, iterations)), parts[3]);
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

export async function createSession(env) {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const now = Math.floor(Date.now() / 1000);
  await env.ORDERS_DB.prepare("DELETE FROM admin_sessions WHERE expires_at < ?").bind(now).run();
  await env.ORDERS_DB.prepare("INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, ?)")
    .bind(await sha256Hex(token), now + SESSION_SECONDS).run();
  return token;
}

export async function isValidSession(env, token) {
  const row = await env.ORDERS_DB.prepare("SELECT expires_at FROM admin_sessions WHERE token_hash = ? LIMIT 1")
    .bind(await sha256Hex(token)).first();
  return Boolean(row) && Number(row.expires_at) > Math.floor(Date.now() / 1000);
}

export async function destroySession(env, token) {
  if (!token || !env.ORDERS_DB) return;
  await env.ORDERS_DB.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
}
