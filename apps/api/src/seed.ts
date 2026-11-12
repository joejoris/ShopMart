import * as bcrypt from "bcryptjs";
import { db, newId } from "./db/database";

const img = (id: string) => `https://images.unsplash.com/photo-${id}?w=800&q=80&auto=format&fit=crop`;

const categories = [
  { name: "Electronics", slug: "electronics", imageUrl: img("1498049794561-7780e7231661") },
  { name: "Clothing", slug: "clothing", imageUrl: img("1521572163474-6864f9cf17ab") },
  { name: "Home & Kitchen", slug: "home-kitchen", imageUrl: img("1556911220-bff31c812dba") },
  { name: "Books", slug: "books", imageUrl: img("1512820790803-83ca734da794") },
  { name: "Sports", slug: "sports", imageUrl: img("1461896836934-ffe607ba8211") },
];

const products: Array<{
  title: string; slug: string; description: string; priceCents: number;
  compareAtPriceCents?: number; sku: string; stock: number; category: string; images: string[];
}> = [
  { title: "Wireless Noise-Cancelling Headphones", slug: "wireless-nc-headphones", description: "Over-ear Bluetooth headphones with active noise cancellation, 40h battery, and deep bass.", priceCents: 19999, compareAtPriceCents: 24999, sku: "ELC-001", stock: 42, category: "electronics", images: [img("1583394838336-acd977736f90")] },
  { title: "Smart Watch Series 7", slug: "smart-watch-series-7", description: "Fitness tracking, heart rate, GPS, and 2-day battery in an aluminum case.", priceCents: 17999, sku: "ELC-002", stock: 65, category: "electronics", images: [img("1546868871-7041f2a55e12")] },
  { title: "Mechanical Keyboard 65%", slug: "mechanical-keyboard-65", description: "Hot-swappable 65% layout, gasket mount, PBT keycaps, RGB backlight.", priceCents: 12999, sku: "ELC-003", stock: 30, category: "electronics", images: [img("1618384887929-16ec33faba83")] },
  { title: "USB-C GaN Charger 65W", slug: "usb-c-gan-charger-65w", description: "Single-port GaN charger with PD 3.0 fast charging.", priceCents: 4599, sku: "ELC-004", stock: 120, category: "electronics", images: [img("1583863788434-e58a36330cf0")] },
  { title: "Everyday Cotton T-Shirt", slug: "everyday-cotton-tshirt", description: "Pre-shrunk 100% combed cotton tee with a modern regular fit.", priceCents: 2499, sku: "CLT-001", stock: 200, category: "clothing", images: [img("1521572163474-6864f9cf17ab")] },
  { title: "Classic Denim Jacket", slug: "classic-denim-jacket", description: "Stone-washed denim jacket with button front and chest pockets.", priceCents: 8999, compareAtPriceCents: 11999, sku: "CLT-002", stock: 35, category: "clothing", images: [img("1576995853123-5a10305a7589")] },
  { title: "Slim Chinos", slug: "slim-chinos", description: "Stretch-cotton slim-fit chinos, wrinkle resistant, multiple colors.", priceCents: 5999, sku: "CLT-003", stock: 88, category: "clothing", images: [img("1473966968600-fa801b869a1a")] },
  { title: "Non-Stick Frying Pan 28cm", slug: "nonstick-frying-pan-28", description: "Triple-layer non-stick coating, oven safe to 230°C, ergonomic handle.", priceCents: 5499, sku: "HOM-001", stock: 54, category: "home-kitchen", images: [img("1585515320310-259814833e62")] },
  { title: "Electric Kettle 1.7L", slug: "electric-kettle-17l", description: "Rapid boil, auto shut-off, keep-warm function, 1500W.", priceCents: 6999, sku: "HOM-002", stock: 47, category: "home-kitchen", images: [img("1608154608521-3a756fcc8a2f")] },
  { title: "The Pragmatic Programmer", slug: "pragmatic-programmer", description: "The classic guide to software craftsmanship. 20th anniversary edition.", priceCents: 4499, sku: "BOK-001", stock: 80, category: "books", images: [img("1544947950-fa07a98d237f")] },
  { title: "Clean Code", slug: "clean-code", description: "A handbook of agile software craftsmanship by Robert C. Martin.", priceCents: 3999, sku: "BOK-002", stock: 75, category: "books", images: [img("1587620962725-abab7fe55159")] },
  { title: "Adjustable Dumbbell Set 24kg", slug: "adjustable-dumbbell-24kg", description: "Quick-change weight plates, compact home gym solution.", priceCents: 14999, sku: "SPT-001", stock: 25, category: "sports", images: [img("1571019613454-1cb2f99b2d8b")] },
  { title: "Yoga Mat Pro 6mm", slug: "yoga-mat-pro-6mm", description: "High-density non-slip yoga mat with alignment lines.", priceCents: 3499, sku: "SPT-002", stock: 90, category: "sports", images: [img("1601925260368-ae2f83cf8b7f")] },
];

