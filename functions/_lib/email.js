import { getProductById } from "./products.js";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function sendDownloadEmail(env, record, orderId, downloadUrl) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL || !record.customer_email) throw new Error("Resend email configuration or customer email is missing.");
  const product = (await getProductById(env, record.product_id))?.productName || env.PRODUCT_NAME || "your digital product";
  const brand = env.BRAND_NAME || "Eboora-Store";
  const safeUrl = esc(downloadUrl);
  const html = `<div style="font-family:Arial,sans-serif;max-width:540px;margin:auto;color:#111827;line-height:1.65">
<h1 style="font-size:24px;line-height:1.2">Your download is ready</h1>
<p>Thank you for purchasing <strong>${esc(product)}</strong>. Your payment has been confirmed.</p>
<p><a href="${safeUrl}" style="display:inline-block;background:#3E49E8;color:#fff;padding:14px 22px;border-radius:10px;text-decoration:none;font-weight:bold">Download your files</a></p>
<p style="font-size:13px;color:#5E6678">For your security, this link checks the order status before sending the file. Keep it private.</p>
<p style="font-size:13px;color:#5E6678">Order ID: ${esc(orderId)}<br>Need help? Reply to this email.${brand ? `<br>${esc(brand)}` : ""}</p></div>`;
  const body = { from: env.FROM_EMAIL, to: [record.customer_email], subject: `Your ${product} download`, html };
  if (env.REPLY_TO) body.reply_to = env.REPLY_TO;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `download-${orderId}`
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    console.error("Resend failed", response.status, await response.text());
    throw new Error("Download email delivery failed.");
  }
}
