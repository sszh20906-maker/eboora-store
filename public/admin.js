const $ = id => document.getElementById(id);
const STATUS_LABEL = { PAID: 'Paid', CREATED: 'Unpaid', FAILED: 'Failed', CANCELLED: 'Cancelled' };
let storeProductName = '';
let cachedProducts = [];

const money = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const lines = v => v.split('\n').map(s => s.trim()).filter(Boolean);
const splitPipe = line => { const i = line.indexOf('|'); return i < 0 ? [line.trim(), ''] : [line.slice(0, i).trim(), line.slice(i + 1).trim()]; };
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };

async function api(path, options = {}) {
  const r = await fetch(path, { ...options, cache: 'no-store', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const err = new Error(d.error || ('Kuch galat hua (' + r.status + ')')); err.status = r.status; throw err; }
  return d;
}

let currentProduct = null; // the saved product being edited; null while creating a new one

function readForm() {
  return {
    id: currentProduct?.id || '',
    slug: $('slug').value,
    status: $('status').value,
    brand: $('brand').value,
    email: $('email').value,
    productName: $('productName').value,
    eyebrow: $('eyebrow').value,
    headline: $('headline').value,
    headlineFont: $('headlineFont').value,
    headlineSize: Number($('headlineSize').value),
    headlineColor: $('headlineColor').value,
    description: $('description').value,
    price: $('price').value,
    mrp: $('mrp').value,
    coverImage: $('coverImage').value,
    deliveryUrl: $('deliveryUrl').value.trim(),
    theme: $('theme').value,
    accentColor: $('useAccent').checked ? $('accentColor').value : '',
    benefits: lines($('benefits').value).map(l => { const [title, description] = splitPipe(l); return { title, description }; }),
    included: lines($('included').value).map(title => ({ title })),
    faqs: lines($('faqs').value).map(l => { const [question, answer] = splitPipe(l); return { question, answer }; }).filter(f => f.question && f.answer),
    reviews: lines($('reviews').value).map(l => { const [name, text] = splitPipe(l); return { name, text }; }).filter(r => r.text),
    makerName: $('makerName').value,
    makerLine: $('makerLine').value,
    whatsapp: $('whatsapp').value,
    legal: $('legal').value,
    responseTime: $('responseTime').value,
    pixelId: $('pixelId').value,
    fontTheme: $('fontTheme').value
  };
}

function fillForm(p) {
  p = p || {};
  currentProduct = p.id ? p : null;
  storeProductName = p.productName || '';
  $('slug').value = p.slug || '';
  $('status').value = p.status === 'draft' ? 'draft' : 'published';
  $('brand').value = p.brand || 'Eboora-Store';
  $('email').value = p.email || '';
  $('productName').value = p.productName || '';
  $('eyebrow').value = p.eyebrow || 'Digital download';
  $('headline').value = p.headline || '';
  $('headlineFont').value = ['Manrope','system-ui','Georgia','Arial'].includes(p.headlineFont) ? p.headlineFont : 'Manrope';
  $('headlineSize').value = Number(p.headlineSize) >= 24 && Number(p.headlineSize) <= 64 ? p.headlineSize : 48;
  $('headlineColor').value = /^#[0-9a-fA-F]{6}$/.test(p.headlineColor || '') ? p.headlineColor : '#15172b';
  $('description').value = p.description || '';
  $('price').value = p.price || '';
  $('mrp').value = p.mrp || '';
  $('coverImage').value = p.coverImage || '/assets/cover.svg';
  $('deliveryUrl').value = p.deliveryUrl || '';
  $('theme').value = p.theme || 'tech';
  $('useAccent').checked = Boolean(p.accentColor);
  $('accentColor').value = /^#[0-9a-fA-F]{6}$/.test(p.accentColor || '') ? p.accentColor : '#2563eb';
  updateThemePreview();
  $('benefits').value = (p.benefits || []).map(b => b.description ? b.title + ' | ' + b.description : b.title).join('\n');
  $('included').value = (p.included || []).map(x => x.title).join('\n');
  $('faqs').value = (p.faqs || []).map(f => f.question + ' | ' + f.answer).join('\n');
  $('reviews').value = (p.reviews || []).map(r => r.name + ' | ' + r.text).join('\n');
  $('makerName').value = (p.maker && p.maker.name) || 'Eboora Creator';
  $('makerLine').value = (p.maker && p.maker.line) || 'Questions about your purchase? Contact our support team.';
  $('whatsapp').value = p.whatsapp || '';
  $('legal').value = p.legal || '';
  $('responseTime').value = p.responseTime || '1 business day';
  $('pixelId').value = p.pixelId && p.pixelId !== 'YOUR_PIXEL_ID' ? p.pixelId : '';
  $('fontTheme').value = p.fontTheme || 'manrope';
}

function setSaveMsg(text, cls) {
  const m = $('saveMsg');
  m.textContent = text;
  m.className = 'msg ' + (cls || '');
  m.classList.toggle('hidden', !text);
}

function showLoginError(text) {
  const m = $('loginMsg');
  m.textContent = text;
  m.classList.remove('hidden');
}

function showLoginCard() {
  $('loginCard').classList.remove('hidden');
  $('app').classList.add('hidden');
}

async function openAdmin() {
  try {
    await api('/api/admin/products');
    $('loginCard').classList.add('hidden');
    $('app').classList.remove('hidden');
    loadProducts();
    loadOrders();
    loadCoupons();
  } catch (err) {
    showLoginCard();
    if (err.status && err.status !== 401) showLoginError(err.message);
  }
}

function renderSummary(s) {
  const paid = s.PAID || { count: 0, total: 0 };
  const open = s.CREATED || { count: 0, total: 0 };
  let all = 0;
  Object.keys(s).forEach(k => { all += s[k].count; });
  $('paidCount').textContent = paid.count;
  $('paidTotal').textContent = money(paid.total);
  $('openCount').textContent = open.count;
  $('openTotal').textContent = money(open.total);
  $('allCount').textContent = all;
}

function localTime(utc) {
  if (!utc) return '';
  const d = new Date(String(utc).replace(' ', 'T') + 'Z');
  return isNaN(d) ? utc : d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
}

function followUpMessage(o) {
  const first = (o.customer_name || '').split(' ')[0] || 'Namaste';
  const product = storeProductName || 'hamara product';
  return 'Namaste ' + first + ', aapne ' + product + ' ka order shuru kiya tha, lekin payment complete nahi hua. Agar koi dikkat aayi ho to batayiye, main madad kar deta hoon. Dobara order karne ke liye yahan dekhiye: ' + location.origin + '/';
}

function orderCard(o) {
  const card = el('div', 'order');
  const badgeClass = o.status === 'PAID' ? 'badge b-paid' : (o.status === 'CREATED' ? 'badge b-open' : 'badge b-other');
  const head = el('div', 'order-head');
  head.append(el('strong', '', o.customer_name || 'Naam nahi'), el('span', badgeClass, STATUS_LABEL[o.status] || o.status));
  card.append(head);
  card.append(el('div', 'muted', money(o.amount) + ' · ' + localTime(o.created_at)));
  card.append(el('div', 'muted', 'Phone: ' + (o.customer_phone || '-') + ' · Email: ' + (o.customer_email || '-')));
  card.append(el('div', 'muted', 'Order ID: ' + o.order_id));

  if (o.status !== 'PAID') {
    const actions = el('div', 'row');
    actions.style.marginTop = '8px';
    const msg = followUpMessage(o);
    if (o.customer_phone) {
      const wa = el('a', 'btn wa', 'WhatsApp karo');
      wa.href = 'https://wa.me/91' + o.customer_phone + '?text=' + encodeURIComponent(msg);
      wa.target = '_blank';
      wa.rel = 'noopener';
      actions.append(wa);
    }
    if (o.customer_email) {
      const mail = el('a', 'btn light', 'Email karo');
      mail.href = 'mailto:' + o.customer_email + '?subject=' + encodeURIComponent('Aapka order - ' + storeProductName) + '&body=' + encodeURIComponent(msg);
      actions.append(mail);
    }
    card.append(actions);
  }
  if (o.refunded) card.append(el('div', 'muted', 'Refunded: ' + money(o.refunded)));
  if (o.status === 'PAID') {
    const refundBtn = el('button', 'btn light', 'Refund record karo');
    refundBtn.type = 'button';
    refundBtn.style.marginTop = '8px';
    refundBtn.addEventListener('click', () => recordRefund(o));
    card.append(refundBtn);
  }
  return card;
}

function renderToday(t) {
  $('todayCount').textContent = t.count;
  $('todayTotal').textContent = money(t.total);
}

async function recordRefund(o) {
  const left = Number(o.amount) - Number(o.refunded || 0);
  const amountText = prompt('Kitna refund kiya? (max Rs ' + left + ')', String(left));
  if (amountText === null) return;
  const note = prompt('Note (optional, jaise "customer request")', '') || '';
  try {
    await api('/api/admin/refunds', { method: 'POST', body: JSON.stringify({ order_id: o.order_id, amount: Number(amountText), note }) });
    await loadOrders();
    $('ordersMsg').textContent = 'Refund record ho gaya. Paise Cashfree dashboard se bhi wapas karne honge.';
  } catch (err) {
    $('ordersMsg').textContent = 'Refund record nahi hua: ' + err.message;
  }
}

async function loadOrders() {
  $('ordersMsg').textContent = 'Orders load ho rahe hain...';
  try {
    const d = await api('/api/admin/orders?status=' + encodeURIComponent($('statusFilter').value));
    renderSummary(d.summary || {});
    renderToday(d.today || { count: 0, total: 0 });
    drawOverview(d);
    const list = d.orders || [];
    $('orderList').replaceChildren(...list.map(orderCard));
    $('ordersMsg').textContent = list.length ? '' : 'Is filter mein koi order nahi hai.';
  } catch (err) {
    $('ordersMsg').textContent = 'Orders load nahi hue: ' + err.message;
  }
}

$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('loginMsg').classList.add('hidden');
  try {
    const r = await fetch('/api/admin/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: $('loginEmail').value.trim(), password: $('loginPassword').value })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { showLoginError(d.error || 'Login nahi hua.'); return; }
    $('loginPassword').value = '';
    openAdmin();
  } catch (err) {
    showLoginError('Network error. Please try again.');
  }
});

