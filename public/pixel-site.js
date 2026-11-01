/* v68: site-wide Meta Pixel on the storefront (base website), using the Meta Pixel ID saved in Admin → Site settings. */
(async function(){
  try{
    if(window._ebooraPixelLoaded) return;
    const r = await fetch('/api/site-settings', {cache:'no-store'});
    if(!r.ok) return;
    const cfg = await r.json();
    const id = String(cfg.pixelId || '');
    if(!/^\d{5,20}$/.test(id) || window._ebooraPixelLoaded) return;
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', id);
    fbq('track', 'PageView');
    window._ebooraPixelLoaded = true;
  }catch(e){ /* pixel is optional; never break the storefront */ }
})();
