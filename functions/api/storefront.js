import { json } from '../_lib/commerce.js';
export async function onRequestGet({env}) {
  if (!env.ORDERS_DB) return json({videoId:''});
  try {
    const row=await env.ORDERS_DB.prepare('SELECT value FROM store_settings WHERE key = ?').bind('home_video').first();
    const url = new URL(row?.value || 'https://invalid.local');
    let id='';
    if (['youtube.com','www.youtube.com','m.youtube.com'].includes(url.hostname) && url.pathname === '/watch') id=url.searchParams.get('v')||'';
    if (url.hostname === 'youtu.be') id=url.pathname.slice(1);
    return json({videoId:/^[A-Za-z0-9_-]{11}$/.test(id)?id:''});
  } catch {return json({videoId:''});}
}
