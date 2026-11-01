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
  if (!r.ok) { const err = new Error(d.error || ('Request failed (' + r.status + ')')); err.status = r.status; throw err; }
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
    videoUrl: $('videoUrl').value.trim(),
    galleryImages: lines($('galleryImages').value),
    descriptionFont: $('descriptionFont').value,
    descriptionSize: Number($('descriptionSize').value),
    descriptionColor: $('descriptionColor').value,
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
  $('headlineFont').value = ['Manrope','system-ui','Georgia','Arial','Poppins','Montserrat','Playfair Display','Space Grotesk'].includes(p.headlineFont) ? p.headlineFont : 'Manrope';
  $('headlineSize').value = Number(p.headlineSize) >= 24 && Number(p.headlineSize) <= 64 ? p.headlineSize : 48;
  $('headlineColor').value = /^#[0-9a-fA-F]{6}$/.test(p.headlineColor || '') ? p.headlineColor : '#15172b';
  $('description').value = p.description || '';
  $('videoUrl').value = p.videoUrl || '';
  $('galleryImages').value = (p.galleryImages || []).join('\n');
  $('descriptionFont').value = p.descriptionFont || 'system-ui';
  $('descriptionSize').value = p.descriptionSize || 17;
  $('descriptionColor').value = /^#[0-9a-fA-F]{6}$/.test(p.descriptionColor || '') ? p.descriptionColor : '#475569';
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
  return 'Hello ' + first + ', you started an order for ' + product + ' but did not complete checkout. If you need assistance, reply to this message. View our store: ' + location.origin + '/';
}

function orderCard(o) {
  const card = el('div', 'order');
  const badgeClass = o.status === 'PAID' ? 'badge b-paid' : (o.status === 'CREATED' ? 'badge b-open' : 'badge b-other');
  const head = el('div', 'order-head');
  head.append(el('strong', '', o.customer_name || 'Name unavailable'), el('span', badgeClass, STATUS_LABEL[o.status] || o.status));
  card.append(head);
  card.append(el('div', 'muted', money(o.amount) + ' · ' + localTime(o.created_at)));
  card.append(el('div', 'muted', 'Phone: ' + (o.customer_phone || '-') + ' · Email: ' + (o.customer_email || '-')));
  card.append(el('div', 'muted', 'Order ID: ' + o.order_id));

  if (o.status !== 'PAID') {
    const actions = el('div', 'row');
    actions.style.marginTop = '8px';
    const msg = followUpMessage(o);
    if (o.customer_phone) {
      const wa = el('a', 'btn wa', 'WhatsApp');
      wa.href = 'https://wa.me/91' + o.customer_phone + '?text=' + encodeURIComponent(msg);
      wa.target = '_blank';
      wa.rel = 'noopener';
      actions.append(wa);
    }
    if (o.customer_email) {
      const mail = el('a', 'btn light', 'Email');
      mail.href = 'mailto:' + o.customer_email + '?subject=' + encodeURIComponent('Aapka order - ' + storeProductName) + '&body=' + encodeURIComponent(msg);
      actions.append(mail);
    }
    card.append(actions);
  }
  if (o.refunded) card.append(el('div', 'muted', 'Refunded: ' + money(o.refunded)));
  if (o.status === 'PAID') {
    const refundBtn = el('button', 'btn light', 'Record refund');
    refundBtn.type = 'button';
    refundBtn.style.marginTop = '8px';
    refundBtn.addEventListener('click', () => recordRefund(o));
    card.append(refundBtn);
  }
  if (true) {
    const actions = el('div', 'order-actions');
    const select = el('input'); select.type='checkbox'; select.className='order-check'; select.value=o.order_id; select.setAttribute('aria-label','Select order '+o.order_id); actions.append(select);
    const remove = el('button', 'btn danger-action', 'Delete order');
    remove.type = 'button';
    remove.addEventListener('click', async () => {
      if (!confirm('Permanently delete this order? Paid buyers may lose download access. Payment receipts and a minimal financial audit will be retained. This cannot be undone.')) return;
      remove.disabled = true;
      try { await api('/api/admin/orders', { method:'POST', body: JSON.stringify({ action:'delete', order_id:o.order_id }) }); await loadOrders(); }
      catch (err) { $('ordersMsg').textContent = err.message; remove.disabled = false; }
    });
    actions.append(remove); card.append(actions);
  }
  return card;
}

