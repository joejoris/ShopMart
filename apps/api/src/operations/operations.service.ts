import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { queryAll, queryOne, execute } from "../db/database";
import { EmailService } from "../email/email.service";

const STUCK_ORDER_SUBJECT = "Stuck orders digest";
const STUCK_WINDOW = "-24 hours";

const formatCents = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

@Injectable()
export class OperationsService {
  private readonly logger = new Logger("OperationsService");
  constructor(private email: EmailService) {}

  /** Registered users whose cart has items but hasn't been touched in 24h get one reminder per week. */
  @Cron("*/15 * * * *")
  async abandonedCartReminders() {
    return this._runAbandonedCartReminders();
  }

  /** Admin digest of orders stuck in 'pending' for >24h. Sent at most once per ~20h. */
  @Cron("0 * * * *")
  async stuckOrderDigest() {
    return this._runStuckOrderDigest();
  }

  async _runAbandonedCartReminders() {
    const cutoff = new Date(Date.now() - 24 * 3600_000).toISOString();
    const cooldown = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    const carts = queryAll<any>(
      `SELECT c.id, c.user_id, u.email, u.name
       FROM carts c JOIN users u ON u.id = c.user_id
       WHERE c.updated_at < ?
         AND (c.last_reminder_sent_at IS NULL OR c.last_reminder_sent_at < ?)
         AND EXISTS (SELECT 1 FROM cart_items ci WHERE ci.cart_id = c.id)
       LIMIT 50`,
      [cutoff, cooldown]
    );
    let sent = 0;
    for (const c of carts) {
      const items = queryAll<any>(
        `SELECT ci.quantity, p.title FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.cart_id = ?`,
        [c.id]
      );
      if (items.length === 0) continue;
      const lines = items.map((i) => `- ${i.title} × ${i.quantity}`).join("\n");
      const html = `<p>Hi ${c.name}, you left these items in your cart:</p><ul>${items.map((i) => `<li>${i.title} × ${i.quantity}</li>`).join("")}</ul><p><a href="${process.env.WEB_URL ?? "http://localhost:3000"}/cart" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700">Return to your cart</a></p><p style="font-size:12px;color:#6b7280">If you no longer want these items, you can safely ignore this email.</p>`;
      const text = `You left items in your cart:\n${lines}\nReturn to cart: ${process.env.WEB_URL ?? "http://localhost:3000"}/cart`;
      await this.email.send(c.email, "Your ShopMart cart is waiting", `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;padding:24px;background:#f3f4f6"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden"><div style="background:#1e3a8a;padding:18px 24px;color:#fff;font-size:20px;font-weight:800">ShopMart</div><div style="padding:24px">${html}</div></div></body></html>`, text);
      execute(`UPDATE carts SET last_reminder_sent_at = datetime('now') WHERE id = ?`, [c.id]);
      sent += 1;
    }
    return { remindersSent: sent };
  }

  async _runStuckOrderDigest() {
    const admin = queryOne<{ email: string }>(`SELECT email FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1`);
    if (!admin) return { digestSent: 0 };
    const stuck = queryAll<{ number: string; total_cents: number; created_at: string }>(
      `SELECT number, total_cents, created_at FROM orders WHERE status = 'pending' AND created_at < datetime('now', ?) ORDER BY created_at ASC LIMIT 25`,
      [STUCK_WINDOW]
    );
    if (stuck.length === 0) return { digestSent: 0 };
    const prev = queryOne(`SELECT id FROM email_outbox WHERE subject = ? AND created_at > datetime('now', '-20 hours') LIMIT 1`, [STUCK_ORDER_SUBJECT]);
    if (prev) {
      this.logger.log("stuck-order digest suppressed (already sent recently)");
      return { digestSent: 0, suppressed: true };
    }
    const lines = stuck.map((o) => `- ${o.number} · ${formatCents(o.total_cents)} · ${new Date(o.created_at).toLocaleDateString()}`).join("\n");
    const html = `<p>There are <strong>${stuck.length}</strong> stuck pending order(s):</p><ul>${stuck.map((o) => `<li><strong>${o.number}</strong> · ${formatCents(o.total_cents)} · ${new Date(o.created_at).toLocaleString()}</li>`).join("")}</ul><p>Review them in <a href="${process.env.WEB_URL ?? "http://localhost:3000"}/admin/orders">/admin/orders</a>.</p>`;
    const text = `There are ${stuck.length} stuck pending order(s):\n${lines}`;
    await this.email.send(admin.email, STUCK_ORDER_SUBJECT, `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;padding:24px;background:#f3f4f6"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden"><div style="background:#1e3a8a;padding:18px 24px;color:#fff;font-size:20px;font-weight:800">ShopMart</div><div style="padding:24px">${html}</div></div></body></html>`, text);
    return { digestSent: 1, stuckCount: stuck.length };
  }
}
