import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Res,
  UseGuards,
  Module,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { queryAll, queryOne, execute, transaction, newId } from "../db/database";
import { camel, camelAll } from "../db/map";
const PDFDocument = require("pdfkit");
import type { Response } from "express";
import { CurrentUser, Roles } from "../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../common/guards";
import { EmailService } from "../email/email.service";
import { FREE_SHIPPING_THRESHOLD_CENTS, SHIPPING_FLAT_CENTS, TAX_RATE } from "@ecommerce/shared";

const EXPRESS_SHIPPING_CENTS = 999;

export function computeTotals(
  subtotalCents: number,
  coupon: { type: string; value: number } | null,
  shippingMethod: string
) {
  let discountCents = 0;
  if (coupon) {
    if (coupon.type === "percent") discountCents = Math.round((subtotalCents * coupon.value) / 100);
    else discountCents = Math.round(coupon.value * 100);
    discountCents = Math.min(discountCents, subtotalCents);
  }
  const afterDiscount = subtotalCents - discountCents;
  const shippingCents =
    shippingMethod === "express"
      ? EXPRESS_SHIPPING_CENTS
      : afterDiscount >= FREE_SHIPPING_THRESHOLD_CENTS
        ? 0
        : SHIPPING_FLAT_CENTS;
  const taxCents = Math.round(afterDiscount * TAX_RATE);
  const totalCents = afterDiscount + shippingCents + taxCents;
  return { discountCents, shippingCents, taxCents, totalCents };
}

const withImages = (p: any) => {
  if (!p) return p;
  try { return { ...p, images: JSON.parse(p.images) }; } catch { return { ...p, images: [] }; }
};