function renderToday(t) {
  $('todayCount').textContent = t.count;
  $('todayTotal').textContent = money(t.total);
}

async function recordRefund(o) {
  const left = Number(o.amount) - Number(o.refunded || 0);
  const amountText = prompt('Refund amount (maximum ₹' + left + ')', String(left));
  if (amountText === null) return;
  const note = prompt('Refund note (optional)', '') || '';
  try {
    await api('/api/admin/refunds', { method: 'POST', body: JSON.stringify({ order_id: o.order_id, amount: Number(amountText), note }) });
    await loadOrders();
    $('ordersMsg').textContent = 'Refund recorded. Process the actual refund separately in Cashfree.';
  } catch (err) {
    $('ordersMsg').textContent = 'Refund could not be recorded: ' + err.message;
  }
}

async function loadOrders() {
  $('ordersMsg').textContent = 'Loading orders…';
  try {
    const params = new URLSearchParams({ status: $('statusFilter').value, q: $('orderSearch')?.value.trim() || '' });
    const d = await api('/api/admin/orders?' + params.toString());
    renderSummary(d.summary || {});
    renderToday(d.today || { count: 0, total: 0 });
    drawOverview(d);
    const list = d.orders || [];
    const selection = $('bulkDeleteBtn'); if (selection) selection.disabled = !list.length;
    $('orderList').replaceChildren(...list.map(orderCard));
    $('ordersMsg').textContent = list.length ? '' : 'No orders match this filter.';
  } catch (err) {
    $('ordersMsg').textContent = 'Unable to load orders: ' + err.message;
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
    if (!r.ok) { showLoginError(d.error || 'Unable to log in.'); return; }
    $('loginPassword').value = '';
    openAdmin();
  } catch (err) {
    showLoginError('Network error. Please try again.');
  }
});

$('statusFilter').addEventListener('change', loadOrders);
let orderSearchTimer;
$('orderSearch')?.addEventListener('input', () => { clearTimeout(orderSearchTimer); orderSearchTimer = setTimeout(loadOrders, 250); });
$('refreshBtn').addEventListener('click', loadOrders);
$('bulkDeleteBtn').addEventListener('click', async () => {
  const ids = [...document.querySelectorAll('#orderList .order-check:checked')].map(x => x.value);
  if (!ids.length) { $('ordersMsg').textContent = 'Select orders first.'; return; }
  if (!confirm(`Permanently delete ${ids.length} orders? Paid buyers may lose download access. Financial audit data remains. This cannot be undone.`)) return;
  const btn = $('bulkDeleteBtn'); btn.disabled = true;
  try { await api('/api/admin/orders', { method:'POST',body:JSON.stringify({action:'bulk_delete',order_ids:ids}) }); await loadOrders(); }
  catch(e) { $('ordersMsg').textContent=e.message; } finally { btn.disabled=false; }
});
$('exportOrdersBtn').addEventListener('click', async () => {
  const button = $('exportOrdersBtn'); button.disabled = true;
  try {
    const selected = $('statusFilter').value;
    const status = selected;
    const response = await fetch('/api/admin/orders', { method:'PUT', credentials:'same-origin', cache:'no-store', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status}) });
    if (!response.ok) throw new Error((await response.json().catch(()=>({}))).error || 'Export failed');
    const blob = await response.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'eboora-' + status.toLowerCase() + '-leads.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch (err) { $('ordersMsg').textContent = err.message; }
  finally { button.disabled = false; }
});
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
  setSaveMsg('Saving changes…', '');
  try {
    const d = await api('/api/admin/products', { method: 'POST', body: JSON.stringify(readForm()) });
    currentProduct = d.product;
    storeProductName = d.product.productName;
    $('slug').value = d.product.slug;
    $('mediaArea').classList.remove('hidden');
    $('mediaNote').classList.add('hidden');
    renderMedia(d.product);
    setSaveMsg('Saved successfully. Product link: ' + location.origin + '/landing.html?slug=' + d.product.slug, 'ok');
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
    if (!list.length) box.append(el('p', 'muted', 'No coupons yet.'));
  } catch (err) {
    setCouponMsg('Unable to load coupons: ' + err.message, 'bad');
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
  const toggle = el('button', 'btn light', c.active ? 'Disable' : 'Enable');
  toggle.type = 'button';
  toggle.style.marginTop = '8px';
  toggle.addEventListener('click', () => saveCoupon({ code: c.code, type: c.type, value: c.value, max_uses: c.max_uses, expires_at: c.expires_at, active: !c.active }));
  row.append(toggle);
  return row;
}

