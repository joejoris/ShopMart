import { Controller, Get, UseGuards, Module } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { queryAll, queryOne } from "../db/database";
import { camelAll } from "../db/map";
import { Roles } from "../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../common/guards";

@ApiTags("admin")
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@ApiBearerAuth()
export class AdminController {
  @Get("stats")
  async stats() {
    const revenue = await queryOne<{ sum: number | null }>(
      `SELECT SUM(total_cents) AS sum FROM orders WHERE status IN ('paid', 'shipped', 'delivered')`
    );
    const orders = (await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM orders`))?.n ?? 0;
    const users = (await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM users`))?.n ?? 0;
    const activeProducts = (await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM products WHERE status = 'active'`))?.n ?? 0;
    const lowStock = (await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM products WHERE status = 'active' AND stock <= 5`))?.n ?? 0;

    const recentOrders = camelAll(
      await queryAll(
        `SELECT o.*, u.name AS user_name, u.email AS user_email
         FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC LIMIT 10`
      )
    );
    const withItems = await Promise.all(
      recentOrders.map(async (o: any) => ({
        ...o,
        user: { name: o.userName, email: o.userEmail },
        items: camelAll(await queryAll(`SELECT * FROM order_items WHERE order_id = ?`, [o.id])),
      }))
    );

    const topRaw = await queryAll<any>(
      `SELECT product_id, SUM(quantity) AS units FROM order_items GROUP BY product_id ORDER BY units DESC LIMIT 5`
    );
    const topProducts = await Promise.all(
      topRaw.map(async (t: any) => {
        const p = await queryOne<any>(`SELECT id, title, slug FROM products WHERE id = ?`, [t.product_id]);
        return { product: p ? { id: p.id, title: p.title, slug: p.slug } : undefined, unitsSold: t.units };
      })
    );

    return {
      revenueCents: Number(revenue?.sum ?? 0),
      orders,
      users,
      activeProducts,
      lowStockProducts: lowStock,
      recentOrders: withItems,
      topProducts,
    };
  }

  @Get("low-stock")
  async lowStock() {
    return camelAll(
      await queryAll(`SELECT * FROM products WHERE status = 'active' AND stock <= 5 ORDER BY stock ASC`)
    );
  }

  @Get("emails")
  async emails() {
    return camelAll(
      await queryAll(`SELECT id, to_email, subject, status, error, created_at FROM email_outbox ORDER BY created_at DESC LIMIT 100`)
    );
  }

  @Get("users")
  async users() {
    return camelAll(
      await queryAll(
        `SELECT u.id, u.name, u.email, u.role, u.created_at, COUNT(o.id) AS order_count
         FROM users u LEFT JOIN orders o ON o.user_id = u.id
         GROUP BY u.id ORDER BY u.created_at DESC`
      )
    );
  }
}

@Module({
  controllers: [AdminController],
})
export class AdminModule {}