$('statusFilter').addEventListener('change', loadOrders);
$('refreshBtn').addEventListener('click', loadOrders);
$('logoutBtn').addEventListener('click', async () => {
  try {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  } finally {
    location.reload();
  }
});

$('settingsForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('saveBtn').disabled = true;
  setSaveMsg('Save ho raha hai...', '');
  try {
    const d = await api('/api/admin/products', { method: 'POST', body: JSON.stringify(readForm()) });
    currentProduct = d.product;
    storeProductName = d.product.productName;
    $('slug').value = d.product.slug;
    $('mediaArea').classList.remove('hidden');
    $('mediaNote').classList.add('hidden');
    renderMedia(d.product);
    setSaveMsg('Save ho gaya. Link: ' + location.origin + '/landing.html?slug=' + d.product.slug, 'ok');
    loadProducts();
  } catch (err) {
    setSaveMsg(err.message, 'bad');
  } finally {
    $('saveBtn').disabled = false;
  }
});

$('newProductBtn').addEventListener('click', () => openEditor(null));
$('productSearch').addEventListener('input', () => renderProducts(cachedProducts));
$('productFilter').addEventListener('change', () => renderProducts(cachedProducts));
$('cancelEdit').addEventListener('click', closeEditor);
openAdmin();

// ----- Coupons -----
function setCouponMsg(text, cls) {
  const m = $('couponMsg');
  m.textContent = text;
  m.className = 'msg ' + (cls || '');
  m.classList.toggle('hidden', !text);
}

