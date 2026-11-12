import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Post, Put, UseGuards, Module } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { queryAll, queryOne, execute, newId } from "../db/database";
import { camel } from "../db/map";
import { CurrentUser } from "../common/decorators";
import { OptionalAuthGuard } from "../common/guards";

const withImages = (p: any) => {
  if (!p) return p;
  try {
    return { ...p, images: JSON.parse(p.images) };
  } catch {
    return { ...p, images: [] };
  }
};

@ApiTags("cart")
@Controller("cart")
@UseGuards(OptionalAuthGuard)
export class CartController {
  private resolveCart(user: any, guestId?: string) {
    if (user) {
      let cart = queryOne<any>(`SELECT * FROM carts WHERE user_id = ?`, [user.id]);
      if (!cart) {
        const id = newId();
        execute(`INSERT INTO carts (id, user_id) VALUES (?, ?)`, [id, user.id]);
        cart = queryOne(`SELECT * FROM carts WHERE id = ?`, [id]);
      }
      return cart;
    }
    if (!guestId) throw new BadRequestException("Provide x-guest-id header for guest carts");
    let cart = queryOne<any>(`SELECT * FROM carts WHERE guest_id = ?`, [guestId]);
    if (!cart) {
      const id = newId();
      execute(`INSERT INTO carts (id, guest_id) VALUES (?, ?)`, [id, guestId]);
      cart = queryOne(`SELECT * FROM carts WHERE id = ?`, [id]);
    }
    return cart;
  }

  private serialize(cartId: string) {
    const items = queryAll(
      `SELECT ci.id AS item_id, ci.quantity AS quantity, p.*
       FROM cart_items ci JOIN products p ON p.id = ci.product_id
       WHERE ci.cart_id = ?`,
      [cartId]
    ).map((r: any) => {
      const product = withImages(camel(r))!;
      return { id: r.item_id, quantity: r.quantity, product, lineTotalCents: r.price_cents * r.quantity };
    });
    const subtotalCents = items.reduce((s: number, i: any) => s + i.lineTotalCents, 0);
    const itemCount = items.reduce((s: number, i: any) => s + i.quantity, 0);
    return { id: cartId, items, subtotalCents, itemCount };
  }

  @Get()
  get(@CurrentUser() user: any, @Headers("x-guest-id") guestId?: string) {
    const cart = this.resolveCart(user, guestId);
    return this.serialize(cart.id);
  }

  @Post("items")
  addItem(
    @CurrentUser() user: any,
    @Headers("x-guest-id") guestId: string | undefined,
    @Body() body: { productId: string; quantity?: number }
  ) {
    const cart = this.resolveCart(user, guestId);
    const product = queryOne<any>(`SELECT * FROM products WHERE id = ? AND status = 'active'`, [body.productId]);
    if (!product) throw new BadRequestException("Product unavailable");
    const quantity = Math.max(1, Math.min(99, body.quantity ?? 1));

    const existing = queryOne<any>(`SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ?`, [cart.id, product.id]);
    if (existing) {
      execute(`UPDATE cart_items SET quantity = ? WHERE id = ?`, [Math.min(99, existing.quantity + quantity), existing.id]);
    } else {
      execute(`INSERT INTO cart_items (id, cart_id, product_id, quantity) VALUES (?, ?, ?, ?)`, [newId(), cart.id, product.id, quantity]);
    }
    return this.serialize(cart.id);
  }

  @Put("items/:itemId")
  updateItem(
    @CurrentUser() user: any,
    @Headers("x-guest-id") guestId: string | undefined,
    @Param("itemId") itemId: string,
    @Body() body: { quantity: number }
  ) {
    const cart = this.resolveCart(user, guestId);
    const item = queryOne<any>(`SELECT * FROM cart_items WHERE id = ?`, [itemId]);
    if (!item || item.cart_id !== cart.id) throw new BadRequestException("Item not in cart");
    if (body.quantity <= 0) execute(`DELETE FROM cart_items WHERE id = ?`, [itemId]);
    else execute(`UPDATE cart_items SET quantity = ? WHERE id = ?`, [Math.min(99, body.quantity), itemId]);
    return this.serialize(cart.id);
  }

  @Delete("items/:itemId")
  removeItem(
    @CurrentUser() user: any,
    @Headers("x-guest-id") guestId: string | undefined,
    @Param("itemId") itemId: string
  ) {
    const cart = this.resolveCart(user, guestId);
    const item = queryOne<any>(`SELECT * FROM cart_items WHERE id = ?`, [itemId]);
    if (item && item.cart_id === cart.id) execute(`DELETE FROM cart_items WHERE id = ?`, [itemId]);
    return this.serialize(cart.id);
  }

  @Post("merge")
  merge(@CurrentUser() user: any, @Headers("x-guest-id") guestId?: string) {
    if (!user || !guestId) return this.get(user, guestId);
    const guest = queryOne<any>(`SELECT * FROM carts WHERE guest_id = ?`, [guestId]);
    const userCart = this.resolveCart(user, undefined);
    if (guest && guest.id !== userCart.id) {
      const guestItems = queryAll<any>(`SELECT * FROM cart_items WHERE cart_id = ?`, [guest.id]);
      for (const gi of guestItems) {
        const existing = queryOne<any>(`SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ?`, [userCart.id, gi.product_id]);
        if (existing) {
          execute(`UPDATE cart_items SET quantity = ? WHERE id = ?`, [Math.min(99, existing.quantity + gi.quantity), existing.id]);
        } else {
          execute(`INSERT INTO cart_items (id, cart_id, product_id, quantity) VALUES (?, ?, ?, ?)`, [newId(), userCart.id, gi.product_id, gi.quantity]);
        }
      }
      execute(`DELETE FROM carts WHERE id = ?`, [guest.id]);
    }
    return this.serialize(userCart.id);
  }
}

@Module({
  controllers: [CartController],
})
export class CartModule {}
