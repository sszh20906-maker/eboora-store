// Fixed-window rate limiter stored in D1 (table: rate_limits). Keys contain no secrets.
export function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

const windowStartFor = (windowSeconds) => {
  const now = Math.floor(Date.now() / 1000);
  return now - (now % windowSeconds);
};

// Records one hit and returns how many hits this window now has.
export async function countHit(env, key, windowSeconds) {
  const row = await env.ORDERS_DB.prepare(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1 ELSE 1 END,
       window_start = excluded.window_start
     RETURNING count`
  ).bind(key, windowStartFor(windowSeconds)).first();
  if (Math.random() < 0.01) {
    env.ORDERS_DB.prepare("DELETE FROM rate_limits WHERE window_start < ?")
      .bind(Math.floor(Date.now() / 1000) - 86400).run().catch(() => {});
  }
  return row ? Number(row.count) : 0;
}

// Reads hits in the current window without recording a new one.
export async function currentHits(env, key, windowSeconds) {
  const row = await env.ORDERS_DB.prepare("SELECT count, window_start FROM rate_limits WHERE key = ? LIMIT 1").bind(key).first();
  if (!row || Number(row.window_start) !== windowStartFor(windowSeconds)) return 0;
  return Number(row.count) || 0;
}