async function loadCoupons() {
  try {
    const d = await api('/api/admin/coupons');
    const list = d.coupons || [];
    const box = $('couponList');
    box.replaceChildren(...list.map(couponRow));
    if (!list.length) box.append(el('p', 'muted', 'Abhi koi coupon nahi hai.'));
  } catch (err) {
    setCouponMsg('Coupons load nahi hue: ' + err.message, 'bad');
  }
}

function couponRow(c) {
  const row = el('div', 'order');
  const label = c.type === 'percent' ? c.value + '% off' : money(c.value) + ' off';
  const head = el('div', 'order-head');
  head.append(el('strong', '', c.code + ' · ' + label), el('span', c.active ? 'badge b-paid' : 'badge b-other', c.active ? 'Active' : 'Off'));
  row.append(head);
  const used = c.max_uses ? c.used_count + ' / ' + c.max_uses + ' used' : c.used_count + ' used';
  row.append(el('div', 'muted', used + (c.expires_at ? ' · expires ' + c.expires_at : ' · no expiry')));
  const toggle = el('button', 'btn light', c.active ? 'Band karo' : 'Chalu karo');
  toggle.type = 'button';
  toggle.style.marginTop = '8px';
  toggle.addEventListener('click', () => saveCoupon({ code: c.code, type: c.type, value: c.value, max_uses: c.max_uses, expires_at: c.expires_at, active: !c.active }));
  row.append(toggle);
  return row;
}

