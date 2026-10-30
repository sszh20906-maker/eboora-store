const $ = id => document.getElementById(id);
const STATUS_LABEL = { PAID: 'Paid', CREATED: 'Unpaid', FAILED: 'Failed', CANCELLED: 'Cancelled' };
let storeProductName = '';

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

function readForm() {
  return {
    brand: $('brand').value,
    email: $('email').value,
    productName: $('productName').value,
    eyebrow: $('eyebrow').value,
    headline: $('headline').value,
    description: $('description').value,
    price: $('price').value,
    mrp: $('mrp').value,
    coverImage: $('coverImage').value,
    benefits: lines($('benefits').value).map(l => { const [title, description] = splitPipe(l); return { title, description }; }),
    included: lines($('included').value).map(title => ({ title })),
    faqs: lines($('faqs').value).map(l => { const [question, answer] = splitPipe(l); return { question, answer }; }).filter(f => f.question && f.answer),
    reviews: lines($('reviews').value).map(l => { const [name, text] = splitPipe(l); return { name, text }; }).filter(r => r.text),
    makerName: $('makerName').value,
    makerLine: $('makerLine').value,
    whatsapp: $('whatsapp').value,
    legal: $('legal').value,
    responseTime: $('responseTime').value,
    pixelId: $('pixelId').value
  };
}

function fillForm(c) {
  c = c || {};
  storeProductName = c.productName || '';
  $('brand').value = c.brand || 'Eboora-Store';
  $('email').value = c.email || '';
  $('productName').value = c.productName || '';
  $('eyebrow').value = c.eyebrow || 'Digital download';
  $('headline').value = c.headline || '';
  $('description').value = c.description || '';
  $('price').value = c.price || '';
  $('mrp').value = c.mrp || '';
  $('coverImage').value = c.coverImage || '/assets/cover.svg';
  $('benefits').value = (c.benefits || []).map(b => b.description ? b.title + ' | ' + b.description : b.title).join('\n');
  $('included').value = (c.included || []).map(x => x.title).join('\n');
  $('faqs').value = (c.faqs || []).map(f => f.question + ' | ' + f.answer).join('\n');
  $('reviews').value = (c.reviews || []).map(r => r.name + ' | ' + r.text).join('\n');
  $('makerName').value = (c.maker && c.maker.name) || 'Eboora Creator';
  $('makerLine').value = (c.maker && c.maker.line) || 'Questions about your purchase? Contact our support team.';
  $('whatsapp').value = c.whatsapp || '';
  $('legal').value = c.legal || '';
  $('responseTime').value = c.responseTime || '1 business day';
  $('pixelId').value = c.pixelId && c.pixelId !== 'YOUR_PIXEL_ID' ? c.pixelId : '';
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
    const d = await api('/api/admin/config');
    $('loginCard').classList.add('hidden');
    $('app').classList.remove('hidden');
    fillForm(d.config);
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
    const d = await api('/api/admin/config', { method: 'PUT', body: JSON.stringify(readForm()) });
    storeProductName = d.config.productName;
    setSaveMsg('Save ho gaya. Storefront par ab yahi details dikhengi.', 'ok');
  } catch (err) {
    setSaveMsg(err.message, 'bad');
  } finally {
    $('saveBtn').disabled = false;
  }
});

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
