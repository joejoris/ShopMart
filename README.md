# ShopMart — Full-Stack Ecommerce

Monorepo with the web storefront, admin dashboard, REST API and mobile app.

## Apps & packages

| Path | Description |
|---|---|
| `apps/api` | NestJS REST API + embedded SQLite via Node's built-in `node:sqlite` (zero-dependency data layer, schema auto-applied on boot) |
| `apps/web` | Next.js 15 (App Router, Tailwind) — storefront + admin at `/admin` |
| `apps/mobile` | Expo / React Native app (`expo start`) |
| `packages/shared` | Shared Zod schemas, types and constants |

## Quick start

```bash
# 1. Install
corepack pnpm install        # or: pnpm install

# 2. Seed the SQLite database (creates file at apps/api/dev.db)
cd apps/api && corepack pnpm db:seed

# 3. API → http://localhost:4000  (Swagger docs at /docs)
cd apps/api && corepack pnpm dev

# 4. Web → http://localhost:3000
cd apps/web && corepack pnpm dev

# 5. Mobile (Expo)
cd apps/mobile && corepack pnpm start
```

The database schema is applied automatically when the API boots — no migration step needed.
Set `NEXT_PUBLIC_API_URL` in `apps/web/.env.local` and `extra.apiUrl` in `apps/mobile/app.json` if the API is not on `localhost:4000`.

## Demo accounts

- **Admin**: `admin@example.com` / `admin1234` — admin dashboard at `/admin`
- **Demo customer**: `demo@example.com` / `demo1234`

## Demo coupons

- `WELCOME10` — 10% off orders ≥ $20
- `SAVE25` — $25 off orders ≥ $100

## Features

- **Email delivery** — all transactional email (order confirmation, shipped/delivered/cancelled, verification, password reset) flows through an outbox persisted in SQLite. Without `SMTP_URL`, emails are logged to the API console and stored in `email_outbox`; admins can inspect them at `/admin/emails` (auto-refreshing). Set `SMTP_URL` + `MAIL_FROM` to send real mail.
- **Email verification & password reset** — register / `POST /auth/resend-verification` send a verification link (24h). `Forgot password` sends a 1h reset link (`/auth/forgot-password` → `/auth/reset`). Tokens are single-use and stored hashed in `email_tokens`.
- **PDF invoice** — `GET /orders/:id/invoice` streams a PDF invoice (owner or admin), downloadable from the order page.
- **Stripe payments** — server-side PaymentIntents + webhook wired and tested in test mode. The checkout uses a simulated `mock-pay` by default (no publishable key needed). To enable real card payments in the browser, set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in `apps/web/.env.local` to your `pk_test_…` key — the checkout then loads Stripe.js with a Payment Element, and confirm → `/payments/orders/:id/confirm`.
- **Admin dashboard** — revenue/orders/customers KPIs, product & coupon management, order status pipeline (delivered/cancelled are terminal, stock restored on cancel), low-stock list, email outbox.

## Architecture notes

- **Database**: embedded SQLite through Node's built-in `node:sqlite` module (no native builds, no engine downloads). The data layer lives in `apps/api/src/db/database.ts` (schema + typed helpers).
  To move to PostgreSQL later, swap this file for a Postgres driver keeping the same helper signatures.
- **Payments**: Stripe test-mode integration in `apps/api/src/payments` (PaymentIntents + webhook).
  The web checkout currently uses a `mock-pay` endpoint so it works without a Stripe publishable key.
  Add `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` + Stripe.js Elements to switch to real test payments.
- The Stripe secret key lives only in `apps/api/.env` (gitignored). Rotate it if it was shared publicly.
- API documentation: Swagger UI at `http://localhost:4000/docs`.

## Quality scripts

```bash
corepack pnpm typecheck
corepack pnpm lint
```
