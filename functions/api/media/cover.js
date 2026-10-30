// GET /api/media/cover - the public product cover. Only the cover is ever served from here; product files stay private.
import { readMedia } from "../../_lib/settings.js";

export async function onRequestGet({ env }) {
  const media = await readMedia(env);
  if (!media?.coverKey || !env.PRODUCTS_BUCKET) return new Response("Not found", { status: 404 });
  const object = await env.PRODUCTS_BUCKET.get(media.coverKey);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": media.coverType || "image/jpeg",
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
