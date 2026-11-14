import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  Module,
  Injectable,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { queryOne, execute } from "../db/database";
import { camel } from "../db/map";
import { CurrentUser, Public } from "../common/decorators";
import { JwtAuthGuard } from "../common/guards";
import { EmailService } from "../email/email.service";

const MPESA_ENV = process.env.MPESA_ENVIRONMENT ?? "sandbox";
const MPESA_BASE = MPESA_ENV === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
const MPESA_SIMULATE = (process.env.MPESA_SIMULATE ?? "true").toLowerCase() !== "false";

@Injectable()
export class MpesaService {
  private consumerKey = process.env.MPESA_CONSUMER_KEY ?? "";
  private consumerSecret = process.env.MPESA_CONSUMER_SECRET ?? "";
  private shortcode = process.env.MPESA_SHORTCODE ?? "174379";
  private passkey = process.env.MPESA_PASSKEY ?? "bfb279f9aa9bdbcf158e97a7a7e6ab26f2b0c558272a3a5cc1c1d7cbc6c5c7e";

  get simulate() {
    return MPESA_SIMULATE || !(this.consumerKey && this.consumerSecret);
  }

  private timestamp(d = new Date()) {
    const pad = (n: number, w = 2) => String(n).padStart(w, "0");
    return String(d.getFullYear()) + pad(d.getMonth() + 1) + pad(d.getDate()) + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  }

  private password(timestamp: string) {
    return Buffer.from(this.shortcode + this.passkey + timestamp).toString("base64");
  }

  private async getAccessToken(): Promise<string> {
    if (this.simulate) return "simulate-token";
    const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString("base64");
    const res = await fetch(`${MPESA_BASE}/oauth/v1/generate?grant_type=client_credentials`, {
      method: "GET",
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) throw new Error(`Daraja auth failed (${res.status}): ${await res.text()}`);
    return ((await res.json()) as any).access_token;
  }

  async stkPush(phone: string, amountKes: number, accountReference: string, transactionDesc: string) {
    if (this.simulate) {
      return {
        MerchantRequestID: `SIM-MR${Math.floor(Math.random() * 1e9)}`,
        CheckoutRequestID: `SIM-CR${Date.now()}${Math.floor(Math.random() * 1000)}`,
        ResponseCode: "0",
        CustomerMessage: "Success. Request accepted for processing (simulated)",
      };
    }
    const ts = this.timestamp();
    const pwd = this.password(ts);
    const token = await this.getAccessToken();
    const partyA = phone.replace(/\D/g, "").replace(/^0/, "254");
    const res = await fetch(`${MPESA_BASE}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        BusinessShortCode: this.shortcode,
        Password: pwd,
        Timestamp: ts,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.max(1, amountKes),
        PartyA: partyA,
        PartyB: this.shortcode,
        PhoneNumber: partyA,
        CallBackURL: process.env.MPESA_CALLBACK_URL,
        AccountReference: accountReference,
        TransactionDesc: (transactionDesc || "ShopMart order").slice(0, 13),
      }),
    });
    const body = (await res.json()) as any;
    if (!res.ok || body.ResponseCode !== "0") {
      throw new Error(`STK push rejected: ${JSON.stringify(body)}`);
    }
    return body;
  }

  async stkQuery(checkoutRequestId: string) {
    if (this.simulate) {
      return { resultCode: "0", resultDesc: "The service request is processed successfully.", responseCode: "0" };
    }
    const ts = this.timestamp();
    const pwd = this.password(ts);
    const token = await this.getAccessToken();
    const res = await fetch(`${MPESA_BASE}/mpesa/stkpushquery/v1/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ BusinessShortCode: this.shortcode, Password: pwd, Timestamp: ts, CheckoutRequestID: checkoutRequestId }),
    });
    const body = (await res.json()) as any;
    return { resultCode: String(body.ResultCode ?? body.ResponseCode ?? ""), resultDesc: String(body.ResultDesc ?? ""), responseCode: String(body.ResponseCode ?? "") };
  }
}

@ApiTags("mpesa")
@Controller("payments/mpesa")
export class MpesaController {
  constructor(private mpesa: MpesaService, private email: EmailService) {}