async function saveCoupon(body) {
  try {
    await api('/api/admin/coupons', { method: 'POST', body: JSON.stringify(body) });
    setCouponMsg('Coupon save ho gaya.', 'ok');
    loadCoupons();
  } catch (err) {
    setCouponMsg(err.message, 'bad');
  }
}

$('couponForm').addEventListener('submit', e => {
  e.preventDefault();
  saveCoupon({ code: $('cCode').value, type: $('cType').value, value: $('cValue').value, max_uses: $('cMax').value, expires_at: $('cExpires').value, active: true });
});


// ----- Products list -----
function setListMsg(text, cls) {
  const m = $('listMsg');
  m.textContent = text;
  m.className = 'msg ' + (cls || '');
  m.classList.toggle('hidden', !text);
}

function renderProducts(list) {
  const box = $('productList');
  box.replaceChildren();
  if (!list.length) {
    box.append(el('p', 'muted', 'Abhi koi product nahi hai. "Naya product" dabao.'));
    return;
  }
  list.forEach(p => {
    const row = el('div', 'order');
    const head = el('div', 'order-head');
    const label = p.status === 'published' ? 'Live' : (p.status === 'draft' ? 'Draft' : 'Hidden');
    head.append(el('strong', '', p.productName || 'Bina naam'), el('span', p.status === 'published' ? 'badge b-paid' : 'badge b-other', label));
    const thumbnail = el('img', 'product-thumb');
    thumbnail.src = p.coverUrl || p.coverImage || '/assets/cover.svg';
    thumbnail.alt = ''; thumbnail.loading = 'lazy';
    thumbnail.onerror = () => { thumbnail.onerror = null; thumbnail.src = '/assets/cover.svg'; };
    row.append(thumbnail);
    row.append(head);
    row.append(el('div', 'muted', money(p.price) + '  ·  ' + location.origin + '/landing.html?slug=' + p.slug));
    const actions = el('div', 'row');
    actions.style.marginTop = '8px';
    const copy = el('button', 'btn light', 'Link copy karo');
    copy.type = 'button';
    copy.addEventListener('click', () => copyLink(p.slug));
    const open = el('a', 'btn light', 'Dekho');
    open.href = '/landing.html?slug=' + encodeURIComponent(p.slug);
    open.target = '_blank';
    open.rel = 'noopener';
    const edit = el('button', 'btn light', 'Edit');
    edit.type = 'button';
    edit.addEventListener('click', () => openEditor(p));
    const del = el('button', 'btn light', 'Delete');
    del.type = 'button'; del.classList.add('delete-btn');
    del.addEventListener('click', () => deleteProduct(p));
    actions.append(copy, open, edit, del);
    row.append(actions);
    box.append(row);
  });
}

