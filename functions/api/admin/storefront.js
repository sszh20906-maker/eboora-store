import { json } from '../../_lib/commerce.js';
import { requireAdmin } from '../../_lib/admin.js';

const KEY = 'home_video';
export function youtubeId(value) {
  if (!value) return '';
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:') return '';
    if (['youtube.com','www.youtube.com','m.youtube.com'].includes(u.hostname) && u.pathname === '/watch') {
      const v = u.searchParams.get('v') || '';
      return /^[A-Za-z0-9_-]{11}$/.test(v) ? v : '';
    }
    if (u.hostname === 'youtu.be') {
      const v = u.pathname.slice(1);
      return /^[A-Za-z0-9_-]{11}$/.test(v) ? v : '';
    }
    return '';
  } catch { return ''; }
}
export async function onRequestGet({request,env}) {
  const denied = await requireAdmin(request,env); if (denied) return denied;
  try {
    const row = await env.ORDERS_DB.prepare('SELECT value FROM store_settings WHERE key = ?').bind(KEY).first();
    return json({ videoUrl: row?.value || '' });
  } catch { return json({ error: 'Unable to read storefront settings.' },503); }
}
export async function onRequestPut({request,env}) {
  const denied = await requireAdmin(request,env); if (denied) return denied;
  let data; try { data=await request.json(); } catch { return json({error:'Invalid JSON.'},400); }
  const url = String(data?.videoUrl || '').trim();
  if (url.length > 400 || (url && !youtubeId(url))) return json({error:'Enter a valid HTTPS YouTube watch or youtu.be URL.'},400);
  try {
    await env.ORDERS_DB.prepare(`INSERT INTO store_settings (key,value,updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`).bind(KEY,url).run();
    return json({ok:true,videoUrl:url});
  } catch { return json({error:'Unable to save storefront video.'},503); }
}
