import * as path from "node:path";
import * as fs from "node:fs";
import * as mysql from "mysql2/promise";

const url = process.env.DATABASE_URL ?? "mysql://root@localhost:3306/ecommerce";

const pool = mysql.createPool({
  uri: url,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "Z",
  charset: "utf8mb4",
});

export { pool };

let seq = 0;
export const newId = () =>
  `${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const SCHEMA_STATEMENTS: string[] = [
  `CREATE DATABASE IF NOT EXISTS ecommerce CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `USE ecommerce`,
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(191) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name VARCHAR(200) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'customer',
    email_verified_at DATETIME NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
  )`,
  `CREATE TABLE IF NOT EXISTS addresses (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    line1 VARCHAR(500) NOT NULL,
    line2 VARCHAR(500) NULL,
    city VARCHAR(200) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(32) NOT NULL,
    country VARCHAR(8) NOT NULL DEFAULT 'US',
    phone VARCHAR(40) NULL,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id)`,
  `CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(200) NOT NULL UNIQUE,
    slug VARCHAR(200) NOT NULL UNIQUE,
    image_url TEXT NULL,
    parent_id VARCHAR(64) NULL,
    CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    price_cents INT NOT NULL,
    compare_at_price_cents INT NULL,
    sku VARCHAR(64) NOT NULL UNIQUE,
    stock INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    images TEXT NOT NULL DEFAULT '[]',
    category_id VARCHAR(64) NOT NULL,
    featured TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)`,
  `CREATE INDEX IF NOT EXISTS idx_products_status ON products(status)`,
  `CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured)`,
  `CREATE TABLE IF NOT EXISTS carts (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) UNIQUE,
    guest_id VARCHAR(64) UNIQUE,
    last_reminder_sent_at DATETIME NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS cart_items (
    id VARCHAR(64) PRIMARY KEY,
    cart_id VARCHAR(64) NOT NULL,
    product_id VARCHAR(64) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    UNIQUE KEY uq_cart_item (cart_id, product_id),
    CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
    CONSTRAINT fk_cart_items_product FOREIGN KEY (product_id) REFERENCES products(id)
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(64) PRIMARY KEY,
    number VARCHAR(40) NOT NULL UNIQUE,
    user_id VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    subtotal_cents INT NOT NULL,
    shipping_cents INT NOT NULL DEFAULT 0,
    tax_cents INT NOT NULL DEFAULT 0,
    discount_cents INT NOT NULL DEFAULT 0,
    total_cents INT NOT NULL,
    coupon_code VARCHAR(40) NULL,
    shipping_method VARCHAR(20) NOT NULL DEFAULT 'standard',
    address TEXT NOT NULL,
    stripe_payment_intent_id TEXT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)`,
  `CREATE TABLE IF NOT EXISTS order_items (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL,
    product_id VARCHAR(64) NOT NULL,
    title VARCHAR(200) NOT NULL,
    sku VARCHAR(64) NOT NULL,
    price_cents INT NOT NULL,
    quantity INT NOT NULL,
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id)`,
  `CREATE TABLE IF NOT EXISTS reviews (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    product_id VARCHAR(64) NOT NULL,
    rating INT NOT NULL,
    comment TEXT NOT NULL,
    verified_purchase TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_user_product (user_id, product_id),
    CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id)`,
  `CREATE TABLE IF NOT EXISTS wishlists (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL UNIQUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_wishlists_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS wishlist_items (
    id VARCHAR(64) PRIMARY KEY,
    wishlist_id VARCHAR(64) NOT NULL,
    product_id VARCHAR(64) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_wishlist_item (wishlist_id, product_id),
    CONSTRAINT fk_wishlist_items_wishlist FOREIGN KEY (wishlist_id) REFERENCES wishlists(id) ON DELETE CASCADE,
    CONSTRAINT fk_wishlist_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS coupons (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    type VARCHAR(10) NOT NULL,
    value DOUBLE NOT NULL,
    min_order_cents INT NOT NULL DEFAULT 0,
    expires_at DATETIME NULL,
    usage_limit INT NULL,
    used_count INT NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  )`,
  `CREATE TABLE IF NOT EXISTS inventory_logs (
    id VARCHAR(64) PRIMARY KEY,
    product_id VARCHAR(64) NOT NULL,
    delta INT NOT NULL,
    reason VARCHAR(40) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_inventory_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_logs(product_id)`,
  `CREATE TABLE IF NOT EXISTS email_outbox (
    id VARCHAR(64) PRIMARY KEY,
    to_email VARCHAR(255) NOT NULL,
    subject VARCHAR(512) NOT NULL,
    body_html MEDIUMTEXT NOT NULL,
    body_text MEDIUMTEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    error TEXT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_email_outbox_created ON email_outbox(created_at)`,
  `CREATE TABLE IF NOT EXISTS email_tokens (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    purpose VARCHAR(20) NOT NULL,
    token_hash VARCHAR(191) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_tokens(user_id)`,
];

export async function ensureSchema() {
  // Phase 1: dedicated bootstrap connection WITHOUT a default database to create it + tables.
  const bootstrapUrl = url.replace(/\/[^/?]+(\?.*)?$/, "/");
  const bootstrap = await mysql.createConnection(bootstrapUrl);
  try {
    for (const sql of SCHEMA_STATEMENTS) {
      try {
        await bootstrap.query(sql);
      } catch (e: any) {
        if (/already exists/i.test(e.message)) continue;
        throw e;
      }
    }
  } finally {
    await bootstrap.end();
  }
}

export async function queryAll<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await pool.query(sql, params as any);
  return rows as T[];
}
export async function queryOne<T = any>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const [rows] = await pool.query(sql, params as any);
  return (rows as any[])[0];
}
export async function execute(sql: string, params: unknown[] = []): Promise<{ affectedRows: number }> {
  const [result] = await pool.execute(sql, params as any);
  return { affectedRows: (result as any).affectedRows ?? 0 };
}
export async function transaction<T>(fn: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
export async function closeDb() {
  await pool.end();
}
