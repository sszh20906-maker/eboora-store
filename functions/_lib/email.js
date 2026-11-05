import { getProductById } from "./products.js";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function siteBase(env) {
  return String(env.SITE_URL || "https://eboora.shop").replace(/\/$/, "");
}

function money(amount, currency) {
  const code = String(currency || "INR").toUpperCase();
  try { return new Intl.NumberFormat("en-IN", { style: "currency", currency: code }).format(Number(amount || 0)); }
  catch (_) { return `${code} ${Number(amount || 0).toFixed(2)}`; }
}

export function buildDownloadEmail({ env, product, name, orderId, amount, currency, downloadUrl }) {
  const base = siteBase(env);
  const brand = env.BRAND_NAME || "Eboora-Store";
  const support = env.REPLY_TO || "customersupport527@gmail.com";
  const logo = `${base}/assets/brand-emblem.png`;
  const amountText = money(amount, currency);
  const greeting = name ? `Hi ${esc(String(name).split(" ")[0])},` : "Hi there,";
  const safeUrl = esc(downloadUrl);
  const subject = `Your ${product} is ready to download`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Your files for ${esc(product)} are ready. Order ${esc(orderId)}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
<tr><td style="background:#0f172a;padding:20px 28px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td><img src="${esc(logo)}" width="36" height="36" alt="" style="display:block;border-radius:8px"></td>
<td style="padding-left:10px;color:#ffffff;font-size:18px;font-weight:700">${esc(brand)}</td></tr></table></td></tr>
<tr><td style="padding:30px 28px 6px">
<p style="margin:0 0 8px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#0e7490;font-weight:700">Payment confirmed</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;letter-spacing:-.02em;color:#0f172a">Your download is ready</h1>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155">${greeting}</p>
<p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#334155">Thank you for purchasing <strong>${esc(product)}</strong>. Your payment has been verified and your files are ready to download.</p>
</td></tr>
<tr><td style="padding:0 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">
<tr><td style="padding:14px 16px 6px;font-size:13px;color:#64748b">Order ID</td><td align="right" style="padding:14px 16px 6px;font-size:13px;font-weight:700;color:#0f172a">${esc(orderId)}</td></tr>
<tr><td style="padding:6px 16px 14px;font-size:13px;color:#64748b">Amount paid</td><td align="right" style="padding:6px 16px 14px;font-size:13px;font-weight:700;color:#0f172a">${esc(amountText)}</td></tr>
</table></td></tr>
<tr><td align="center" style="padding:26px 28px 8px"><a href="${safeUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:15px 30px;border-radius:12px">Download your files</a></td></tr>
<tr><td style="padding:8px 28px 4px;font-size:13px;line-height:1.6;color:#64748b;text-align:center">Button not working? Copy this link into your browser:<br><a href="${safeUrl}" style="color:#0e7490;word-break:break-all">${safeUrl}</a></td></tr>
<tr><td style="padding:18px 28px 4px;font-size:13px;line-height:1.6;color:#64748b">This link stays valid for 30 days. Please keep it private. For your security, the file is released only after your order is verified.</td></tr>
<tr><td style="padding:16px 28px 26px;font-size:13px;line-height:1.6;color:#64748b;border-top:1px solid #e2e8f0">Need help? Reply to this email or write to <a href="mailto:${esc(support)}" style="color:#0e7490">${esc(support)}</a>. <a href="${esc(base)}/refund.html" style="color:#0e7490">Refund policy</a></td></tr>
</table>
<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;text-align:center">${esc(brand)} · Digital products, delivered online<br>This is a transactional email about your order.</p>
</td></tr></table></body></html>`;
  const text = [
    "Your download is ready",
    "",
    `${name ? "Hi " + String(name).split(" ")[0] + "," : "Hi there,"}`,
    "",
    `Thank you for purchasing ${product}. Your payment has been verified and your files are ready to download.`,
    "",
    `Download your files: ${downloadUrl}`,
    "",
    `Order ID: ${orderId}`,
    `Amount paid: ${amountText}`,
    "",
    "This link stays valid for 30 days. Please keep it private.",
    "",
    `Need help? Reply to this email or write to ${support}.`,
    `Refund policy: ${base}/refund.html`,
    "",
    brand,
  ].join("\n");
  return { subject, html, text };
}

// Sends the buyer's download email. Retries once on a network or server error. The Idempotency-Key stops duplicates.
export async function sendDownloadEmail(env, record, orderId, downloadUrl) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL || !record.customer_email) throw new Error("Resend email configuration or customer email is missing.");
  const product = (await getProductById(env, record.product_id))?.productName || env.PRODUCT_NAME || "your digital product";
  const mail = buildDownloadEmail({ env, product, name: record.customer_name, orderId, amount: record.amount, currency: record.currency, downloadUrl });
  const body = { from: env.FROM_EMAIL, to: [record.customer_email], subject: mail.subject, html: mail.html, text: mail.text, reply_to: env.REPLY_TO || "customersupport527@gmail.com" };
  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `download-${orderId}` },
        body: JSON.stringify(body),
      });
      if (response.ok) return;
      lastError = `status ${response.status}: ${(await response.text()).slice(0, 300)}`;
      if (response.status < 500) break;
    } catch (error) { lastError = String(error); }
  }
  console.error("Download email failed", orderId, lastError);
  throw new Error("Download email delivery failed.");
}
