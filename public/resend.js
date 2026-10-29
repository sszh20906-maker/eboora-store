const form = document.getElementById('resendForm');
const msg = document.getElementById('resendMsg');
const btn = document.getElementById('resendBtn');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  btn.disabled = true;
  msg.className = 'msg';
  msg.textContent = 'Sending...';
  try {
    const r = await fetch('/api/resend-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: document.getElementById('resendEmail').value })
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { msg.className = 'msg ok'; msg.textContent = d.message; }
    else { msg.className = 'msg bad'; msg.textContent = d.error || 'Something went wrong. Please try again.'; }
  } catch (err) {
    msg.className = 'msg bad';
    msg.textContent = 'Network error. Please try again.';
  } finally {
    btn.disabled = false;
  }
});
