import { DatabaseSync } from "node:sqlite";
import * as path from "node:path";
import * as fs from "node:fs";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const filePath = url.startsWith("file:") ? url.slice(5) : url;
const resolved = path.resolve(process.cwd(), filePath);
fs.mkdirSync(path.dirname(resolved), { recursive: true });

export const db = new DatabaseSync(resolved);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS addresses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  line1 TEXT NOT NULL,
  line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'US',
  phone TEXT,
  is_default INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  image_url TEXT,
  parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  compare_at_price_cents INTEGER,
  sku TEXT NOT NULL UNIQUE,
  stock INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  images TEXT NOT NULL DEFAULT '[]',
  category_id TEXT NOT NULL REFERENCES categories(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

CREATE TABLE IF NOT EXISTS carts (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  guest_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cart_items (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  UNIQUE(cart_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  subtotal_cents INTEGER NOT NULL,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  coupon_code TEXT,
  shipping_method TEXT NOT NULL DEFAULT 'standard',
  address TEXT NOT NULL,
  stripe_payment_intent_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  title TEXT NOT NULL,
  sku TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  quantity INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  verified_purchase INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);

CREATE TABLE IF NOT EXISTS wishlists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  id TEXT PRIMARY KEY,
  wishlist_id TEXT NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(wishlist_id, product_id)
);

CREATE TABLE IF NOT EXISTS coupons (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  value REAL NOT NULL,
  min_order_cents INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  usage_limit INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory_logs (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_logs(product_id);

CREATE TABLE IF NOT EXISTS email_outbox (
  id TEXT PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_email_outbox_created ON email_outbox(created_at);

CREATE TABLE IF NOT EXISTS email_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_tokens(user_id);
`;

db.exec(SCHEMA);

// Idempotent migration for existing dev databases.
const userCols = db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>;
if (!userCols.some((c) => c.name === "email_verified_at")) {
  db.exec(`ALTER TABLE users ADD COLUMN email_verified_at TEXT`);
}

let seq = 0;
export const newId = () => `${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function queryAll<T = any>(sql: string, params: unknown[] = []): T[] {
  return db.prepare(sql).all(...(params as any)) as T[];
}
export function queryOne<T = any>(sql: string, params: unknown[] = []): T | undefined {
  return db.prepare(sql).get(...(params as any)) as T | undefined;
}
export function execute(sql: string, params: unknown[] = []) {
  return db.prepare(sql).run(...(params as any));
}
export function transaction<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
