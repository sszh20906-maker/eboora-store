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
