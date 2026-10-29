// In-memory stand-in for D1 covering only the statements these tests use.
export function makeDb() {
  const settings = new Map();
  const orders = new Map();
  const rateLimits = new Map();
  const notifications = new Set();
  const coupons = new Map();
  const orderDiscounts = new Map();
  const refunds = [];

  const allRows = (sql, args) => {
    if (sql.includes("GROUP BY status")) {
      const groups = {};
      for (const o of orders.values()) {
        const g = groups[o.status] || { status: o.status, count: 0, total: 0 };
        g.count += 1;
        g.total += o.amount;
        groups[o.status] = g;
      }
      return { results: Object.values(groups) };
    }
    if (sql.includes("FROM coupons")) return { results: [...coupons.values()] };
    if (sql.includes("customer_email = ?")) {
      const onlyPaid = sql.includes("status = 'PAID'");
      return { results: [...orders.values()].filter((o) => o.customer_email === args[0] && (!onlyPaid || o.status === "PAID")).map((o) => ({ order_id: o.order_id })) };
    }
    if (sql.includes("FROM orders")) {
      return { results: [...orders.values()].map((o) => ({ ...o, refunded: refunds.filter((r) => r.order_id === o.order_id).reduce((t, r) => t + r.amount, 0) })) };
    }
    return { results: [] };
  };

  // Returns the number of changed rows, like D1's meta.changes.
  const runSql = (sql, args) => {
    if (sql.includes("INSERT INTO store_settings")) { settings.set(args[0], args[1]); return 1; }
    if (sql.includes("INSERT INTO orders")) {
      const [order_id, product_id, amount, currency, customer_name, customer_email, customer_phone] = args;
      orders.set(order_id, { order_id, product_id, amount, currency, customer_name, customer_email, customer_phone, status: "CREATED", email_status: "PENDING", meta_status: "PENDING", created_at: "2026-10-29 10:00:00", paid_at: null });
      return 1;
    }
    if (sql.includes("INSERT INTO order_discounts")) {
      const [order_id, code, original_amount, discount_amount] = args;
      orderDiscounts.set(order_id, { order_id, code, original_amount, discount_amount });
      return 1;
    }
    if (sql.includes("INSERT INTO coupons")) {
      const [code, type, value, max_uses, expires_at, active] = args;
      const existing = coupons.get(code);
      coupons.set(code, { code, type, value, max_uses, used_count: existing ? existing.used_count : 0, expires_at, active, created_at: "2026-10-29" });
      return 1;
    }
    if (sql.includes("UPDATE coupons SET used_count")) {
      const c = coupons.get(args[0]);
      if (c) c.used_count += 1;
      return c ? 1 : 0;
    }
    if (sql.includes("INSERT INTO refunds")) { refunds.push({ order_id: args[0], amount: args[1], note: args[2] }); return 1; }
    if (sql.includes("SET status = 'PAID'")) { const o = orders.get(args[0]); if (o) o.status = "PAID"; return o ? 1 : 0; }
    if (sql.includes("SET status = 'FAILED'")) {
      const o = orders.get(args[0]);
      if (o && o.status === "CREATED") { o.status = "FAILED"; return 1; }
      return 0;
    }
    if (sql.includes("SET email_status = 'SENT'")) { const o = orders.get(args[0]); if (o) o.email_status = "SENT"; return o ? 1 : 0; }
    if (sql.includes("SET meta_status = ?")) { const o = orders.get(args[1]); if (o) o.meta_status = args[0]; return o ? 1 : 0; }
    if (sql.includes("INSERT OR IGNORE INTO order_notifications")) {
      const kind = sql.includes("'coupon_redeemed'") ? "coupon_redeemed" : "owner_sale";
      const key = args[0] + ":" + kind;
      if (notifications.has(key)) return 0;
      notifications.add(key);
      return 1;
    }
    if (sql.includes("DELETE FROM order_notifications")) { notifications.delete(args[0] + ":owner_sale"); return 1; }
    return 0;
  };

  return {
    settings, orders, rateLimits, notifications, coupons, orderDiscounts, refunds,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes("rate_limits") && sql.includes("INSERT")) {
                const [key, windowStart] = args;
                const cur = rateLimits.get(key);
                const count = cur && cur.window_start === windowStart ? cur.count + 1 : 1;
                rateLimits.set(key, { window_start: windowStart, count });
                return { count };
              }
              if (sql.includes("FROM rate_limits")) {
                const cur = rateLimits.get(args[0]);
                return cur ? { count: cur.count, window_start: cur.window_start } : null;
              }
              if (sql.includes("FROM store_settings")) {
                const v = settings.get(args[0]);
                return v === undefined ? null : { value: v };
              }
              if (sql.includes("FROM coupons WHERE code")) { const c = coupons.get(args[0]); return c ? { ...c } : null; }
              if (sql.includes("FROM order_discounts")) { const d = orderDiscounts.get(args[0]); return d ? { ...d } : null; }
              if (sql.includes("date(paid_at)")) {
                const today = new Date().toISOString().slice(0, 10);
                const paidToday = [...orders.values()].filter((o) => o.status === "PAID" && String(o.paid_at || "").slice(0, 10) === today);
                return { count: paidToday.length, total: paidToday.reduce((t, o) => t + o.amount, 0) };
              }
              if (sql.includes("FROM refunds WHERE order_id")) {
                return { total: refunds.filter((r) => r.order_id === args[0]).reduce((t, r) => t + r.amount, 0) };
              }
              if (sql.includes("FROM orders WHERE order_id")) {
                const o = orders.get(args[0]);
                return o ? { ...o } : null;
              }
              return null;
            },
            async run() { const changes = runSql(sql, args); return { success: true, meta: { changes } }; },
            async all() { return allRows(sql, args); }
          };
        },
        async first() { return null; },
        async all() { return allRows(sql, []); }
      };
    }
  };
}