async function loadProducts() {
  try {
    const d = await api('/api/admin/products');
    renderProducts(d.products || []);
  } catch (err) {
    setListMsg('Products load nahi hue: ' + err.message, 'bad');
  }
}

function openEditor(p) {
  fillForm(p || null);
  $('editorTitle').textContent = p ? 'Product edit karo' : 'Naya product';
  $('editorCard').classList.remove('hidden');
  $('mediaArea').classList.remove('hidden');
  $('mediaNote').classList.toggle('hidden', Boolean(p));
  renderMedia(p);
  setSaveMsg('', '');
  setTab('editor');
}

function closeEditor() {
  currentProduct = null;
  $('editorCard').classList.add('hidden');
  setTab('products');
}

async function copyLink(slug) {
  const url = location.origin + '/landing.html?slug=' + slug;
  try {
    await navigator.clipboard.writeText(url);
    setListMsg('Link copy ho gaya: ' + url, 'ok');
  } catch (err) {
    window.prompt('Ye link copy karo:', url);
  }
}

async function deleteProduct(p) {
  if (!window.confirm('"' + (p.productName || p.slug) + '" delete karein? Existing buyers honge to pehle archive hoga.')) return;
  const permanent = window.confirm('PERMANENT DELETE bhi karna hai? OK = D1 product permanently remove; purane buyers ke download links BREAK ho sakte hain. Cancel = safe archive.');
  if (permanent && window.prompt('Permanent deletion confirm karne ke liye DELETE likho:') !== 'DELETE') return;
  try {
    const d = await api('/api/admin/products?id=' + encodeURIComponent(p.id) + (permanent ? '&force=PERMANENT_DELETE' : ''), { method: 'DELETE', body: '{}' });
    if (currentProduct && currentProduct.id === p.id) closeEditor();
    setListMsg(d.archived ? d.message : 'Product D1 se permanently delete ho gaya.', 'ok');
    loadProducts();
  } catch (err) {
    setListMsg(err.message, 'bad');
  }
}

