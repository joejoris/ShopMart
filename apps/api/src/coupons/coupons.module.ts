import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, Module } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { queryAll, queryOne, execute, newId } from "../db/database";
import { camel, camelAll, bool } from "../db/map";
import { Public, Roles } from "../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../common/guards";

@ApiTags("coupons")
@Controller("coupons")
export class CouponsController {
  @Public()
  @Get("validate")
  validate(@Query("code") code: string, @Query("subtotalCents") subtotalCents = "0") {
    if (!code) return { valid: false, reason: "Missing code" };
    const coupon = queryOne<any>(`SELECT * FROM coupons WHERE code = ?`, [code.toUpperCase()]);
    if (!coupon || !bool(coupon.active)) return { valid: false, reason: "Invalid coupon" };
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return { valid: false, reason: "Coupon expired" };
    if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) return { valid: false, reason: "Usage limit reached" };
    const subtotal = Number(subtotalCents);
    if (subtotal < coupon.min_order_cents) return { valid: false, reason: "Order below minimum" };
    return {
      valid: true,
      coupon: { code: coupon.code, type: coupon.type, value: coupon.value, minOrderCents: coupon.min_order_cents },
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get()
  list() {
    return camelAll(queryAll(`SELECT * FROM coupons ORDER BY created_at DESC`)).map((c: any) => ({
      ...c, active: bool(c.active),
    }));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Post()
  create(@Body() body: any) {
    const id = newId();
    execute(
      `INSERT INTO coupons (id, code, type, value, min_order_cents, expires_at, usage_limit, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        id,
        String(body.code).toUpperCase(),
        body.type,
        Number(body.value),
        Number(body.minOrderCents ?? 0),
        body.expiresAt ? new Date(body.expiresAt).toISOString() : null,
        body.usageLimit != null ? Number(body.usageLimit) : null,
      ]
    );
    return camel(queryOne(`SELECT * FROM coupons WHERE id = ?`, [id]));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Put(":id")
  update(@Param("id") id: string, @Body() body: any) {
    const map: Record<string, string> = {
      code: "code", type: "type", value: "value", minOrderCents: "min_order_cents",
      usageLimit: "usage_limit", usedCount: "used_count",
    };
    const fields: string[] = [];
    const params: any[] = [];
    for (const [key, col] of Object.entries(map)) {
      if (body[key] !== undefined) { fields.push(`${col} = ?`); params.push(body[key]); }
    }
    if (body.expiresAt !== undefined) { fields.push(`expires_at = ?`); params.push(body.expiresAt ? new Date(body.expiresAt).toISOString() : null); }
    if (body.active !== undefined) { fields.push(`active = ?`); params.push(body.active ? 1 : 0); }
    if (fields.length) execute(`UPDATE coupons SET ${fields.join(", ")} WHERE id = ?`, [...params, id]);
    return camel(queryOne(`SELECT * FROM coupons WHERE id = ?`, [id]));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Delete(":id")
  remove(@Param("id") id: string) {
    execute(`UPDATE coupons SET active = 0 WHERE id = ?`, [id]);
    return { ok: true };
  }
}

@Module({
  controllers: [CouponsController],
})
export class CouponsModule {}