async function saveCoupon(body) {
  try {
    await api('/api/admin/coupons', { method: 'POST', body: JSON.stringify(body) });
    setCouponMsg('Coupon saved.', 'ok');
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
    box.append(el('p', 'muted', 'No products yet. Select New product to create one.'));
    return;
  }
  list.forEach(p => {
    const row = el('div', 'order');
    const head = el('div', 'order-head');
    const label = p.status === 'published' ? 'Live' : (p.status === 'draft' ? 'Draft' : 'Hidden');
    head.append(el('strong', '', p.productName || 'Untitled product'), el('span', p.status === 'published' ? 'badge b-paid' : 'badge b-other', label));
    const thumbnail = el('img', 'product-thumb');
    thumbnail.src = p.coverUrl || p.coverImage || '/assets/cover.svg';
    thumbnail.alt = ''; thumbnail.loading = 'lazy';
    thumbnail.onerror = () => { thumbnail.onerror = null; thumbnail.src = '/assets/cover.svg'; };
    row.append(thumbnail);
    row.append(head);
    row.append(el('div', 'muted', money(p.price) + '  ·  ' + location.origin + '/landing.html?slug=' + p.slug));
    const actions = el('div', 'row');
    actions.style.marginTop = '8px';
    const copy = el('button', 'btn light', 'Copy link');
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
    setListMsg('Unable to load products: ' + err.message, 'bad');
  }
}

function openEditor(p) {
  fillForm(p || null);
  $('editorTitle').textContent = p ? 'Edit product' : 'New product';
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
    setListMsg('Product link copied: ' + url, 'ok');
  } catch (err) {
    window.prompt('Copy this link:', url);
  }
}

