import { json } from '../../_lib/commerce.js';
import { requireAdmin } from '../../_lib/admin.js';
const KEY='site_settings';
const clean=(v,n)=>String(v??'').trim().slice(0,n);
function safeHttps(raw, hosts=[]){const s=clean(raw,500);if(!s)return '';try{const u=new URL(s);if(u.protocol!=='https:'||u.username||u.password||u.port||(hosts.length&&!hosts.includes(u.hostname.toLowerCase())))return '';return u.toString()}catch{return ''}}
function validate(d){
 const brand=clean(d.brand,60)||'Eboora-Store';
 const tagline=clean(d.tagline,140),logoUrl=safeHttps(d.logoUrl),supportEmail=clean(d.supportEmail,160).toLowerCase();
 const seoTitle=clean(d.seoTitle,70),seoDescription=clean(d.seoDescription,160);
 const ogImage=safeHttps(d.ogImage);
 const instagram=safeHttps(d.instagram,['instagram.com','www.instagram.com']),youtube=safeHttps(d.youtube,['youtube.com','www.youtube.com','youtu.be']),facebook=safeHttps(d.facebook,['facebook.com','www.facebook.com']),x=safeHttps(d.x,['x.com','www.x.com','twitter.com','www.twitter.com']);
 const gaId=clean(d.gaId,24),pixelId=clean(d.pixelId,20);
 if(supportEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail))return {error:'Enter a valid support email.'};
 if(gaId&&!/^G-[A-Z0-9]{6,15}$/.test(gaId))return {error:'Google Analytics ID must look like G-XXXXXXXXXX.'};
 if(pixelId&&!/^\d{5,20}$/.test(pixelId))return {error:'Meta Pixel ID must contain 5–20 digits.'};
 return {value:{brand,tagline,logoUrl,supportEmail,seoTitle,seoDescription,ogImage,instagram,youtube,facebook,x,gaId,pixelId,privacyUrl:safeHttps(d.privacyUrl),termsUrl:safeHttps(d.termsUrl),refundUrl:safeHttps(d.refundUrl)}};
}
export async function onRequestGet({request,env}){const denied=await requireAdmin(request,env);if(denied)return denied;try{const row=await env.ORDERS_DB.prepare('SELECT value FROM store_settings WHERE key=?').bind(KEY).first();return json({settings:row?JSON.parse(row.value):{}})}catch{return json({error:'Unable to load site settings.'},503)}}
export async function onRequestPut({request,env}){const denied=await requireAdmin(request,env);if(denied)return denied;if(!env.ORDERS_DB)return json({error:'Database is not connected.'},503);let d;try{d=await request.json()}catch{return json({error:'Invalid JSON.'},400)}const result=validate(d||{});if(result.error)return json({error:result.error},400);try{await env.ORDERS_DB.prepare("INSERT INTO store_settings (key,value,updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(KEY,JSON.stringify(result.value)).run();return json({ok:true,settings:result.value})}catch{return json({error:'Unable to save site settings.'},503)}}
