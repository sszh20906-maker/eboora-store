// POST /api/admin/refunds - records a refund the owner has already made in the Cashfree dashboard.
// It keeps the records accurate; it does not move money by itself.
import { json, validOrderId } from "../../_lib/commerce.js";
import { requireAdmin } from "../../_lib/admin.js";

export async function onRequestPost({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  let input;
  try { input = await request.json(); } catch { return json({ error: "Invalid data sent." }, 400); }

  const orderId = String(input?.order_id ?? "");
  if (!validOrderId(orderId)) return json({ error: "Order ID is not valid." }, 400);
  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!(amount > 0) || amount > 1000000) return json({ error: "Refund amount must be greater than 0." }, 400);
  const note = String(input.note ?? "").trim().slice(0, 200);

  try {
    const order = await env.ORDERS_DB.prepare("SELECT amount, status FROM orders WHERE order_id = ? LIMIT 1").bind(orderId).first();
    if (!order) return json({ error: "Order not found." }, 404);
    if (order.status !== "PAID") return json({ error: "Only paid orders can be refunded." }, 400);
    const sum = await env.ORDERS_DB.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM refunds WHERE order_id = ?").bind(orderId).first();
    const already = Number(sum?.total) || 0;
    if (Math.round((already + amount) * 100) > Math.round(Number(order.amount) * 100)) {
      return json({ error: "This refund would be more than the amount paid." }, 400);
    }
    await env.ORDERS_DB.prepare("INSERT INTO refunds (order_id, amount, note) VALUES (?, ?, ?)").bind(orderId, amount, note).run();
    return json({ ok: true, refunded: Math.round((already + amount) * 100) / 100 }, 201);
  } catch (error) {
    console.error("Refund record failed", orderId, error);
    return json({ error: "Refund could not be recorded. Please try again." }, 503);
  }
}
