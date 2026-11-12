import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, Module } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { queryAll, queryOne, execute, newId } from "../db/database";
import { camel, camelAll } from "../db/map";
import { CurrentUser } from "../common/decorators";
import { JwtAuthGuard } from "../common/guards";

const withImages = (p: any) => {
  if (!p) return p;
  try { return { ...p, images: JSON.parse(p.images) }; } catch { return { ...p, images: [] }; }
};

@ApiTags("users")
@Controller("users")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  @Get("me")
  me(@CurrentUser() user: any) {
    const row = queryOne(`SELECT id, email, name, role, created_at, email_verified_at FROM users WHERE id = ?`, [user.id]);
    return { ...camel(row), emailVerified: !!row?.email_verified_at };
  }

  @Put("me")
  updateMe(@CurrentUser() user: any, @Body() body: { name?: string }) {
    if (body.name) execute(`UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?`, [body.name, user.id]);
    return camel(queryOne(`SELECT id, email, name, role FROM users WHERE id = ?`, [user.id]));
  }

  @Get("addresses")
  addresses(@CurrentUser() user: any) {
    return camelAll(queryAll(`SELECT * FROM addresses WHERE user_id = ?`, [user.id]));
  }

  @Post("addresses")
  createAddress(@CurrentUser() user: any, @Body() body: any) {
    const id = newId();
    execute(
      `INSERT INTO addresses (id, user_id, full_name, line1, line2, city, state, postal_code, country, phone, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, user.id, body.fullName, body.line1, body.line2 ?? null, body.city, body.state, body.postalCode, body.country ?? "US", body.phone ?? null, body.isDefault ? 1 : 0]
    );
    return camel(queryOne(`SELECT * FROM addresses WHERE id = ?`, [id]));
  }

  @Put("addresses/:id")
  updateAddress(@CurrentUser() user: any, @Param("id") id: string, @Body() body: any) {
    const map: Record<string, string> = {
      fullName: "full_name", line1: "line1", line2: "line2", city: "city", state: "state",
      postalCode: "postal_code", country: "country", phone: "phone",
    };
    const fields: string[] = [];
    const params: any[] = [];
    for (const [key, col] of Object.entries(map)) {
      if (body[key] !== undefined) { fields.push(`${col} = ?`); params.push(body[key]); }
    }
    if (body.isDefault !== undefined) { fields.push(`is_default = ?`); params.push(body.isDefault ? 1 : 0); }
    if (fields.length) execute(`UPDATE addresses SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`, [...params, id, user.id]);
    return { ok: true };
  }

  @Delete("addresses/:id")
  deleteAddress(@CurrentUser() user: any, @Param("id") id: string) {
    execute(`DELETE FROM addresses WHERE id = ? AND user_id = ?`, [id, user.id]);
    return { ok: true };
  }

  @Get("wishlist")
  wishlist(@CurrentUser() user: any) {
    let wl = queryOne<any>(`SELECT id FROM wishlists WHERE user_id = ?`, [user.id]);
    if (!wl) {
      wl = { id: newId() };
      execute(`INSERT INTO wishlists (id, user_id) VALUES (?, ?)`, [wl.id, user.id]);
    }
    const rows = queryAll(
      `SELECT wi.id, p.* FROM wishlist_items wi JOIN products p ON p.id = wi.product_id
       WHERE wi.wishlist_id = ? ORDER BY wi.created_at DESC`,
      [wl.id]
    );
    return rows.map((r: any) => ({ id: r.id, product: withImages(camel(r)) }));
  }

  @Post("wishlist")
  addToWishlist(@CurrentUser() user: any, @Body() body: { productId: string }) {
    let wl = queryOne<any>(`SELECT id FROM wishlists WHERE user_id = ?`, [user.id]);
    if (!wl) {
      wl = { id: newId() };
      execute(`INSERT INTO wishlists (id, user_id) VALUES (?, ?)`, [wl.id, user.id]);
    }
    execute(
      `INSERT OR IGNORE INTO wishlist_items (id, wishlist_id, product_id) VALUES (?, ?, ?)`,
      [newId(), wl.id, body.productId]
    );
    return { ok: true };
  }

  @Delete("wishlist/:productId")
  removeFromWishlist(@CurrentUser() user: any, @Param("productId") productId: string) {
    const wl = queryOne<any>(`SELECT id FROM wishlists WHERE user_id = ?`, [user.id]);
    if (wl) execute(`DELETE FROM wishlist_items WHERE wishlist_id = ? AND product_id = ?`, [wl.id, productId]);
    return { ok: true };
  }
}

@Module({
  controllers: [UsersController],
})
export class UsersModule {}