async function deleteProduct(p) {
  if (!window.confirm('"' + (p.productName || p.slug) + '" delete? Existing purchases will be protected by archiving when required.')) return;
  const permanent = window.confirm('Permanently delete the product? Existing purchase download links could stop working. Cancel to archive instead.');
  if (permanent && window.prompt('Permanent deletion confirm karne ke liye DELETE likho:') !== 'DELETE') return;
  try {
    const d = await api('/api/admin/products?id=' + encodeURIComponent(p.id) + (permanent ? '&force=PERMANENT_DELETE' : ''), { method: 'DELETE', body: '{}' });
    if (currentProduct && currentProduct.id === p.id) closeEditor();
    setListMsg(d.archived ? d.message : 'Product permanently deleted.', 'ok');
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
  if (!selected.files?.length) { setMediaStatus('Select a file first.', 'bad'); return; }
  if (!currentProduct) {
    if (!$('settingsForm').reportValidity()) { setMediaStatus('Complete required product details first.', 'bad'); return; }
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
  if (!file) { setMediaStatus('Select a file first.', 'bad'); return; }
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const type = file.type || TYPE_BY_EXT[ext] || 'application/octet-stream';
  setMediaStatus('Uploading file… Large files may take longer.', '');
  try {
    const r = await fetch('/api/admin/upload?kind=' + kind + '&id=' + encodeURIComponent(currentProduct.id), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': type, 'X-File-Name': encodeURIComponent(file.name) },
      body: file
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Upload failed.');
    input.value = '';
    currentProduct = d.product;
    renderMedia(d.product);
    setMediaStatus('Upload completed.', 'ok');
    loadProducts();
  } catch (err) {
    setMediaStatus(err.message, 'bad');
  }
}

async function removeMedia(kind) {
  if (!currentProduct) return;
  if (!window.confirm(kind === 'cover' ? 'Remove this cover image?' : 'Remove this digital file? Customers will lose download access until a replacement is uploaded.')) return;
  try {
    const r = await fetch('/api/admin/upload?kind=' + kind + '&id=' + encodeURIComponent(currentProduct.id), {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Unable to remove this file.');
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
  const title = $('workspaceTitle'); if (title) title.textContent = ({overview:'Overview',orders:'Orders',products:'Products',coupons:'Coupons',editor:'Product studio',storefront:'Storefront studio'})[tab] || 'Overview';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => setTab(btn.dataset.tab)));
$('previewBtn').addEventListener('click', async () => {
  const f = readForm();
  const config = { ...f, maker: { name: f.makerName, line: f.makerLine } };
  const cover = $('coverInput').files?.[0];
  if (cover) {
    if (!['image/jpeg','image/png','image/webp'].includes(cover.type) || cover.size > 2 * 1024 * 1024) {
      setSaveMsg('Preview cover must be JPG, PNG or WebP under 2 MB.', 'bad'); return;
    }
    try {
      config.coverImage = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result);
        reader.onerror = reject; reader.readAsDataURL(cover);
      });
    } catch { setSaveMsg('Unable to load cover preview.', 'bad'); return; }
  }
  try { localStorage.setItem('eboora-preview-config', JSON.stringify(config)); }
  catch { setSaveMsg('Preview storage is full. Try a smaller image.', 'bad'); return; }
  const modal=$('productPreviewModal'),frame=$('productPreviewFrame');
  modal.classList.add('open'); document.body.style.overflow='hidden';
  if(!frame.src || !frame.src.includes('preview=1')) frame.src='/landing.html?preview=1&v=49';
  else { try { frame.contentWindow.postMessage({type:'eboora-preview-update',config},location.origin); } catch(_) { frame.src='/landing.html?preview=1&v=49'; } }
});
// V49: responsive preview modes and live updates while editing.
(function(){
 const modal=$('productPreviewModal'),frame=$('productPreviewFrame'); if(!modal||!frame)return;
 function close(){modal.classList.remove('open');document.body.style.overflow='';}
 $('closeProductPreview').addEventListener('click',close);
 modal.addEventListener('click',e=>{if(e.target===modal)close()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))close()});
 modal.querySelectorAll('[data-preview-size]').forEach(btn=>btn.addEventListener('click',()=>{
  modal.querySelectorAll('[data-preview-size]').forEach(x=>x.setAttribute('aria-pressed',String(x===btn)));
  frame.classList.remove('mobile','tablet'); if(btn.dataset.previewSize!=='desktop')frame.classList.add(btn.dataset.previewSize);
 }));
 let timer; const ids=['productName','brand','email','eyebrow','headline','headlineFont','headlineSize','headlineColor','description','descriptionFont','descriptionSize','descriptionColor','price','mrp','coverImage','deliveryUrl','theme','accentColor','useAccent','benefits','included','faqs','reviews','makerName','makerLine','whatsapp','legal','responseTime','fontTheme'];
 function send(){if(!modal.classList.contains('open')||!frame.contentWindow)return;const f=readForm();const config={...f,maker:{name:f.makerName,line:f.makerLine}};try{localStorage.setItem('eboora-preview-config',JSON.stringify(config));frame.contentWindow.postMessage({type:'eboora-preview-update',config},location.origin)}catch(_){}}
 ids.forEach(id=>$(id)?.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(send,180)}));
 frame.addEventListener('load',()=>{try{const config=JSON.parse(localStorage.getItem('eboora-preview-config')||'{}');frame.contentWindow.postMessage({type:'eboora-preview-update',config},location.origin)}catch(_){}});
})();
function drawOverview(d) {
  const paid = d.summary?.PAID || { count: 0, total: 0 };
  const created = d.summary?.CREATED || { count: 0, total: 0 };
  const failed = d.summary?.FAILED || { count: 0, total: 0 };
  const cancelled = d.summary?.CANCELLED || { count: 0, total: 0 };
  const metrics = [['Total revenue', money(paid.total)], ['Paid orders', paid.count], ['Pending checkouts', created.count], ['Today revenue', money(d.today?.total)], ['Failed payments', failed.count], ['Cancelled orders', cancelled.count]];
  $('overviewStats').replaceChildren(...metrics.map(([label, value]) => { const x=el('div','stat'); x.append(el('span','muted',label),el('b','',String(value)));return x; }));
  const customers = d.customerStats || { customers: 0, paidOrders: 0 };
  const snapshot = $('customerSnapshot');
  if (snapshot) snapshot.replaceChildren(...[['Unique customers', customers.customers], ['Paid transactions', customers.paidOrders], ['Average order value', paid.count ? money(paid.total / paid.count) : money(0)]].map(([label,value]) => { const row=el('div','customer-metric'); row.append(el('span','',label),el('strong','',String(value))); return row; }));
  const products = $('topProducts');
  if (products) { const rows = d.topProducts || []; products.replaceChildren(...(rows.length ? rows.map((item,index) => { const row=el('div','top-product-row'); row.append(el('span','top-product-rank',String(index+1)), (()=>{const box=el('div');box.append(el('div','top-product-name',item.name || 'Product'),el('div','top-product-meta',`${Number(item.sales)||0} paid sales`));return box;})(), el('div','top-product-revenue',money(item.revenue))); return row; }) : [el('p','muted','No paid product sales yet.') ])); }
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

// V48: editable HEX fields paired with native colour pickers.
(function addHexEditors(){
  [['accentColor','Accent HEX'],['headlineColor','Headline HEX'],['descriptionColor','Body text HEX']].forEach(([id,label])=>{
    const picker=$(id); if(!picker||document.getElementById(id+'Hex'))return;
    const input=document.createElement('input');input.type='text';input.id=id+'Hex';input.inputMode='text';input.autocomplete='off';input.maxLength=7;input.placeholder='#D97706';input.setAttribute('aria-label',label);input.className='hex-code-input';input.style.cssText='width:100%;margin-top:7px;font-family:monospace;text-transform:uppercase';
    picker.insertAdjacentElement('afterend',input);
    input.value=picker.value.toUpperCase();
    picker.addEventListener('input',()=>{input.value=picker.value.toUpperCase();updateThemePreview()});
    input.addEventListener('input',()=>{const v=input.value.trim();if(/^#[0-9a-fA-F]{6}$/.test(v)){picker.value=v;picker.dispatchEvent(new Event('input',{bubbles:true}));}});
    input.addEventListener('change',()=>{if(!/^#[0-9a-fA-F]{6}$/.test(input.value.trim())){input.value=picker.value.toUpperCase();return;}picker.value=input.value.trim();picker.dispatchEvent(new Event('input',{bubbles:true}));});
  });
})();

// v31 theme selector: updates preview without saving or changing checkout.
function updateThemePreview() {
  const preview = $('themePreview');
  if (!preview) return;
  preview.dataset.productTheme = $('theme').value;
  preview.style.setProperty('--product-accent', $('useAccent').checked ? $('accentColor').value : '');
  preview.style.setProperty('--preview-headline', $('headlineColor').value);
  preview.style.setProperty('--preview-body', $('descriptionColor').value);
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
        if (!window.confirm('Coupon ' + code + ' permanently delete?')) return;
        try {
          await api('/api/admin/coupons?code=' + encodeURIComponent(code), { method: 'DELETE', body: '{}' });
          if (typeof loadCoupons === 'function') loadCoupons();
        } catch (err) {
          alert('Unable to delete: ' + err.message);
        }
      });
      row.appendChild(btn);
    });
  }
  new MutationObserver(decorate).observe(box, { childList: true, subtree: true });
  decorate();
})();

// Standalone homepage video editor; never stores video bytes in D1.
async function loadStorefrontVideo(){
  try { const d=await api('/api/admin/storefront'); $('homeVideoUrl').value=d.videoUrl||''; }
  catch(err){ $('storefrontMsg').textContent=err.message; }
}
$('storefrontForm').addEventListener('submit',async e=>{
  e.preventDefault(); const btn=e.target.querySelector('button[type=submit]'); btn.disabled=true;
  try { await api('/api/admin/storefront',{method:'PUT',body:JSON.stringify({videoUrl:$('homeVideoUrl').value.trim()})}); $('storefrontMsg').textContent='Storefront video saved.'; }
  catch(err){ $('storefrontMsg').textContent=err.message; }
  finally {btn.disabled=false;}
});
loadStorefrontVideo();

// V46: accessible visual theme presets; uses existing persisted product.theme field.
(function(){
 const select=document.getElementById('theme'),gallery=document.getElementById('themeGallery');
 if(!select||!gallery)return;
 const presets=[
 ['tech','Signature Cyan','Modern digital commerce','#f2fbfd','#102c3a','#06b6d4'],
 ['navy','Midnight Commerce','Confident, classic navy','#0e1d34','#f8fbff','#54b8f6'],
 ['luxury','Luxury Editorial','Black and champagne gold','#131719','#fff8e9','#d6b875'],
 ['aggressive','Fitness Impact','High-energy charcoal and red','#1c1d20','#fff','#f1494d'],
 ['soft','Minimal Studio','Soft, calm and refined','#faf7f2','#293343','#a6b9a6'],
 ['forest','Emerald Growth','Natural green and cream','#103f34','#f9fff7','#b9ebbc']
 ];
 for(const [value,title,subtitle,bg,fg,accent] of presets){
  const button=document.createElement('button');button.type='button';button.className='theme-tile';button.dataset.value=value;
  button.style.setProperty('--tile-bg',bg);button.style.setProperty('--tile-fg',fg);button.style.setProperty('--tile-accent',accent);
  const swatch=document.createElement('div');swatch.className='swatch';const cta=document.createElement('span');cta.textContent='Get access';swatch.append(cta);
  const name=document.createElement('strong');name.textContent=title;const detail=document.createElement('small');detail.textContent=subtitle;
  button.append(swatch,name,detail);button.addEventListener('click',()=>{select.value=value;select.dispatchEvent(new Event('input',{bubbles:true}));sync();});gallery.append(button);
 }
 function sync(){gallery.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.value===select.value)));}
 select.addEventListener('change',sync);select.addEventListener('input',sync);
 // Editing existing products updates select programmatically; sync after product form interactions.
 document.addEventListener('click',e=>{if(e.target.closest('.nav-btn,.product-rows,.editor-top'))setTimeout(sync,0)});
 const observer=new MutationObserver(sync);observer.observe(select,{attributes:true,attributeFilter:['value']});sync();
})();

