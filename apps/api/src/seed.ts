import { queryAll, queryOne, execute, newId, pool, closeDb } from "./db/database";

const img = (id: string) => `https://images.unsplash.com/photo-${id}?w=800&q=80&auto=format&fit=crop`;
// Wikimedia Commons direct image URLs for products where Unsplash lacked a good match
const kbImg = `https://thumb.wikimedia.org/wikipedia/commons/thumb/6/68/Lingbao_JIGUANSHI_Mechanical_Gaming_Keyboard.jpg/960px-Lingbao_JIGUANSHI_Mechanical_Gaming_Keyboard.jpg`;
const jacketImg = `https://thumb.wikimedia.org/wikipedia/commons/thumb/0/06/Jean_jacket.jpg/960px-Jean_jacket.jpg`;
const kettleImg = `https://thumb.wikimedia.org/wikipedia/commons/thumb/1/15/Electric_kettle_phillips_white.JPG/960px-Electric_kettle_phillips_white.JPG`;

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
  featured?: boolean;
}> = [
  { title: "Wireless Noise-Cancelling Headphones", slug: "wireless-nc-headphones", description: "Over-ear Bluetooth headphones with active noise cancellation, 40h battery, and deep bass.", priceCents: 2599000, compareAtPriceCents: 3249000, sku: "ELC-001", stock: 42, category: "electronics", images: [img("1583394838336-acd977736f90")], featured: true },
  { title: "Smart Watch Series 7", slug: "smart-watch-series-7", description: "Fitness tracking, heart rate, GPS, and 2-day battery in an aluminum case.", priceCents: 2335000, sku: "ELC-002", stock: 65, category: "electronics", images: [img("1546868871-7041f2a55e12")], featured: true },
  { title: "Mechanical Keyboard 65%", slug: "mechanical-keyboard-65", description: "Hot-swappable 65% layout, gasket mount, PBT keycaps, RGB backlight.", priceCents: 1699000, sku: "ELC-003", stock: 30, category: "electronics", images: [kbImg] },
  { title: "USB-C GaN Charger 65W", slug: "usb-c-gan-charger-65w", description: "Single-port GaN charger with PD 3.0 fast charging.", priceCents: 599900, sku: "ELC-004", stock: 120, category: "electronics", images: [img("1583863788434-e58a36330cf0")] },
  { title: "Everyday Cotton T-Shirt", slug: "everyday-cotton-tshirt", description: "Pre-shrunk 100% combed cotton tee with a modern regular fit.", priceCents: 349900, sku: "CLT-001", stock: 200, category: "clothing", images: [img("1521572163474-6864f9cf17ab")] },
  { title: "Classic Denim Jacket", slug: "classic-denim-jacket", description: "Stone-washed denim jacket with button front and chest pockets.", priceCents: 1169900, compareAtPriceCents: 1559900, sku: "CLT-002", stock: 35, category: "clothing", images: [jacketImg] },
  { title: "Slim Chinos", slug: "slim-chinos", description: "Stretch-cotton slim-fit chinos, wrinkle resistant, multiple colors.", priceCents: 779900, sku: "CLT-003", stock: 88, category: "clothing", images: [img("1473966968600-fa801b869a1a")] },
  { title: "Non-Stick Frying Pan 28cm", slug: "nonstick-frying-pan-28", description: "Triple-layer non-stick coating, oven safe to 230°C, ergonomic handle.", priceCents: 714900, sku: "HOM-001", stock: 54, category: "home-kitchen", images: [img("1585515320310-259814833e62")] },
  { title: "Electric Kettle 1.7L", slug: "electric-kettle-17l", description: "Rapid boil, auto shut-off, keep-warm function, 1500W.", priceCents: 909900, sku: "HOM-002", stock: 47, category: "home-kitchen", images: [kettleImg] },
  { title: "The Pragmatic Programmer", slug: "pragmatic-programmer", description: "The classic guide to software craftsmanship. 20th anniversary edition.", priceCents: 584900, sku: "BOK-001", stock: 80, category: "books", images: [img("1544947950-fa07a98d237f")] },
  { title: "Clean Code", slug: "clean-code", description: "A handbook of agile software craftsmanship by Robert C. Martin.", priceCents: 519900, sku: "BOK-002", stock: 75, category: "books", images: [img("1587620962725-abab7fe55159")] },
  { title: "Adjustable Dumbbell Set 24kg", slug: "adjustable-dumbbell-24kg", description: "Quick-change weight plates, compact home gym solution.", priceCents: 1949000, sku: "SPT-001", stock: 25, category: "sports", images: [img("1571019613454-1cb2f99b2d8b")], featured: true },
  { title: "Yoga Mat Pro 6mm", slug: "yoga-mat-pro-6mm", description: "High-density non-slip yoga mat with alignment lines.", priceCents: 454900, sku: "SPT-002", stock: 90, category: "sports", images: [img("1601925260368-ae2f83cf8b7f")] },
];

async function main() {
  console.log("Seeding catalog, categories and coupons…");

  const catId = new Map<string, string>();
  for (const c of categories) {
    const existing = await queryOne<any>(`SELECT id FROM categories WHERE slug = ?`, [c.slug]);
    if (existing) {
      catId.set(c.slug, existing.id);
      await execute(`UPDATE categories SET image_url = ? WHERE id = ?`, [c.imageUrl, existing.id]);
    } else {
      const id = newId();
      await execute(`INSERT INTO categories (id, name, slug, image_url) VALUES (?, ?, ?, ?)`, [id, c.name, c.slug, c.imageUrl]);
      catId.set(c.slug, id);
    }
  }

  for (const p of products) {
    const categoryId = catId.get(p.category)!;
    const existing = await queryOne<any>(`SELECT id FROM products WHERE slug = ?`, [p.slug]);
    const images = JSON.stringify(p.images);
    if (existing) {
      await execute(
        `UPDATE products SET price_cents = ?, stock = ?, category_id = ?, images = ?, featured = ?, updated_at = NOW() WHERE id = ?`,
        [p.priceCents, p.stock, categoryId, images, p.featured ? 1 : 0, existing.id]
      );
    } else {
      await execute(
        `INSERT INTO products (id, title, slug, description, price_cents, compare_at_price_cents, sku, stock, status, images, category_id, featured)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
        [newId(), p.title, p.slug, p.description, p.priceCents, p.compareAtPriceCents ?? null, p.sku, p.stock, images, categoryId, p.featured ? 1 : 0]
      );
    }
  }

  for (const c of [
    { code: "WELCOME10", type: "percent", value: 10, min: 600000 },
    { code: "SAVE25", type: "fixed", value: 3000, min: 1500000 },
  ]) {
    const existing = await queryOne<any>(`SELECT id FROM coupons WHERE code = ?`, [c.code]);
    if (!existing) {
      await execute(`INSERT INTO coupons (id, code, type, value, min_order_cents, active) VALUES (?, ?, ?, ?, ?, 1)`,
        [newId(), c.code, c.type, c.value, c.min]);
    }
  }

  console.log("Seed complete. Register an account at /auth/register; promote it to admin via README instructions.");
  await closeDb();
}

main().catch((e) => { console.error("Seed failed:", e); process.exit(1); });