@ApiTags("orders")
@Controller("orders")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private email: EmailService) {}

  private serializeItem(i: any) {
    return { ...i, product: i.product ? withImages(camel(i.product)) : undefined };
  }

  @Post()
  create(
    @CurrentUser() user: any,
    @Body() body: { addressId: string; couponCode?: string; shippingMethod?: "standard" | "express" }
  ) {
    const address = queryOne<any>(`SELECT * FROM addresses WHERE id = ?`, [body.addressId]);
    if (!address || address.user_id !== user.id) throw new BadRequestException("Invalid address");

    const cart = queryOne<any>(`SELECT * FROM carts WHERE user_id = ?`, [user.id]);
    const cartItems = cart
      ? queryAll<any>(
          `SELECT ci.*, p.* FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.cart_id = ?`,
          [cart.id]
        )
      : [];
    if (cartItems.length === 0) throw new BadRequestException("Cart is empty");

    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        throw new BadRequestException(`Insufficient stock for ${item.title}`);
      }
    }

    const subtotalCents = cartItems.reduce((s: number, i: any) => s + i.price_cents * i.quantity, 0);

    let coupon: any = null;
    if (body.couponCode) {
      coupon = queryOne(`SELECT * FROM coupons WHERE code = ?`, [body.couponCode.toUpperCase()]);
      if (!coupon || !coupon.active) throw new BadRequestException("Invalid coupon");
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) throw new BadRequestException("Coupon expired");
      if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) throw new BadRequestException("Coupon usage limit reached");
      if (subtotalCents < coupon.min_order_cents) throw new BadRequestException("Order below coupon minimum");
    }

    const shippingMethod = body.shippingMethod ?? "standard";
    const { discountCents, shippingCents, taxCents, totalCents } = computeTotals(subtotalCents, coupon, shippingMethod);

    const order = transaction(() => {
      const orderId = newId();
      const number = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      execute(
        `INSERT INTO orders (id, number, user_id, status, subtotal_cents, shipping_cents, tax_cents, discount_cents, total_cents, coupon_code, shipping_method, address)
         VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, number, user.id, subtotalCents, shippingCents, taxCents, discountCents, totalCents, coupon?.code ?? null, shippingMethod, JSON.stringify(camel(address))]
      );
      for (const item of cartItems) {
        execute(
          `INSERT INTO order_items (id, order_id, product_id, title, sku, price_cents, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [newId(), orderId, item.product_id, item.title, item.sku, item.price_cents, item.quantity]
        );
        execute(`UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE id = ?`, [item.quantity, item.product_id]);
        execute(`INSERT INTO inventory_logs (id, product_id, delta, reason) VALUES (?, ?, ?, 'order')`, [newId(), item.product_id, -item.quantity]);
      }
      if (coupon) execute(`UPDATE coupons SET used_count = used_count + 1 WHERE id = ?`, [coupon.id]);
      execute(`DELETE FROM cart_items WHERE cart_id = ?`, [cart!.id]);

      return {
        id: orderId, number, userId: user.id, status: "pending",
        subtotalCents, shippingCents, taxCents, discountCents, totalCents,
        couponCode: coupon?.code ?? null, shippingMethod,
        address: camel(address), createdAt: new Date().toISOString(),
        items: cartItems.map((i: any) => ({
          id: newId(), productId: i.product_id, title: i.title, sku: i.sku,
          priceCents: i.price_cents, quantity: i.quantity,
        })),
      };
    });

    this.email
      .sendOrderConfirmation(user.email, {
        number: order.number,
        totalCents: order.totalCents,
        subtotalCents: order.subtotalCents,
        shippingCents: order.shippingCents,
        taxCents: order.taxCents,
        discountCents: order.discountCents,
        items: order.items.map((i: any) => ({ title: i.title, quantity: i.quantity, priceCents: i.priceCents })),
      })
      .catch((e) => console.error("order confirmation email failed", e));
    return order;
  }

  @Get()
  list(@CurrentUser() user: any) {
    const orders = camelAll(queryAll(`SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`, [user.id]));
    return orders.map((o: any) => ({ ...o, items: camelAll(queryAll(`SELECT * FROM order_items WHERE order_id = ?`, [o.id])) }));
  }

  @Get("admin/all")
  @UseGuards(RolesGuard)
  @Roles("admin")
  adminList() {
    const orders = camelAll(
      queryAll(`SELECT o.*, u.name AS user_name, u.email AS user_email FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC`)
    );
    return orders.map((o: any) => ({
      ...o,
      user: { name: o.userName, email: o.userEmail },
      items: camelAll(queryAll(`SELECT * FROM order_items WHERE order_id = ?`, [o.id])),
    }));
  }

  @Get(":id/invoice")
  async invoice(@CurrentUser() user: any, @Param("id") id: string, @Res() res: Response) {
    const order = queryOne<any>(`SELECT * FROM orders WHERE id = ?`, [id]);
    if (!order) throw new NotFoundException("Order not found");
    if (order.user_id !== user.id && user.role !== "admin") throw new ForbiddenException();

    const items = camelAll(queryAll(`SELECT * FROM order_items WHERE order_id = ?`, [id]));
    let address: any = null;
    try { address = JSON.parse(order.address); } catch {}

    const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${order.number}-invoice.pdf"`,
    });

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.pipe(res);

    // Header
    doc.fontSize(22).fillColor("#1e3a8a").text("ShopMart", { continued: true }).fillColor("#111827").fontSize(12).text(`   INVOICE`, { align: "right" });
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor("#6b7280").text("123 Market Street, San Francisco, CA 94105 · support@shopmart.local");
    doc.moveDown();

    // Invoice meta
    doc.fontSize(10).fillColor("#111827");
    doc.text(`Invoice: ${order.number}`);
    doc.text(`Date: ${new Date(order.created_at).toLocaleString("en-US")}`);
    doc.text(`Status: ${String(order.status).toUpperCase()}`);
    doc.text(`Order method: ${order.shipping_method}`);
    doc.moveDown();

    // Bill to
    doc.fontSize(12).fillColor("#1e3a8a").text("Bill to");
    doc.fontSize(10).fillColor("#111827");
    if (address) {
      doc.text(address.fullName ?? "");
      doc.text(address.line1 ?? "");
      if (address.line2) doc.text(address.line2);
      doc.text(`${address.city ?? ""}, ${address.state ?? ""} ${address.postalCode ?? ""}`);
      doc.text(address.country ?? "");
    }
    doc.moveDown();

    // Items table
    const y0 = doc.y;
    doc.fontSize(10).fillColor("#fff");
    doc.rect(50, y0, 495, 22).fill("#2563eb");
    doc.fillColor("#fff");
    doc.text("Item", 58, y0 + 6, { width: 250 });
    doc.text("Qty", 308, y0 + 6, { width: 40, align: "center" });
    doc.text("Unit", 348, y0 + 6, { width: 90, align: "right" });
    doc.text("Amount", 438, y0 + 6, { width: 100, align: "right" });

    let y = y0 + 22;
    items.forEach((i: any, idx: number) => {
      if (idx % 2 === 1) {
        doc.rect(50, y, 495, 20).fill("#f9fafb").fillColor("#111827");
      }
      doc.fillColor("#111827");
      doc.text(i.title, 58, y + 5, { width: 250 });
      doc.text(String(i.quantity), 308, y + 5, { width: 40, align: "center" });
      doc.text(money(i.priceCents), 348, y + 5, { width: 90, align: "right" });
      doc.text(money(i.priceCents * i.quantity), 438, y + 5, { width: 100, align: "right" });
      y += 20;
    });
    doc.moveTo(50, y + 4).lineTo(545, y + 4).stroke("#e5e7eb");
    y += 12;

    // Totals
    const totals: Array<[string, number, boolean?]> = [
      ["Subtotal", order.subtotal_cents],
      ["Discount", -order.discount_cents],
      ["Shipping", order.shipping_cents],
      ["Tax", order.tax_cents],
    ];
    for (const [label, value] of totals) {
      doc.text(label, 348, y, { width: 90, align: "right" });
      doc.text(label === "Discount" && value !== 0 ? `-${money(-value)}` : money(value), 438, y, { width: 100, align: "right" });
      y += 16;
    }
    doc.fontSize(13).fillColor("#1e3a8a");
    doc.text("Total", 348, y, { width: 90, align: "right" });
    doc.text(money(order.total_cents), 438, y, { width: 100, align: "right" });

    doc.moveDown(2);
    doc.fontSize(9).fillColor("#6b7280").text("Thank you for shopping with ShopMart. Questions? support@shopmart.local", 50, doc.y + 10, { width: 495, align: "center" });
    doc.end();
  }

  @Get(":id")
  get(@CurrentUser() user: any, @Param("id") id: string) {
    const order = queryOne<any>(`SELECT * FROM orders WHERE id = ?`, [id]);
    if (!order) throw new NotFoundException("Order not found");
    if (order.user_id !== user.id && user.role !== "admin") throw new ForbiddenException();

    const items = queryAll<any>(
      `SELECT oi.*, p.images AS product_images, p.slug AS product_slug, p.description AS product_description
       FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`,
      [id]
    ).map((i: any) => ({
      ...camel(i),
      product: {
        slug: i.product_slug,
        description: i.product_description,
        images: (() => { try { return JSON.parse(i.product_images); } catch { return []; } })(),
      },
    }));

    let address: any = null;
    try { address = JSON.parse(order.address); } catch {}
    return { ...camel(order), address, items };
  }

  @Put(":id/cancel")
  cancel(@CurrentUser() user: any, @Param("id") id: string) {
    const order = queryOne<any>(`SELECT * FROM orders WHERE id = ?`, [id]);
    if (!order) throw new NotFoundException();
    if (order.user_id !== user.id && user.role !== "admin") throw new ForbiddenException();
    if (order.status === "shipped" || order.status === "delivered") throw new BadRequestException("Cannot cancel an order already shipped");
    if (order.status === "cancelled") return camel(order);

    const result = transaction(() => {
      const items = queryAll<any>(`SELECT * FROM order_items WHERE order_id = ?`, [id]);
      for (const item of items) {
        execute(`UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?`, [item.quantity, item.product_id]);
        execute(`INSERT INTO inventory_logs (id, product_id, delta, reason) VALUES (?, ?, ?, 'cancel')`, [newId(), item.product_id, item.quantity]);
      }
      execute(`UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`, [id]);
      return camel(queryOne(`SELECT * FROM orders WHERE id = ?`, [id]));
    });
    this.email.sendOrderStatus(user.email, order.number, "cancelled").catch((e) => console.error("cancel email failed", e));
    return result;
  }

  @UseGuards(RolesGuard)
  @Roles("admin")
  @Put(":id/status")
  adminUpdateStatus(@Param("id") id: string, @Body() body: { status: string }) {
    const allowed = ["pending", "paid", "shipped", "delivered", "cancelled"];
    if (!allowed.includes(body.status)) throw new BadRequestException("Invalid status");

    const order = queryOne<any>(`SELECT * FROM orders WHERE id = ?`, [id]);
    if (!order) throw new NotFoundException("Order not found");
    if (order.status === "delivered" || order.status === "cancelled") {
      throw new BadRequestException(`Order is already ${order.status} and cannot be changed`);
    }

    const row = queryOne<any>(`SELECT u.email FROM users u WHERE u.id = ?`, [order.user_id]);
    const updated = transaction(() => {
      // Admin-initiated cancel restores stock, symmetric with customer cancel.
      if (body.status === "cancelled") {
        const items = queryAll<any>(`SELECT * FROM order_items WHERE order_id = ?`, [id]);
        for (const item of items) {
          execute(`UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?`, [item.quantity, item.product_id]);
          execute(`INSERT INTO inventory_logs (id, product_id, delta, reason) VALUES (?, ?, ?, 'cancel')`, [newId(), item.product_id, item.quantity]);
        }
      }
      execute(`UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`, [body.status, id]);
      return camel(queryOne(`SELECT * FROM orders WHERE id = ?`, [id]));
    });
    if (row?.email) this.email.sendOrderStatus(row.email, order.number, body.status).catch((e) => console.error("status email failed", e));
    return updated;
  }
}

@Module({
  controllers: [OrdersController],
})
export class OrdersModule {}
