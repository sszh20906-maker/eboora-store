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
    if (!items.length) { empty.classList.remove('hidden'); return; }
    items.forEach((p) => {
      const card = el('a', 'item');
      card.href = '/landing.html?slug=' + encodeURIComponent(p.slug);
      const img = el('img');
      img.src = p.coverImage;
      img.alt = p.name || '';
      img.loading = 'lazy';
      const body = el('div', 'body');
      body.append(el('div', 'muted', p.eyebrow || 'Digital download'), el('div', 'name', p.name || 'Digital product'), el('div', 'muted', p.headline || ''));
      const price = el('div', 'price', money(p.price));
      if (Number(p.mrp) > Number(p.price)) price.append(el('span', 'mrp', money(p.mrp)));
      body.append(price, el('div', 'cta', 'View product'));
      card.append(img, body);
      list.append(card);
    });
  } catch (err) {
    empty.classList.remove('hidden');
  }
})();
