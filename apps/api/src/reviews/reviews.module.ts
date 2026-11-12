import { Body, Controller, Get, Param, Post, UseGuards, Module } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { queryAll, queryOne, execute, newId } from "../db/database";
import { camel, camelAll, bool } from "../db/map";
import { CurrentUser, Public } from "../common/decorators";
import { JwtAuthGuard } from "../common/guards";

@ApiTags("reviews")
@Controller("reviews")
export class ReviewsController {
  @Public()
  @Get("product/:productId")
  list(@Param("productId") productId: string) {
    return camelAll(
      queryAll(
        `SELECT r.*, u.name AS user_name FROM reviews r JOIN users u ON u.id = r.user_id
         WHERE r.product_id = ? ORDER BY r.created_at DESC`,
        [productId]
      )
    ).map((r: any) => ({ ...r, verifiedPurchase: bool(r.verifiedPurchase), user: { name: r.userName } }));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: any, @Body() body: { productId: string; rating: number; comment: string }) {
    const rating = Math.max(1, Math.min(5, Math.round(body.rating)));
    const purchased = queryOne(
      `SELECT oi.id FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE oi.product_id = ? AND o.user_id = ? AND o.status IN ('paid', 'shipped', 'delivered')`,
      [body.productId, user.id]
    );
    const id = newId();
    execute(
      `INSERT INTO reviews (id, user_id, product_id, rating, comment, verified_purchase)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, product_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment`,
      [id, user.id, body.productId, rating, body.comment, purchased ? 1 : 0]
    );
    return { ok: true };
  }
}

@Module({
  controllers: [ReviewsController],
})
export class ReviewsModule {}
