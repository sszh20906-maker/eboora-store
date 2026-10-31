const money = (n) => '\u20B9' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}
(async () => {
  const list = document.getElementById('list');
  const empty = document.getElementById('empty');
  try {
    const r = await fetch('/api/catalog', { cache: 'no-store' });
    const d = await r.json();
    const items = d.products || [];
    if (!items.length) empty.classList.remove('hidden');
    // Home video is managed independently of individual product videos.
    fetch('/api/storefront', {cache:'no-store'}).then(r => r.json()).then(({videoId}) => {
      if (!/^[A-Za-z0-9_-]{11}$/.test(videoId || '')) return;
      document.getElementById('storeVideo').classList.remove('hidden');
      document.getElementById('storeVideoPlay').addEventListener('click', () => {
        const iframe=document.createElement('iframe');
        iframe.src='https://www.youtube-nocookie.com/embed/'+videoId+'?autoplay=1';
        iframe.title='Eboora product overview'; iframe.allow='autoplay; encrypted-media; picture-in-picture';
        iframe.allowFullscreen=true; iframe.loading='lazy'; iframe.referrerPolicy='strict-origin-when-cross-origin';
        document.getElementById('storeVideoStage').replaceChildren(iframe);
      },{once:true});
    }).catch(()=>{});
    const renderCatalog=(query='',sort='featured')=>{
      list.replaceChildren();
      const selected=items.filter(p=>(p.name+' '+(p.headline||'')+' '+(p.eyebrow||'')).toLowerCase().includes(query.toLowerCase()));
      if(sort==='low')selected.sort((a,b)=>Number(a.price)-Number(b.price));
      if(sort==='high')selected.sort((a,b)=>Number(b.price)-Number(a.price));
      if(sort==='az')selected.sort((a,b)=>String(a.name).localeCompare(String(b.name)));
      document.getElementById('searchEmpty').classList.toggle('hidden',Boolean(selected.length)||!items.length);
      selected.forEach((p) => {
      const card = el('a', 'item');
      card.href = '/landing.html?slug=' + encodeURIComponent(p.slug);
      const img = el('img');
      img.src = p.coverImage;
      img.alt = p.name || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('error', () => { if (!img.src.endsWith('/assets/cover.svg')) img.src = '/assets/cover.svg'; });
      const body = el('div', 'body');
      body.append(el('div', 'muted', p.eyebrow || 'Digital download'), el('div', 'name', p.name || 'Digital product'), el('div', 'muted', p.headline || ''));
      const price = el('div', 'price', money(p.price));
      if (Number(p.mrp) > Number(p.price)) price.append(el('span', 'mrp', money(p.mrp)));
      body.append(price, el('div', 'cta', 'View product'));
      const quick = el('button','quick-view','Quick view'); quick.type='button'; quick.setAttribute('aria-label','Quick view '+(p.productName||p.name||'product'));
      quick.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openQuickView(p);});
      if(!window.matchMedia('(max-width: 760px)').matches) body.append(quick);card.dataset.productTheme=p.theme||'tech';if(/^#[0-9a-fA-F]{6}$/.test(p.accentColor||''))card.style.setProperty('--product-accent',p.accentColor);
      card.append(img, body);
      list.append(card);
      });
    };
    const query=document.getElementById('catalogSearch'); const sort=document.getElementById('catalogSort');
    query.addEventListener('input',()=>renderCatalog(query.value,sort.value));
    sort.addEventListener('change',()=>renderCatalog(query.value,sort.value));
    renderCatalog();
  } catch (err) {
    empty.classList.remove('hidden');
  }
})();

function openQuickView(p){
  let dialog=document.getElementById('ebooraQuickView');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='ebooraQuickView';dialog.className='quick-dialog';document.body.append(dialog);}
  dialog.replaceChildren();
  const close=document.createElement('button');close.type='button';close.className='image-close';close.textContent='×';close.setAttribute('aria-label','Close quick view');
  const img=document.createElement('img');img.src=p.coverImage||'/assets/cover.svg';img.alt=(p.productName||p.name||'Product')+' cover';
  const content=document.createElement('div');content.className='quick-content';
  const heading=document.createElement('h2');heading.textContent=p.productName||p.name||'Digital product';
  const description=document.createElement('p');description.textContent=p.description||p.headline||'View details before purchasing.';
  const price=document.createElement('strong');price.textContent=money(p.price);
  const link=document.createElement('a');link.className='quick-cta';link.href='/landing.html?slug='+encodeURIComponent(p.slug);link.textContent='View details & buy →';
  content.append(heading,description,price,link);dialog.append(close,img,content);
  close.addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  if(typeof dialog.showModal==='function')dialog.showModal();else location.href=link.href;
}
