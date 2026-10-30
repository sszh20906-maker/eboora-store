const CONFIG = {pixelId:"YOUR_PIXEL_ID",productId:"eboora-product",productName:"",email:"support@eboora.store"};
function initPixel(){
  if (CONFIG.pixelId && CONFIG.pixelId !== "YOUR_PIXEL_ID" && !window._ebooraPixelLoaded) {
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', CONFIG.pixelId); fbq('track', 'PageView'); window._ebooraPixelLoaded=true;
  }
}
const $=id=>document.getElementById(id);
$("mail").textContent=CONFIG.email; $("mail").href="mailto:"+CONFIG.email;
const orderId=new URLSearchParams(location.search).get("order_id");

function view(kind,icon,title,msg){
  const ic=$("ic"); ic.className="ic "+kind; ic.textContent=icon;
  $("title").textContent=title; $("msg").textContent=msg;
}
function done(d){
  view("ok","✓","Payment received","Thank you! Your files are ready.");
  if(d.support){ if(d.support.email){ $("mail").textContent=d.support.email; $("mail").href="mailto:"+d.support.email; } if(d.support.whatsapp){ $("wa").href="https://wa.me/"+d.support.whatsapp; $("waWrap").hidden=false; } }
  if(d.download_url && d.download_url.startsWith("https://")){
    $("dl").href=d.download_url; $("dl").hidden=false;
  }
  $("note").hidden=false;
  $("note").textContent="We have also emailed this link"+(d.email_hint?" to "+d.email_hint:"")+". Check spam if you do not see it in 5 minutes. The link stays valid for 30 days; reopening this page gives you a fresh one.";
  // Purchase: fired only after the server confirmed PAID, with the real paid amount.
  // eventID = order_id, so Meta de-duplicates it against the webhook (server) event.
  const key="purchase_"+orderId;
  try{ if(localStorage.getItem(key)) return; }catch(_){}
  if (typeof window.fbq === "function" && CONFIG.pixelId && CONFIG.pixelId !== "YOUR_PIXEL_ID") {
    fbq("track","Purchase",{content_ids:[CONFIG.productId],content_name:CONFIG.productName,content_type:"product",num_items:1,value:Number(d.amount),currency:d.currency||"INR"},{eventID:orderId});
  }
  try{ localStorage.setItem(key,"1"); }catch(_){}
}
async function check(attempt){
  try{
    const r=await fetch("/api/verify-order?order_id="+encodeURIComponent(orderId),{cache:"no-store"});
    const d=await r.json();
    if(d.paid) return done(d);
    if(attempt<8){ return setTimeout(()=>check(attempt+1),2500); }
    view("bad","!","Payment not confirmed yet","If money was deducted, your link will arrive by email shortly. If not, write to us with your order ID: "+orderId);
  }catch(e){
    if(attempt<8){ return setTimeout(()=>check(attempt+1),2500); }
    view("bad","!","Could not confirm payment","Please check your email for the download link, or write to us with your order ID.");
  }
}
async function start(){
  try{let r=await fetch('/api/config',{cache:'no-store'});if(!r.ok)r=await fetch('/store-config.json',{cache:'no-store'});if(r.ok){const c=await r.json();CONFIG.pixelId=c.pixelId||CONFIG.pixelId;CONFIG.productId=c.productId||CONFIG.productId;CONFIG.productName=c.productName||CONFIG.productName;CONFIG.email=c.email||CONFIG.email;if(c.whatsapp){$('wa').href='https://wa.me/'+String(c.whatsapp).replace(/\D/g,'');$('waWrap').hidden=false;}$('mail').textContent=CONFIG.email;$('mail').href='mailto:'+CONFIG.email;}}
  catch(_){}
  initPixel();
  if(!orderId){view("bad","!","Open this page after payment","Your download link is sent to your email right after payment. Lost it? Write to us and we will resend it.");}
  else{check(0)}
}
start();
