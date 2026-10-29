-- Cloudflare D1 schema. Create the database, then run this file once.
CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'PAID', 'CANCELLED', 'FAILED')),
  email_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (email_status IN ('PENDING', 'SENT', 'FAILED')),
  meta_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (meta_status IN ('PENDING', 'SENT', 'SKIPPED', 'FAILED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(customer_email);

-- Owner-saved storefront settings (product name, price, texts). Safe to run more than once.
CREATE TABLE IF NOT EXISTS store_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Rate limiting counters (per IP and action). Safe to run more than once.
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);

-- Records that a one-time notification (owner sale alert) was claimed for an order. Safe to run more than once.
CREATE TABLE IF NOT EXISTS order_notifications (
  order_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (order_id, kind)
);

-- Discount codes (launch offers). Prices are always calculated on the server. Safe to run more than once.
CREATE TABLE IF NOT EXISTS coupons (
  code TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('percent', 'fixed')),
  value REAL NOT NULL CHECK (value > 0),
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS order_discounts (
  order_id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  original_amount REAL NOT NULL,
  discount_amount REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Refunds the owner has already made in the Cashfree dashboard, recorded for accounting.
CREATE TABLE IF NOT EXISTS refunds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);
