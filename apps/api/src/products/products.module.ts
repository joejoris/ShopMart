import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  Module,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { queryAll, queryOne, execute, newId } from "../db/database";
import { camel, camelAll } from "../db/map";
import { Public, Roles } from "../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../common/guards";

const withImages = (p: any) => {
  if (!p) return p;
  try {
    return { ...p, images: JSON.parse(p.images) };
  } catch {
    return { ...p, images: [] };
  }
};

@ApiTags("products")
@Controller("products")
export class ProductsController {
  @Public()
  @Get()
  list(
    @Query("q") q?: string,
    @Query("category") category?: string,
    @Query("minPriceCents") minPriceCents?: string,
    @Query("maxPriceCents") maxPriceCents?: string,
    @Query("sort") sort?: "price_asc" | "price_desc" | "newest" | "popular",
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "12"
  ) {
    const p = Math.max(1, parseInt(page) || 1);
    const ps = Math.min(50, Math.max(1, parseInt(pageSize) || 12));

    const where: string[] = [`p.status = 'active'`];
    const params: any[] = [];
    if (q) {
      where.push(`(p.title LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)`);
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (category) {
      where.push(`c.slug = ?`);
      params.push(category);
    }
    if (minPriceCents) { where.push(`p.price_cents >= ?`); params.push(Number(minPriceCents)); }
    if (maxPriceCents) { where.push(`p.price_cents <= ?`); params.push(Number(maxPriceCents)); }

    let orderBy = `p.created_at DESC`;
    if (sort === "price_asc") orderBy = `p.price_cents ASC`;
    else if (sort === "price_desc") orderBy = `p.price_cents DESC`;
    else if (sort === "popular") orderBy = `sold DESC`;

    const base = `FROM products p JOIN categories c ON c.id = p.category_id LEFT JOIN (
      SELECT product_id, SUM(quantity) AS sold FROM order_items GROUP BY product_id
    ) oi ON oi.product_id = p.id WHERE ${where.join(" AND ")}`;

    const totalRow = queryOne<{ n: number }>(`SELECT COUNT(*) AS n ${base}`, params);
    const total = totalRow?.n ?? 0;

    const rows = queryAll(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
              (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS review_count,
              COALESCE(oi.sold, 0) AS sold
       ${base} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...params, ps, (p - 1) * ps]
    );

    return {
      items: rows.map((r: any) => ({
        ...withImages(camel(r)),
        category: { id: r.category_id, name: r.category_name, slug: r.category_slug },
      })),
      total,
      page: p,
      pageSize: ps,
      totalPages: Math.ceil(total / ps),
    };
  }

  @Public()
  @Get("featured")
  featured() {
    const rows = queryAll(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p JOIN categories c ON c.id = p.category_id
       WHERE p.status = 'active' ORDER BY p.created_at DESC LIMIT 8`
    );
    return rows.map((r: any) => ({
      ...withImages(camel(r)),
      category: { id: r.category_id, name: r.category_name, slug: r.category_slug },
    }));
  }

  @Public()
  @Get(":slug")
  async getBySlug(@Param("slug") slug: string) {
    const r = queryOne(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p JOIN categories c ON c.id = p.category_id
       WHERE p.slug = ?`,
      [slug]
    );
    if (!r) throw new NotFoundException("Product not found");
    const reviews = queryAll(
      `SELECT r.*, u.name AS user_name FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.product_id = ? ORDER BY r.created_at DESC`,
      [r.id]
    ).map((rev: any) => ({
      ...camel(rev),
      verifiedPurchase: !!rev.verified_purchase,
      user: { name: rev.user_name },
    }));
    const agg = queryOne<{ avg_rating: number | null; n: number }>(
      `SELECT AVG(rating) AS avg_rating, COUNT(*) AS n FROM reviews WHERE product_id = ?`,
      [r.id]
    );
    return {
      ...withImages(camel(r)),
      category: { id: r.category_id, name: (r as any).category_name, slug: (r as any).category_slug },
      reviews,
      ratingAvg: agg?.avg_rating ?? 0,
      ratingCount: agg?.n ?? 0,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Post()
  create(@Body() body: any) {
    if (!body.title || !body.slug || !body.sku) throw new BadRequestException("title, slug, sku are required");
    const id = newId();
    execute(
      `INSERT INTO products (id, title, slug, description, price_cents, compare_at_price_cents, sku, stock, status, images, category_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, body.title, body.slug, body.description ?? "",
        Number(body.priceCents ?? 0),
        body.compareAtPriceCents != null ? Number(body.compareAtPriceCents) : null,
        body.sku, Number(body.stock ?? 0), body.status ?? "draft",
        JSON.stringify(body.images ?? []), body.categoryId,
      ]
    );
    return withImages(camel(queryOne(`SELECT * FROM products WHERE id = ?`, [id])));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Put(":id")
  update(@Param("id") id: string, @Body() body: any) {
    const map: Record<string, string> = {
      title: "title", slug: "slug", description: "description",
      priceCents: "price_cents", compareAtPriceCents: "compare_at_price_cents",
      sku: "sku", stock: "stock", status: "status", categoryId: "category_id",
    };
    const fields: string[] = [];
    const params: any[] = [];
    for (const [key, col] of Object.entries(map)) {
      if (body[key] !== undefined) { fields.push(`${col} = ?`); params.push(body[key]); }
    }
    if (body.images !== undefined) { fields.push(`images = ?`); params.push(JSON.stringify(body.images)); }
    if (fields.length) {
      fields.push(`updated_at = datetime('now')`);
      execute(`UPDATE products SET ${fields.join(", ")} WHERE id = ?`, [...params, id]);
    }
    return withImages(camel(queryOne(`SELECT * FROM products WHERE id = ?`, [id])));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Delete(":id")
  remove(@Param("id") id: string) {
    execute(`UPDATE products SET status = 'archived', updated_at = datetime('now') WHERE id = ?`, [id]);
    return { ok: true };
  }
}

@Module({
  controllers: [ProductsController],
})
export class ProductsModule {}