function main() {
  console.log("Seeding…");

  const upsertUser = (email: string, name: string, password: string, role: string) => {
    const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email) as any;
    if (existing) return existing.id;
    const id = newId();
    db.prepare(`INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)`)
      .run(id, email, bcrypt.hashSync(password, 10), name, role);
    return id;
  };

  const adminId = upsertUser("admin@example.com", "Store Admin", "admin1234", "admin");
  const customerId = upsertUser("demo@example.com", "Demo Customer", "demo1234", "customer");

  const hasAddress = db.prepare(`SELECT id FROM addresses WHERE user_id = ?`).get(customerId);
  if (!hasAddress) {
    db.prepare(
      `INSERT INTO addresses (id, user_id, full_name, line1, city, state, postal_code, country, phone, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    ).run(newId(), customerId, "Demo Customer", "123 Market Street", "San Francisco", "CA", "94105", "US", "+1 555 0100");
  }

  const catId = new Map<string, string>();
  for (const c of categories) {
    const existing = db.prepare(`SELECT id FROM categories WHERE slug = ?`).get(c.slug) as any;
    if (existing) {
      catId.set(c.slug, existing.id);
      db.prepare(`UPDATE categories SET image_url = ? WHERE id = ?`).run(c.imageUrl, existing.id);
    } else {
      const id = newId();
      db.prepare(`INSERT INTO categories (id, name, slug, image_url) VALUES (?, ?, ?, ?)`).run(id, c.name, c.slug, c.imageUrl);
      catId.set(c.slug, id);
    }
  }

  for (const p of products) {
    const categoryId = catId.get(p.category)!;
    const existing = db.prepare(`SELECT id FROM products WHERE slug = ?`).get(p.slug) as any;
    const images = JSON.stringify(p.images);
    if (existing) {
      db.prepare(
        `UPDATE products SET price_cents = ?, stock = ?, category_id = ?, images = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(p.priceCents, p.stock, categoryId, images, existing.id);
    } else {
      db.prepare(
        `INSERT INTO products (id, title, slug, description, price_cents, compare_at_price_cents, sku, stock, status, images, category_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
      ).run(newId(), p.title, p.slug, p.description, p.priceCents, p.compareAtPriceCents ?? null, p.sku, p.stock, images, categoryId);
    }
  }

  for (const c of [
    { code: "WELCOME10", type: "percent", value: 10, min: 2000 },
    { code: "SAVE25", type: "fixed", value: 25, min: 10000 },
  ]) {
    const existing = db.prepare(`SELECT id FROM coupons WHERE code = ?`).get(c.code);
    if (!existing) {
      db.prepare(`INSERT INTO coupons (id, code, type, value, min_order_cents, active) VALUES (?, ?, ?, ?, ?, 1)`)
        .run(newId(), c.code, c.type, c.value, c.min);
    }
  }

  console.log("Seed complete. Admin: admin@example.com / admin1234 — Demo: demo@example.com / demo1234");
  console.log(`(admin user id: ${adminId}, demo customer id: ${customerId})`);
  db.close();
}

main();