  private async getOrderForUser(user: any, orderId: string) {
    const order = await queryOne<any>(`SELECT * FROM orders WHERE id = ?`, [orderId]);
    if (!order) throw new BadRequestException("Order not found");
    if (order.user_id !== user.id) throw new BadRequestException("Not your order");
    return order;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post("stk-push")
  async stkPush(@CurrentUser() user: any, @Body() body: { orderId: string; phone: string }) {
    const order = await this.getOrderForUser(user, body.orderId);
    if (order.status !== "pending") throw new BadRequestException("Order is not pending payment");

    const amountKes = Math.round(Number(order.total_cents) / 100);
    const phone = String(body.phone ?? "").replace(/\s+/g, "");
    if (!/^(\+?254|0)(7\d{8}|1\d{8})$/.test(phone)) {
      throw new BadRequestException("Enter a valid Kenyan phone number, e.g. +254712345678 or 0712345678");
    }

    const result = await this.mpesa.stkPush(phone, amountKes, order.number, "ShopMart order");
    await execute(
      `UPDATE orders SET mpesa_checkout_request_id = ?, updated_at = NOW() WHERE id = ?`,
      [result.CheckoutRequestID, order.id]
    );

    if (this.mpesa.simulate) {
      // Auto-approve in dev mode: mark paid and email the customer, same code path as the real callback.
      const receipt = `SIM${Date.now()}${Math.floor(Math.random() * 1000)}`;
      await this.finishPayment(order.id, result.CheckoutRequestID, receipt);
      return {
        ok: true,
        simulate: true,
        receipt,
        checkoutRequestId: result.CheckoutRequestID,
        message: "M-Pesa payment simulated (dev mode). Order marked as paid.",
      };
    }
    return {
      ok: true,
      simulate: false,
      checkoutRequestId: result.CheckoutRequestID,
      message: "STK push sent to your phone. Approve it with your M-Pesa PIN to complete the payment.",
    };
  }

  /** Daraja posts here after the customer approves/rejects the STK push. */
  @Public()
  @Post("callback")
  async callback(@Req() req: any) {
    const cb = req.body?.Body?.stkCallback;
    const checkoutRequestId: string | undefined = cb?.CheckoutRequestID;
    const resultCode: number | undefined = cb?.ResultCode;
    const items: Array<{ Name: string; Value?: string }> = cb?.CallbackMetadata?.Item ?? [];
    const receipt = items.find((it) => it.Name === "MpesaReceiptNumber")?.Value ?? null;
    if (!checkoutRequestId) return { ResultCode: 1, ResultDesc: "Missing CheckoutRequestID" };

    const order = await queryOne<any>(`SELECT * FROM orders WHERE mpesa_checkout_request_id = ?`, [checkoutRequestId]);
    if (!order) return { ResultCode: 1, ResultDesc: "Order not found" };

    if (resultCode === 0) {
      await this.finishPayment(order.id, checkoutRequestId, receipt ?? "DARAJA");
    } else {
      await execute(`UPDATE orders SET status = 'payment_failed', updated_at = NOW() WHERE id = ?`, [order.id]);
    }
    return { ResultCode: 0, ResultDesc: "Accepted" };
  }

  private async finishPayment(orderId: string, checkoutRequestId: string, receipt: string) {
    await execute(
      `UPDATE orders SET status = 'paid', mpesa_receipt = ?, updated_at = NOW() WHERE id = ?`,
      [receipt, orderId]
    );
    const order = await queryOne<any>(`SELECT o.*, u.email FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?`, [orderId]);
    if (order?.email) {
      await this.email.send(
        order.email,
        `Order ${order.number} paid`,
        `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;padding:24px;background:#f3f4f6"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden"><div style="background:#1e3a8a;padding:18px 24px;color:#fff;font-size:20px;font-weight:800">ShopMart Kenya</div><div style="padding:24px"><p><strong>${this.escape(order.number)}</strong> — payment received via M-Pesa.</p><p style="font-size:14px;color:#374151"><strong>Receipt</strong>: ${receipt}<br>We'll notify you when it ships.</p></div></div></body></html>`,
        `Your M-Pesa payment was received. Receipt: ${receipt}.`
      );
    }
  }

  private escape(s: string) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get("status/:orderId")
  async status(@CurrentUser() user: any, @Param("orderId") orderId: string) {
    const order = await this.getOrderForUser(user, orderId);
    const current = await queryOne<any>(`SELECT status, mpesa_receipt FROM orders WHERE id = ?`, [orderId]);
    if (current?.status === "paid") return { status: "paid", receipt: current.mpesa_receipt };
    if (this.mpesa.simulate) return { status: "pending", simulate: true };
    if (!order.mpesa_checkout_request_id) return { status: order.status };
    const q = await this.mpesa.stkQuery(order.mpesa_checkout_request_id);
    if (q.resultCode === "0" && order.status === "pending") {
      await execute(`UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = ?`, [orderId]);
      return { status: "paid" };
    }
    return { status: order.status, daraja: q };
  }
}

@Module({
  providers: [MpesaService, EmailService],
  controllers: [MpesaController],
})
export class MpesaModule {}
