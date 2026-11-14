import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
  Module,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { queryOne, execute } from "../db/database";
import { camel } from "../db/map";
import { CurrentUser, Public } from "../common/decorators";
import { JwtAuthGuard } from "../common/guards";
import Stripe from "stripe";

@ApiTags("payments")
@Controller("payments")
export class PaymentsController {
  private stripe: Stripe | null;

  constructor() {
    const key = process.env.STRIPE_SECRET_KEY;
    this.stripe = key ? new Stripe(key) : null;
  }

  private async getOrder(user: any, orderId: string) {
    const order = await queryOne<any>(`SELECT * FROM orders WHERE id = ?`, [orderId]);
    if (!order) throw new NotFoundException("Order not found");
    if (order.user_id !== user.id) throw new BadRequestException("Not your order");
    return order;
  }

  private async markPaid(orderId: string) {
    await execute(`UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = ?`, [orderId]);
    return camel(await queryOne(`SELECT * FROM orders WHERE id = ?`, [orderId]));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post("orders/:id/create-intent")
  async createIntent(@CurrentUser() user: any, @Param("id") orderId: string) {
    const order = await this.getOrder(user, orderId);
    if (order.status !== "pending") throw new BadRequestException("Order is not pending payment");

    if (!this.stripe) {
      return { clientSecret: null, devMode: true, orderId: order.id, totalCents: order.total_cents };
    }

    const intent = await this.stripe.paymentIntents.create({
      amount: Number(order.total_cents),
      currency: "kes",
      metadata: { orderId: order.id, orderNumber: order.number },
      automatic_payment_methods: { enabled: true },
    });
    await execute(`UPDATE orders SET stripe_payment_intent_id = ?, updated_at = NOW() WHERE id = ?`, [intent.id, order.id]);
    return { clientSecret: intent.client_secret, orderId: order.id, totalCents: Number(order.total_cents) };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post("orders/:id/mock-pay")
  async mockPay(@CurrentUser() user: any, @Param("id") orderId: string) {
    if (process.env.ALLOW_MOCK_PAYMENTS === "false") throw new BadRequestException("Mock payments disabled");
    const order = await this.getOrder(user, orderId);
    if (order.status === "paid") return camel(order);
    if (order.status !== "pending") throw new BadRequestException("Order is not pending payment");
    return this.markPaid(order.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post("orders/:id/confirm")
  async confirm(@CurrentUser() user: any, @Param("id") orderId: string) {
    const order = await this.getOrder(user, orderId);
    if (order.status === "paid") return camel(order);

    if (!this.stripe) return this.markPaid(order.id);
    if (!order.stripe_payment_intent_id) throw new BadRequestException("No payment intent for this order");

    const intent = await this.stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
    if (intent.status === "succeeded") return this.markPaid(order.id);
    throw new BadRequestException(`Payment not completed (status: ${intent.status})`);
  }

  @Public()
  @Post("webhook")
  async webhook(@Req() req: RawBodyRequest<any>) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const sig = req.headers["stripe-signature"] as string | undefined;
    let event: Stripe.Event;
    if (this.stripe && secret && sig) {
      event = this.stripe.webhooks.constructEvent(req.rawBody, sig, secret);
    } else if (this.stripe) {
      event = req.body as Stripe.Event;
    } else {
      return { received: true };
    }

    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const orderId = pi.metadata?.orderId;
      if (orderId) {
        await execute(`UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = ?`, [orderId]);
      }
    }
    return { received: true };
  }
}

@Module({
  controllers: [PaymentsController],
})
export class PaymentsModule {}
