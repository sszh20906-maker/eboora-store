// GET / PUT /api/admin/config - owner reads and saves product settings (protected by ADMIN_KEY).
import { json } from "../../_lib/commerce.js";
import { requireAdmin } from "../../_lib/admin.js";
import { readStoredConfig, writeStoredConfig, validateConfig } from "../../_lib/settings.js";

export async function onRequestGet({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const config = await readStoredConfig(env);
  return json({ config, productId: env.PRODUCT_ID || "eboora-product" });
}

export async function onRequestPut({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  if (!env.ORDERS_DB) return json({ error: "Database is not connected yet." }, 503);

  let input;
  try { input = await request.json(); } catch { return json({ error: "Invalid data sent." }, 400); }

  const { errors, config } = validateConfig(input);
  if (errors.length) return json({ error: errors.join(" ") }, 400);

  try {
    await writeStoredConfig(env, config);
  } catch (error) {
    console.error("Config save failed", error);
    return json({ error: "Could not save. Please try again." }, 503);
  }
  return json({ ok: true, config });
}
