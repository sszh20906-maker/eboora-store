-- Apply to production D1 BEFORE deploying v32 functions. Safe to re-run.
CREATE TABLE IF NOT EXISTS payment_receipts (
  cf_payment_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_order ON payment_receipts(order_id);
