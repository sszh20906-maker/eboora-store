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


// Export non-paid checkout leads only. CSV is generated server-side, not from the 200-row UI preview.
export async function onRequestPost({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  if (!env.ORDERS_DB) return json({ error: "Database unavailable." }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  if (body?.action !== "delete" || !/^[A-Za-z0-9_-]{1,128}$/.test(String(body.order_id || ""))) return json({ error: "Invalid request." }, 400);
  try {
    // Do not erase paid orders, payment receipts, or financial records.
    const row = await env.ORDERS_DB.prepare("SELECT status FROM orders WHERE order_id = ? LIMIT 1").bind(body.order_id).first();
    if (!row) return json({ error: "Order not found." }, 404);
    if (!['CREATED','FAILED','CANCELLED'].includes(row.status)) return json({ error: "Paid orders cannot be deleted." }, 409);
    // Prevent deleting orders with payment receipts, refunds or a paid state race.
    const receipts = await env.ORDERS_DB.prepare("SELECT COUNT(*) AS n FROM payment_receipts WHERE order_id = ?").bind(body.order_id).first();
    const refunds = await env.ORDERS_DB.prepare("SELECT COUNT(*) AS n FROM refunds WHERE order_id = ?").bind(body.order_id).first();
    if (Number(receipts?.n) || Number(refunds?.n)) return json({ error: "Order has financial records and cannot be deleted." }, 409);
    const result = await env.ORDERS_DB.prepare("DELETE FROM orders WHERE order_id = ? AND status IN ('CREATED','FAILED','CANCELLED') AND NOT EXISTS (SELECT 1 FROM payment_receipts WHERE order_id = ?) AND NOT EXISTS (SELECT 1 FROM refunds WHERE order_id = ?)").bind(body.order_id, body.order_id, body.order_id).run();
    if (!result.meta?.changes) return json({ error: "Order was changed or could not be deleted." }, 409);
    return json({ ok: true });
  } catch (error) {
    console.error('Order deletion failed', error);
    return json({ error: "Unable to delete order. Check database migration and dependencies." }, 503);
  }
}

const csvCell = value => '"' + String(value ?? '').replace(/^[=+@\-\t\r]/, "'" ).replace(/"/g, '""') + '"';
export async function onRequestPut({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  if (!env.ORDERS_DB) return json({ error: "Database unavailable." }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  const status = body?.status;
  if (!['ALL','CREATED','FAILED','CANCELLED'].includes(status)) return json({ error: "Invalid export filter." }, 400);
  const where = status === 'ALL' ? "status IN ('CREATED','FAILED','CANCELLED')" : 'status = ?';
  const statement = env.ORDERS_DB.prepare(`SELECT order_id, customer_name, customer_email, customer_phone, amount, currency, status, created_at FROM orders WHERE ${where} ORDER BY created_at DESC LIMIT 5000`);
  try {
    const rows = (await (status === 'ALL' ? statement : statement.bind(status)).all()).results || [];
    const cols = ['order_id','customer_name','customer_email','customer_phone','amount','currency','status','created_at'];
    const csv = [cols.join(','), ...rows.map(row => cols.map(key => csvCell(row[key])).join(','))].join('\r\n');
    return new Response('\uFEFF' + csv, { headers: { 'Content-Type':'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="eboora-unpaid-orders.csv"', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' } });
  } catch (error) { console.error('Order export failed', error); return json({ error: 'Unable to export orders.' }, 503); }
}
