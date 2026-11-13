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
const LOW_STOCK_THRESHOLD = 5;

// Notify the admin when a product crosses the reorder threshold.
async function notifyAdminLowStock(
  email: EmailService,
  watch: Array<{ id: string; title: string; before: number; after: number }>
) {
  if (watch.length === 0) return;
  const admin = await queryOne<{ email: string; name: string }>(`SELECT email, name FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1`);
  if (!admin) return; // no admin account exists yet — nothing to notify
  const text = `Low-stock alert for ${watch.length} product(s):\n${watch
    .map((w) => `- ${w.title}: ${w.before} → ${w.after}${w.after === 0 ? " (SOLD OUT)" : " (LOW STOCK)"}`)
    .join("\n")}\n\nRestock soon to avoid missed sales.`;
  const html = `<p>Low-stock alert for ${watch.length} product(s):</p><ul>${watch
    .map((w) => `<li><strong>${w.title}</strong>: ${w.before} → ${w.after}${w.after === 0 ? " <em>(sold out)</em>" : " <em>(low stock)</em>"}</li>`)
    .join("")}</ul><p>Restock soon to avoid missed sales.</p>`;
  await email.send(
    admin.email,
    `Low stock: ${watch.length} product(s) need restocking`,
    `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;padding:24px;background:#f3f4f6"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden"><div style="background:#1e3a8a;padding:18px 24px;color:#fff;font-size:20px;font-weight:800">ShopMart</div><div style="padding:24px">${html}</div></div></body></html>`,
    text
  );
}

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
  try { return { ...p, images: JSON.parse(p.images), featured: !!p.featured }; } catch { return { ...p, images: [], featured: !!p.featured }; }
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
  async create(
    @CurrentUser() user: any,
    @Body() body: { addressId: string; couponCode?: string; shippingMethod?: "standard" | "express" }
  ) {
    const address = await queryOne<any>(`SELECT * FROM addresses WHERE id = ?`, [body.addressId]);
    if (!address || address.user_id !== user.id) throw new BadRequestException("Invalid address");

    const cart = await queryOne<any>(`SELECT * FROM carts WHERE user_id = ?`, [user.id]);
    const cartItems = cart
      ? await queryAll<any>(
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
      coupon = await queryOne(`SELECT * FROM coupons WHERE code = ?`, [body.couponCode.toUpperCase()]);
      if (!coupon || !coupon.active) throw new BadRequestException("Invalid coupon");
      if (coupon.expires_at && new Date(String(coupon.expires_at)) < new Date()) throw new BadRequestException("Coupon expired");
      if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) throw new BadRequestException("Coupon usage limit reached");
      if (subtotalCents < coupon.min_order_cents) throw new BadRequestException("Order below coupon minimum");
    }

    const shippingMethod = body.shippingMethod ?? "standard";
    const { discountCents, shippingCents, taxCents, totalCents } = computeTotals(subtotalCents, coupon, shippingMethod);

    const stockWatch: Array<{ id: string; title: string; before: number; after: number }> = [];

    const order = await transaction(async (conn) => {
      const orderId = newId();
      const number = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await conn.execute(
        `INSERT INTO orders (id, number, user_id, status, subtotal_cents, shipping_cents, tax_cents, discount_cents, total_cents, coupon_code, shipping_method, address)
         VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, number, user.id, subtotalCents, shippingCents, taxCents, discountCents, totalCents, coupon?.code ?? null, shippingMethod, JSON.stringify(camel(address))]
      );
      for (const item of cartItems) {
        await conn.execute(
          `INSERT INTO order_items (id, order_id, product_id, title, sku, price_cents, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [newId(), orderId, item.product_id, item.title, item.sku, item.price_cents, item.quantity]
        );
        await conn.execute(`UPDATE products SET stock = stock - ? WHERE id = ?`, [item.quantity, item.product_id]);
        await conn.execute(`INSERT INTO inventory_logs (id, product_id, delta, reason) VALUES (?, ?, ?, 'order')`, [newId(), item.product_id, -item.quantity]);
        const after = item.stock - item.quantity;
        const crossed =
          (item.stock > LOW_STOCK_THRESHOLD && after <= LOW_STOCK_THRESHOLD) ||
          (item.stock > 0 && after === 0);
        if (crossed) stockWatch.push({ id: item.product_id, title: item.title, before: item.stock, after });
      }
      if (coupon) await conn.execute(`UPDATE coupons SET used_count = used_count + 1 WHERE id = ?`, [coupon.id]);
      await conn.execute(`DELETE FROM cart_items WHERE cart_id = ?`, [cart!.id]);

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

    // Alert the admin about stock crossings in the outbox (not thrown — email failure must not roll back the order).
    notifyAdminLowStock(this.email, stockWatch).catch((e) => console.error("low stock alert failed", e));
    return order;
  }

  @Get()
  async list(@CurrentUser() user: any) {
    const orders = camelAll(await queryAll(`SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`, [user.id]));
    return Promise.all(
      orders.map(async (o: any) => ({
        ...o,
        items: camelAll(await queryAll(`SELECT * FROM order_items WHERE order_id = ?`, [o.id])),
      }))
    );
  }

  @Get("admin/all")
  @UseGuards(RolesGuard)
  @Roles("admin")
  async adminList() {
    const orders = camelAll(
      await queryAll(`SELECT o.*, u.name AS user_name, u.email AS user_email FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC`)
    );
    return Promise.all(
      orders.map(async (o: any) => ({
        ...o,
        user: { name: o.userName, email: o.userEmail },
        items: camelAll(await queryAll(`SELECT * FROM order_items WHERE order_id = ?`, [o.id])),
      }))
    );
  }

  @Get(":id/invoice")
  async invoice(@CurrentUser() user: any, @Param("id") id: string, @Res() res: Response) {
    const order = await queryOne<any>(`SELECT * FROM orders WHERE id = ?`, [id]);
    if (!order) throw new NotFoundException("Order not found");
    if (order.user_id !== user.id && user.role !== "admin") throw new ForbiddenException();

    const items = camelAll(await queryAll(`SELECT * FROM order_items WHERE order_id = ?`, [id]));
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
  async get(@CurrentUser() user: any, @Param("id") id: string) {
    const order = await queryOne<any>(`SELECT * FROM orders WHERE id = ?`, [id]);
    if (!order) throw new NotFoundException("Order not found");
    if (order.user_id !== user.id && user.role !== "admin") throw new ForbiddenException();

    const items = (
      await queryAll<any>(
        `SELECT oi.*, p.images AS product_images, p.slug AS product_slug, p.description AS product_description
         FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`,
        [id]
      )
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
  async cancel(@CurrentUser() user: any, @Param("id") id: string) {
    const order = await queryOne<any>(`SELECT * FROM orders WHERE id = ?`, [id]);
    if (!order) throw new NotFoundException();
    if (order.user_id !== user.id && user.role !== "admin") throw new ForbiddenException();
    if (order.status === "shipped" || order.status === "delivered") throw new BadRequestException("Cannot cancel an order already shipped");
    if (order.status === "cancelled") return camel(order);

    const result = await transaction(async (conn) => {
      const items = await conn.query(`SELECT * FROM order_items WHERE order_id = ?`, [id]) as any[];
      for (const item of items[0]) {
        await conn.execute(`UPDATE products SET stock = stock + ? WHERE id = ?`, [item.quantity, item.product_id]);
        await conn.execute(`INSERT INTO inventory_logs (id, product_id, delta, reason) VALUES (?, ?, ?, 'cancel')`, [newId(), item.product_id, item.quantity]);
      }
      await conn.execute(`UPDATE orders SET status = 'cancelled' WHERE id = ?`, [id]);
      const rows = await conn.query(`SELECT * FROM orders WHERE id = ?`, [id]) as any;
      return camel(rows[0][0]);
    });
    this.email.sendOrderStatus(user.email, order.number, "cancelled").catch((e) => console.error("cancel email failed", e));
    return result;
  }

  @UseGuards(RolesGuard)
  @Roles("admin")
  @Put(":id/status")
  async adminUpdateStatus(@Param("id") id: string, @Body() body: { status: string }) {
    const allowed = ["pending", "paid", "shipped", "delivered", "cancelled"];
    if (!allowed.includes(body.status)) throw new BadRequestException("Invalid status");

    const order = await queryOne<any>(`SELECT * FROM orders WHERE id = ?`, [id]);
    if (!order) throw new NotFoundException("Order not found");
    if (order.status === "delivered" || order.status === "cancelled") {
      throw new BadRequestException(`Order is already ${order.status} and cannot be changed`);
    }

    const row = await queryOne<any>(`SELECT u.email FROM users u WHERE u.id = ?`, [order.user_id]);
    const updated = await transaction(async (conn) => {
      // Admin-initiated cancel restores stock, symmetric with customer cancel.
      if (body.status === "cancelled") {
        const items = await conn.query(`SELECT * FROM order_items WHERE order_id = ?`, [id]) as any;
        for (const item of items[0]) {
          await conn.execute(`UPDATE products SET stock = stock + ? WHERE id = ?`, [item.quantity, item.product_id]);
          await conn.execute(`INSERT INTO inventory_logs (id, product_id, delta, reason) VALUES (?, ?, ?, 'cancel')`, [newId(), item.product_id, item.quantity]);
        }
      }
      await conn.execute(`UPDATE orders SET status = ? WHERE id = ?`, [body.status, id]);
      const rows = await conn.query(`SELECT * FROM orders WHERE id = ?`, [id]) as any;
      return camel(rows[0][0]);
    });
    if (row?.email) this.email.sendOrderStatus(row.email, order.number, body.status).catch((e) => console.error("status email failed", e));
    return updated;
  }
}

@Module({
  controllers: [OrdersController],
})
export class OrdersModule {}
