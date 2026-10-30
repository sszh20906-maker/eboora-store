// GET /api/admin/orders?status=ALL|CREATED|PAID|FAILED|CANCELLED (owner only)
import { json } from "../../_lib/commerce.js";
import { requireAdmin } from "../../_lib/admin.js";

const STATUSES = ["ALL", "CREATED", "PAID", "FAILED", "CANCELLED"];

export async function onRequestGet({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const status = new URL(request.url).searchParams.get("status") || "ALL";
  if (!STATUSES.includes(status)) return json({ error: "Invalid status filter." }, 400);

  try {
    const summaryResult = await env.ORDERS_DB.prepare(
      "SELECT status, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM orders GROUP BY status"
    ).all();
    const summary = {};
    for (const row of summaryResult.results || []) {
      summary[row.status] = { count: Number(row.count) || 0, total: Number(row.total) || 0 };
    }

    const todayRow = await env.ORDERS_DB.prepare(
      "SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM orders WHERE status = 'PAID' AND date(paid_at) = date('now')"
    ).first();
    const today = { count: Number(todayRow?.count) || 0, total: Number(todayRow?.total) || 0 };

    const binds = [];
    let sql = `SELECT order_id, amount, currency, customer_name, customer_email, customer_phone, status, email_status, created_at, paid_at,
      (SELECT COALESCE(SUM(amount), 0) FROM refunds WHERE refunds.order_id = orders.order_id) AS refunded FROM orders`;
    if (status !== "ALL") { sql += " WHERE status = ?"; binds.push(status); }
    sql += " ORDER BY created_at DESC LIMIT 200";
    const listResult = await env.ORDERS_DB.prepare(sql).bind(...binds).all();

    const chart = await env.ORDERS_DB.prepare("SELECT date(COALESCE(paid_at, updated_at)) AS day, COALESCE(SUM(amount), 0) AS total FROM orders WHERE status = 'PAID' AND date(COALESCE(paid_at, updated_at)) >= date('now', '-13 days') GROUP BY day ORDER BY day").all();
    return json({ summary, today, revenueByDay: chart.results || [], orders: listResult.results || [] });
  } catch (error) {
    console.error("Admin orders query failed", error);
    return json({ error: "Orders could not be loaded. Please try again." }, 503);
  }
}
