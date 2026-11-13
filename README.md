# ShopMart — Full-Stack Ecommerce

Monorepo with the web storefront (React Router v7 SSR + Vite), admin dashboard, REST API and mobile app.

## Apps & packages

| Path | Description |
|---|---|
| `apps/api` | NestJS REST API + XAMPP MariaDB (MySQL) on `127.0.0.1:3306` — schema auto-applied on boot |
| `apps/web` | React Router v7 SSR + Vite + Tailwind — storefront + admin at `/admin` |
| `apps/mobile` | Expo / React Native app (`expo start`) |
| `packages/shared` | Shared Zod schemas, types and constants |

## Quick start

```bash
# 1. Install
corepack pnpm install        # or: pnpm install

# 2. Start XAMPP's MySQL module (Control Panel → MySQL → Start).
#    This launches MariaDB on port 3306, default user root / no password.

# 3. Seed the catalog into MariaDB (server-side; creates tables if absent)
cd apps/api && corepack pnpm db:seed

# 4. API → http://localhost:4000  (Swagger docs at /docs)
cd apps/api && corepack pnpm dev

# 5. Web → http://localhost:3000
cd apps/web && corepack pnpm dev

# 6. Mobile (Expo)
cd apps/mobile && corepack pnpm start
```

Database connection — `apps/api/.env`:
```
DATABASE_URL="mysql://root@localhost:3306/ecommerce"
```
Root has no password out of the box. To change the root password, set it in XAMPP's `setup`, then update this string accordingly.

The schema is applied automatically when the API boots — no migration step needed.
Set `VITE_API_URL` / `NEXT_PUBLIC_API_URL` in `apps/web/.env.local` and `extra.apiUrl` in `apps/mobile/app.json` if the API is not on `localhost:4000`.

## Accounts

No default accounts exist — the store starts from an empty users table. Register a new account at `/auth/register`. The first registrant is a **customer**; the database currently has **no admin**.

To promote a user to admin, run:

```bash
node -e "
const mysql = require('C:/projects/ecommerce/node_modules/.pnpm/mysql2@3.24.6_@types+node@22.20.5/node_modules/mysql2/promise');
mysql.createConnection('mysql://root@localhost:3306/ecommerce')
  .then(c => c.query('UPDATE users SET role = \'admin\' WHERE email = \'you@example.com\''))
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); })
"
```

Admin-only routes (`/admin`, `GET /admin/*`) reject customers with 403 and anonymous callers with 401.

## Demo coupons

- `WELCOME10` — 10% off orders ≥ $20
- `SAVE25` — $25 off orders ≥ $100

## Features

- **Email delivery** — all transactional email (order confirmation, shipped/delivered/cancelled, verification, password reset) flows through an outbox persisted in MariaDB. Without `SMTP_URL`, emails are logged to the API console and stored in `email_outbox`; admins can inspect them at `/admin/emails` (auto-refreshing). Set `SMTP_URL` + `MAIL_FROM` to send real mail.
- **Email verification & password reset** — register / `POST /auth/resend-verification` send a verification link (24h). `Forgot password` sends a 1h reset link (`/auth/forgot-password` → `/auth/reset`). Tokens are single-use and stored hashed in `email_tokens`.
- **PDF invoice** — `GET /orders/:id/invoice` streams a PDF invoice (owner or admin), downloadable from the order page.
- **Stripe payments** — server-side PaymentIntents + webhook wired and tested in test mode. The checkout uses a simulated `mock-pay` by default (no publishable key needed). To enable real card payments in the browser, set `VITE_STRIPE_PUBLISHABLE_KEY` in `apps/web/.env.local` to your `pk_test_…` key — the checkout then loads Stripe.js with a Payment Element, and confirm → `/payments/orders/:id/confirm`. The Stripe **secret** key (`STRIPE_SECRET_KEY`) is read from `apps/api/.env`.
- **Featured products curation** — `GET /products/featured` returns curated picks (the latest 3 marked `featured` in the admin), backfilled to 8 with the newest active products so the homepage always has a full carousel. Toggle per-product at `/admin/products`.
- **Low-stock & out-of-stock alerts** — the moment an order pushes a product below 5 units (or to 0), an email goes to the first admin account via the outbox. Shows at `/admin/emails`. Stock restored on cancellation.
- **Abandoned cart recovery + stuck-order digest** — runs every 15 min / every hour; emails each customer once per week if they left a registered cart idle for 24h+, and sends the admin a daily digest of orders stuck in `pending` for 24h+ (suppressed if one was already sent recently).
  Manual triggers (admin only): `POST /admin/operations/run-abandoned-carts`, `POST /admin/operations/run-stuck-orders`, `POST /admin/operations/run-all`.
- **Admin dashboard** — revenue/orders/customers KPIs, product & coupon management, order status pipeline (delivered/cancelled are terminal, stock restored on cancel), low-stock list, email outbox, featured picks.

## Architecture notes

- **Database**: MariaDB 10.11 (XAMPP bundled) via the `mysql2` driver. The DAL lives in `apps/api/src/db/database.ts` (schema + typed helpers) and boots with `CREATE DATABASE IF NOT EXISTS ecommerce` — no migration step. InnoDB FKs model cascade deletes for cart items, order items, reviews, wishlist items, and inventory logs.
- **Payments**: Stripe test-mode integration in `apps/api/src/payments` (PaymentIntents + webhook).
  The web checkout currently uses a `mock-pay` endpoint so it works without a Stripe publishable key.
  Add `VITE_STRIPE_PUBLISHABLE_KEY` to `apps/web/.env.local` to switch to real test payments via Stripe.js Elements.
- The Stripe secret key lives only in `apps/api/.env` (gitignored). Rotate it if it was shared publicly.
- API documentation: Swagger UI at `http://localhost:4000/docs`.

## Quality scripts

```bash
corepack pnpm typecheck
corepack pnpm lint
```