// ----- Cover and product file (for the product being edited) -----
const TYPE_BY_EXT = { pdf: 'application/pdf', zip: 'application/zip', epub: 'application/epub+zip', mp4: 'video/mp4', mp3: 'audio/mpeg', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

function setMediaStatus(text, cls) {
  const m = $('mediaStatus');
  m.textContent = text;
  m.className = 'msg ' + (cls || '');
  m.classList.toggle('hidden', !text);
}

function renderMedia(p) {
  const m = p || {};
  const cover = (m.coverKey || m.coverStorage === 'd1') ? 'Cover: uploaded' : (m.coverImage && m.coverImage !== '/assets/cover.svg' ? 'Cover: external URL' : 'Cover: default image');
  const file = m.fileKey ? 'File: ' + m.fileName + ' (' + (Number(m.fileSize) / 1048576).toFixed(2) + ' MB)' : (m.deliveryUrl ? 'Delivery: Google Drive link saved' : 'Delivery: not configured');
  $('mediaCurrent').textContent = cover + '  ·  ' + file;
}

async function uploadMedia(kind) {
  const selected = $(kind === 'cover' ? 'coverInput' : 'fileInput');
  if (!selected.files?.length) { setMediaStatus('Pehle file select karo.', 'bad'); return; }
  if (!currentProduct) {
    if (!$('settingsForm').reportValidity()) { setMediaStatus('Required product details fill karo.', 'bad'); return; }
    setMediaStatus('First product is being saved automatically...', '');
    try {
      const d = await api('/api/admin/products', { method: 'POST', body: JSON.stringify(readForm()) });
      currentProduct = d.product;
      $('slug').value = d.product.slug;
      $('mediaNote').classList.add('hidden');
      loadProducts();
    } catch (err) { setMediaStatus('Save failed: ' + err.message, 'bad'); return; }
  }
  const input = $(kind === 'cover' ? 'coverInput' : 'fileInput');
  const file = input.files && input.files[0];
  if (!file) { setMediaStatus('Pehle file select karo.', 'bad'); return; }
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const type = file.type || TYPE_BY_EXT[ext] || 'application/octet-stream';
  setMediaStatus('Upload ho raha hai... badi file mein kuch minute lag sakte hain.', '');
  try {
    const r = await fetch('/api/admin/upload?kind=' + kind + '&id=' + encodeURIComponent(currentProduct.id), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': type, 'X-File-Name': encodeURIComponent(file.name) },
      body: file
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Upload nahi hua.');
    input.value = '';
    currentProduct = d.product;
    renderMedia(d.product);
    setMediaStatus('Upload ho gaya.', 'ok');
    loadProducts();
  } catch (err) {
    setMediaStatus(err.message, 'bad');
  }
}

async function removeMedia(kind) {
  if (!currentProduct) return;
  if (!window.confirm(kind === 'cover' ? 'Cover hata dein?' : 'Product file hata dein? Naya file upload karne tak buyers ko download nahi milega.')) return;
  try {
    const r = await fetch('/api/admin/upload?kind=' + kind + '&id=' + encodeURIComponent(currentProduct.id), {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Hata nahi hua.');
    currentProduct = d.product;
    renderMedia(d.product);
    setMediaStatus('Hata diya gaya.', 'ok');
    loadProducts();
  } catch (err) {
    setMediaStatus(err.message, 'bad');
  }
}

$('coverUpload').addEventListener('click', () => uploadMedia('cover'));
$('fileUpload').addEventListener('click', () => uploadMedia('file'));
$('coverRemove').addEventListener('click', () => removeMedia('cover'));
$('fileRemove').addEventListener('click', () => removeMedia('file'));

// Separate accessible workspace tabs; overview gives a simple live paid-sales chart.
function setTab(tab) {
  document.querySelectorAll('[data-panel]').forEach(node => node.classList.toggle('hidden', node.dataset.panel !== tab));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab || (tab === 'editor' && btn.dataset.tab === 'products')));
  if (tab === 'editor') $('editorCard').classList.remove('hidden');
  const title = $('workspaceTitle'); if (title) title.textContent = ({overview:'Overview',orders:'Orders',products:'Products',coupons:'Coupons',editor:'Product studio'})[tab] || 'Overview';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => setTab(btn.dataset.tab)));
$('previewBtn').addEventListener('click', async () => {
  const f = readForm();
  const config = { ...f, maker: { name: f.makerName, line: f.makerLine } };
  const cover = $('coverInput').files?.[0];
  if (cover) {
    if (!['image/jpeg','image/png','image/webp'].includes(cover.type) || cover.size > 2 * 1024 * 1024) {
      setSaveMsg('Preview cover JPG/PNG/WebP aur 2 MB se chhota hona chahiye.', 'bad'); return;
    }
    try {
      config.coverImage = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result);
        reader.onerror = reject; reader.readAsDataURL(cover);
      });
    } catch { setSaveMsg('Cover preview load nahi hua.', 'bad'); return; }
  }
  try { localStorage.setItem('eboora-preview-config', JSON.stringify(config)); }
  catch { setSaveMsg('Preview storage full hai. Chhota cover try karo.', 'bad'); return; }
  window.open('/landing.html?preview=1', '_blank', 'noopener');
});
function drawOverview(d) {
  const paid = d.summary?.PAID || { count: 0, total: 0 };
  const created = d.summary?.CREATED || { count: 0, total: 0 };
  const metrics = [['Total revenue', money(paid.total)], ['Paid orders', paid.count], ['Pending checkouts', created.count], ['Today paid', money(d.today?.total)]];
  $('overviewStats').replaceChildren(...metrics.map(([label, value]) => { const x=el('div','stat'); x.append(el('span','muted',label),el('b','',String(value)));return x; }));
  const dates = Array.from({length:14}, (_,i) => { const x=new Date(); x.setUTCHours(0,0,0,0); x.setUTCDate(x.getUTCDate()-13+i); return x.toISOString().slice(0,10); });
  const values = dates.map(day => (d.revenueByDay || []).find(x => x.day === day)?.total || 0);
  const max = Math.max(1,...values); const W=680,H=210, pad=32;
  const dots=values.map((v,i)=>`${pad + i*(W-2*pad)/13},${H-pad-v/max*(H-2*pad)}`);
  const svgNS='http://www.w3.org/2000/svg'; const svg=document.createElementNS(svgNS,'svg'); svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('role','img');svg.setAttribute('aria-label','Last 14 days paid revenue');
  const grid=document.createElementNS(svgNS,'path');grid.setAttribute('d',`M${pad} ${H-pad} H${W-pad}`);grid.setAttribute('stroke','#ccdcf1');grid.setAttribute('fill','none');svg.append(grid);
  const area=document.createElementNS(svgNS,'polygon');area.setAttribute('points',`${pad},${H-pad} ${dots.join(' ')} ${W-pad},${H-pad}`);area.setAttribute('fill','#e2edff');svg.append(area);
  const line=document.createElementNS(svgNS,'polyline');line.setAttribute('points',dots.join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#1666e9');line.setAttribute('stroke-width','3');line.setAttribute('stroke-linecap','round');svg.append(line);
  const x=document.createElementNS(svgNS,'text');x.setAttribute('x',pad);x.setAttribute('y',H-7);x.setAttribute('class','axis');x.textContent=dates[0].slice(5);svg.append(x);
  const y=document.createElementNS(svgNS,'text');y.setAttribute('x',W-pad-36);y.setAttribute('y',H-7);y.setAttribute('class','axis');y.textContent=dates[13].slice(5);svg.append(y);
  $('salesChart').replaceChildren(svg);
}

// v31 theme selector: updates preview without saving or changing checkout.
function updateThemePreview() {
  const preview = $('themePreview');
  if (!preview) return;
  preview.dataset.productTheme = $('theme').value;
  preview.style.setProperty('--product-accent', $('useAccent').checked ? $('accentColor').value : '');
  $('themePreviewTitle').textContent = $('productName').value || 'Your product';
}
['theme','accentColor','useAccent','productName'].forEach(id => $(id)?.addEventListener('input', updateThemePreview));
updateThemePreview();


// v34: delete button on every coupon row (permanent)
(function () {
  const box = document.getElementById('couponList');
  if (!box) return;
  function decorate() {
    box.querySelectorAll('.order').forEach(row => {
      if (row.dataset.deleteReady) return;
      const title = row.querySelector('strong');
      if (!title) return;
      row.dataset.deleteReady = '1';
      const code = title.textContent.split(' · ')[0].trim();
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn light';
      btn.textContent = 'Delete';
      btn.style.marginTop = '8px';
      btn.style.marginLeft = '8px';
      btn.addEventListener('click', async () => {
        if (!window.confirm('Coupon ' + code + ' permanently delete karein?')) return;
        try {
          await api('/api/admin/coupons?code=' + encodeURIComponent(code), { method: 'DELETE', body: '{}' });
          if (typeof loadCoupons === 'function') loadCoupons();
        } catch (err) {
          alert('Delete nahi hua: ' + err.message);
        }
      });
      row.appendChild(btn);
    });
  }
  new MutationObserver(decorate).observe(box, { childList: true, subtree: true });
  decorate();
})();
