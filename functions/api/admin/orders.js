// GET /api/admin/orders?status=ALL|CREATED|PAID|FAILED|CANCELLED (owner only)
import { json } from "../../_lib/commerce.js";
import { requireAdmin } from "../../_lib/admin.js";

async function ensureArchive(env) {
  const statement = env.ORDERS_DB.prepare(`CREATE TABLE IF NOT EXISTS admin_hidden_orders (
    order_id TEXT PRIMARY KEY, hidden_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  if (typeof statement.run === 'function') await statement.run();
}
const VISIBLE = "NOT EXISTS (SELECT 1 FROM admin_hidden_orders h WHERE h.order_id = orders.order_id)";
const STATUSES = ["ALL", "CREATED", "PAID", "FAILED", "CANCELLED"];

export async function onRequestGet({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const status = new URL(request.url).searchParams.get("status") || "ALL";
  if (!STATUSES.includes(status)) return json({ error: "Invalid status filter." }, 400);

  try {
    await ensureArchive(env);
    const summaryResult = await env.ORDERS_DB.prepare(
      `SELECT status, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM orders WHERE ${VISIBLE} GROUP BY status`
    ).all();
    const summary = {};
    for (const row of summaryResult.results || []) {
      summary[row.status] = { count: Number(row.count) || 0, total: Number(row.total) || 0 };
    }

    const todayRow = await env.ORDERS_DB.prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM orders WHERE status = 'PAID' AND date(paid_at) = date('now') AND ${VISIBLE}`
    ).first();
    const today = { count: Number(todayRow?.count) || 0, total: Number(todayRow?.total) || 0 };

    const binds = [];
    let sql = `SELECT order_id, amount, currency, customer_name, customer_email, customer_phone, status, email_status, created_at, paid_at,
      (SELECT COALESCE(SUM(amount), 0) FROM refunds WHERE refunds.order_id = orders.order_id) AS refunded FROM orders WHERE ${VISIBLE}`;
    if (status !== "ALL") { sql += " AND status = ?"; binds.push(status); }
    const search = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 100);
    if (search) { sql += " AND (order_id LIKE ? OR customer_name LIKE ? OR customer_email LIKE ? OR customer_phone LIKE ?)"; const term = `%${search.replace(/[\\%_]/g, "\\$&")}%`; binds.push(term, term, term, term); }
    sql += " ORDER BY created_at DESC LIMIT 500";
    const listResult = await env.ORDERS_DB.prepare(sql).bind(...binds).all();

    const chart = await env.ORDERS_DB.prepare(`SELECT date(COALESCE(paid_at, updated_at)) AS day, COALESCE(SUM(amount), 0) AS total FROM orders WHERE ${VISIBLE} AND status = 'PAID' AND date(COALESCE(paid_at, updated_at)) >= date('now', '-13 days') GROUP BY day ORDER BY day`).all();
    const customerStats = await env.ORDERS_DB.prepare(`SELECT COUNT(DISTINCT customer_email) AS customers, COUNT(*) AS paidOrders FROM orders WHERE ${VISIBLE} AND status = 'PAID'`).first();
    const productStats = await env.ORDERS_DB.prepare(`SELECT COALESCE(json_extract(p.data, '$.productName'), p.slug, o.product_id) AS name, COUNT(*) AS sales, COALESCE(SUM(o.amount),0) AS revenue FROM orders o LEFT JOIN products p ON p.id = o.product_id WHERE NOT EXISTS (SELECT 1 FROM admin_hidden_orders h WHERE h.order_id = o.order_id) AND o.status = 'PAID' GROUP BY o.product_id ORDER BY sales DESC, revenue DESC LIMIT 5`).all();
    return json({ summary, today, revenueByDay: chart.results || [], orders: listResult.results || [], customerStats: { customers: Number(customerStats?.customers) || 0, paidOrders: Number(customerStats?.paidOrders) || 0 }, topProducts: productStats.results || [] });
  } catch (error) {
    console.error("Admin orders query failed", error);
    return json({ error: "Orders could not be loaded. Please try again." }, 503);
  }
}


// Explicit permanent removal. Financial and refund evidence is snapshotted in a dedicated audit table.
// Paid downloads rely on their original order: this action is intentionally admin-only and warned in the UI.
export async function onRequestPost({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON.' }, 400); }
  const ids = body?.action === 'delete' ? [body.order_id] : body?.action === 'bulk_delete' ? body.order_ids : null;
  if (!Array.isArray(ids) || !ids.length || ids.length > 100 || ids.some(id => !/^[A-Za-z0-9_-]{1,128}$/.test(String(id || '')))) return json({ error: 'Invalid order IDs.' }, 400);
  try {
    await env.ORDERS_DB.prepare(`CREATE TABLE IF NOT EXISTS deleted_orders_audit (
      order_id TEXT PRIMARY KEY, status TEXT NOT NULL, amount REAL NOT NULL,
      currency TEXT NOT NULL, paid_at TEXT, deleted_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`).run();
    let deleted = 0;
    for (const id of new Set(ids)) {
      const order = await env.ORDERS_DB.prepare('SELECT order_id, status, amount, currency, paid_at FROM orders WHERE order_id = ?').bind(id).first();
      if (!order) continue;
      // Keep a minimal financial audit trail (not a copy of personal contact details).
      await env.ORDERS_DB.prepare('INSERT OR IGNORE INTO deleted_orders_audit (order_id,status,amount,currency,paid_at) VALUES (?,?,?,?,?)')
        .bind(order.order_id, order.status, order.amount, order.currency, order.paid_at || null).run();
      await env.ORDERS_DB.prepare('DELETE FROM orders WHERE order_id = ?').bind(id).run();
      await env.ORDERS_DB.prepare('DELETE FROM admin_hidden_orders WHERE order_id = ?').bind(id).run().catch(() => {});
      deleted++;
    }
    return json({ ok: true, deleted, note: 'Orders permanently deleted. Payment receipts and minimal financial audit records retained.' });
  } catch (error) {
    console.error('Order deletion failed', error);
    return json({ error: 'Order deletion failed. Please verify D1 permissions and schema.' }, 503);
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
  if (!STATUSES.includes(status)) return json({ error: "Invalid export filter." }, 400);
  const where = status === 'ALL' ? VISIBLE : `${VISIBLE} AND status = ?`;
  try { await ensureArchive(env); } catch { return json({ error: "Database unavailable." }, 503); }
  const statement = env.ORDERS_DB.prepare(`SELECT order_id, customer_name, customer_email, customer_phone, amount, currency, status, created_at FROM orders WHERE ${where} ORDER BY created_at DESC LIMIT 5000`);
  try {
    const rows = (await (status === 'ALL' ? statement : statement.bind(status)).all()).results || [];
    const cols = ['order_id','customer_name','customer_email','customer_phone','amount','currency','status','created_at'];
    const csv = [cols.join(','), ...rows.map(row => cols.map(key => csvCell(row[key])).join(','))].join('\r\n');
    return new Response('\uFEFF' + csv, { headers: { 'Content-Type':'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="eboora-orders.csv"', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' } });
  } catch (error) { console.error('Order export failed', error); return json({ error: 'Unable to export orders.' }, 503); }
}