const overviewRefresh = document.getElementById('overviewRefresh'); if (overviewRefresh) overviewRefresh.addEventListener('click', async () => { overviewRefresh.disabled = true; try { await loadOrders(); } finally { overviewRefresh.disabled = false; } });

// V55: owner-managed store identity, SEO, social links and optional analytics IDs.
const siteFieldMap={siteBrand:'brand',siteTagline:'tagline',siteLogo:'logoUrl',siteSupportEmail:'supportEmail',siteOgImage:'ogImage',siteSeoTitle:'seoTitle',siteSeoDescription:'seoDescription',siteInstagram:'instagram',siteYoutube:'youtube',siteFacebook:'facebook',siteX:'x',sitePrivacy:'privacyUrl',siteTerms:'termsUrl',siteRefund:'refundUrl',sitePixel:'pixelId',siteGa:'gaId'};
async function loadSiteSettings(){try{const d=await api('/api/admin/site-settings');const s=d.settings||{};for(const [id,key] of Object.entries(siteFieldMap)){const node=$(id);if(node)node.value=s[key]||''}}catch(e){$('siteSettingsMsg').textContent=e.message}}
const siteSettingsForm=$('siteSettingsForm');
if(siteSettingsForm){siteSettingsForm.addEventListener('submit',async e=>{e.preventDefault();const btn=siteSettingsForm.querySelector('button[type=submit]');btn.disabled=true;$('siteSettingsMsg').textContent='Saving settings…';const settings={};for(const [id,key] of Object.entries(siteFieldMap))settings[key]=$(id)?.value.trim()||'';try{await api('/api/admin/site-settings',{method:'PUT',body:JSON.stringify(settings)});$('siteSettingsMsg').textContent='Site settings saved. Public SEO metadata will update on the next page load.'}catch(err){$('siteSettingsMsg').textContent=err.message}finally{btn.disabled=false}});}
loadSiteSettings();
