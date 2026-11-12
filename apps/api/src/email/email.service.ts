import { Injectable, Logger } from "@nestjs/common";
import * as crypto from "node:crypto";
import { db, queryOne, execute, newId } from "../db/database";
import { camel } from "../db/map";

type OrderContext = {
  number: string;
  totalCents: number;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  discountCents: number;
  items: Array<{ title: string; quantity: number; priceCents: number }>;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger("EmailService");

  private escape(s: string) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  }

  private formatPrice(cents: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  }

  private async deliver(row: { id: string; to_email: string; subject: string; body_html: string; body_text: string }) {
    const smtpUrl = process.env.SMTP_URL;
    if (smtpUrl) {
      try {
        const nodemailer = (await import("nodemailer")).default;
        const transport = nodemailer.createTransport(smtpUrl);
        await transport.sendMail({
          from: process.env.MAIL_FROM ?? "ShopMart <no-reply@shopmart.local>",
          to: row.to_email,
          subject: row.subject,
          html: row.body_html,
          text: row.body_text,
        });
        execute(`UPDATE email_outbox SET status = 'sent' WHERE id = ?`, [row.id]);
        this.logger.log(`Sent "${row.subject}" to ${row.to_email}`);
      } catch (err: any) {
        execute(`UPDATE email_outbox SET status = 'failed', error = ? WHERE id = ?`, [String(err?.message ?? err), row.id]);
        this.logger.error(`Failed to send "${row.subject}" to ${row.to_email}: ${err?.message}`);
      }
      return;
    }
    // Dev console sender: fully functional without an SMTP server.
    this.logger.log(`[email:console] to=${row.to_email} subject="${row.subject}"\n${row.body_text}`);
    execute(`UPDATE email_outbox SET status = 'sent' WHERE id = ?`, [row.id]);
  }

  async send(to: string, subject: string, html: string, text: string) {
    const id = newId();
    execute(
      `INSERT INTO email_outbox (id, to_email, subject, body_html, body_text, status) VALUES (?, ?, ?, ?, ?, 'queued')`,
      [id, to, subject, html, text]
    );
    const row = { id, to_email: to, subject, body_html: html, body_text: text };
    await this.deliver(row);
    return { ok: true };
  }

  private layout(title: string, bodyHtml: string) {
    return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="background:#1e3a8a;padding:18px 24px;color:#fff;font-size:20px;font-weight:800">ShopMart</div>
    <div style="padding:24px">
      <h2 style="margin:0 0 12px;font-size:18px;color:#111827">${this.escape(title)}</h2>
      ${bodyHtml}
    </div>
    <div style="padding:14px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280">
      ShopMart · 123 Market Street, San Francisco, CA 94105 · You received this because you used ShopMart.
    </div>
  </div>
</body></html>`;
  }

  async sendOrderConfirmation(to: string, order: OrderContext) {
    const rows = order.items.map(
      (i) => `<tr><td style="padding:6px 0">${this.escape(i.title)} × ${i.quantity}</td><td align="right" style="padding:6px 0">${this.formatPrice(i.priceCents * i.quantity)}</td></tr>`
    ).join("");
    const html = `<p>Thanks for your order <strong>${this.escape(order.number)}</strong>. We'll let you know when it ships.</p>
<table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151">${rows}</table>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0">
<p style="font-size:14px;color:#374151">Subtotal ${this.formatPrice(order.subtotalCents)}<br>Discount −${this.formatPrice(order.discountCents)}<br>Shipping ${order.shippingCents === 0 ? "Free" : this.formatPrice(order.shippingCents)}<br>Tax ${this.formatPrice(order.taxCents)}</p>
<p style="font-size:16px;font-weight:700">Total ${this.formatPrice(order.totalCents)}</p>`;
    const text = `Thanks for your order ${order.number}. Total ${this.formatPrice(order.totalCents)}. Items: ${order.items.map((i) => `${i.title} ×${i.quantity}`).join(", ")}`;
    return this.send(to, `Order ${order.number} confirmed`, this.layout("Order confirmed", html), text);
  }

  async sendOrderStatus(to: string, orderNumber: string, status: string) {
    const messages: Record<string, string> = {
      shipped: "Your order is on its way!",
      delivered: "Your order has been delivered. Enjoy!",
      cancelled: "Your order has been cancelled.",
      paid: "Your payment was received.",
    };
    const msg = messages[status] ?? `Your order status is now: ${status}`;
    const html = `<p>${this.escape(msg)}</p><p>Order <strong>${this.escape(orderNumber)}</strong> status: <strong>${this.escape(status)}</strong></p>`;
    const text = `${msg} (Order ${orderNumber})`;
    return this.send(to, `Order ${orderNumber}: ${status}`, this.layout(`Order ${status}`, html), text);
  }

  createToken(userId: string, purpose: "verify" | "reset"): string {
    const raw = crypto.randomBytes(32).toString("hex");
    const hash = crypto.createHash("sha256").update(raw).digest("hex");
    const hours = purpose === "verify" ? 24 : 1;
    const expiresAt = new Date(Date.now() + hours * 3600_000).toISOString();
    execute(
      `INSERT INTO email_tokens (id, user_id, purpose, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)`,
      [newId(), userId, purpose, hash, expiresAt]
    );
    return raw;
  }

  consumeToken(rawToken: string, purpose: "verify" | "reset") {
    const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const row = queryOne<any>(
      `SELECT * FROM email_tokens WHERE token_hash = ? AND purpose = ? AND used_at IS NULL`,
      [hash, purpose]
    );
    if (!row) return null;
    if (new Date(row.expires_at) < new Date()) return null;
    execute(`UPDATE email_tokens SET used_at = datetime('now') WHERE id = ?`, [row.id]);
    return { userId: row.user_id };
  }

  async sendVerifyEmail(to: string, name: string, rawToken: string) {
    const url = `${process.env.WEB_URL ?? "http://localhost:3000"}/auth/verify?token=${rawToken}`;
    const html = `<p>Hi ${this.escape(name)}, welcome to ShopMart! Please verify your email address:</p>
<p><a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700">Verify email</a></p>
<p style="font-size:12px;color:#6b7280">Or paste: ${url}</p>`;
    const text = `Welcome to ShopMart! Verify your email: ${url}`;
    return this.send(to, "Verify your ShopMart email", this.layout("Verify your email", html), text);
  }

  async sendPasswordResetEmail(to: string, name: string, rawToken: string) {
    const url = `${process.env.WEB_URL ?? "http://localhost:3000"}/auth/reset?token=${rawToken}`;
    const html = `<p>Hi ${this.escape(name)}, we received a request to reset your password.</p>
<p><a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700">Reset password</a></p>
<p style="font-size:12px;color:#6b7280">This link expires in 1 hour. If you didn't ask for this, ignore this email.</p>
<p style="font-size:12px;color:#6b7280">Or paste: ${url}</p>`;
    const text = `Reset your ShopMart password (expires in 1 hour): ${url}`;
    return this.send(to, "Reset your ShopMart password", this.layout("Reset your password", html), text);
  }
}
