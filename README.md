# ShopMart — Full-Stack Ecommerce

Monorepo with the web storefront (React Router v7 SSR + Vite), admin dashboard, REST API and mobile app.

**Apache (optional, supported):** XAMPP's Apache can sit in front as reverse proxy — requests to `http://localhost/` serve the web app, `http://localhost/api/v1/…` is proxied to the NestJS API on `:4000`. Both Node processes remain standalone; Apache is just the doorway. Configured at `C:/xampp/apache/conf/extra/httpd-vhosts.conf`.


| Path | Description |
|---|---|
| `apps/api` | NestJS REST API + XAMPP MariaDB (MySQL) on `127.0.0.1:3306` — schema auto-applied on boot |
| `apps/web` | React Router v7 SSR + Vite + Tailwind — the customer storefront (no admin pages) |
| `apps/admin` | **Moved** — the admin console now lives in its own repository: https://github.com/joejoris/ShopMart-Admin (cloned at `C:\projects\shopmart-admin`) |
| `apps/mobile` | Expo / React Native app (`expo start`) |
| `packages/shared` | Shared Zod schemas, types and constants |

## Quick start

```bash
# 1. Install
corepack pnpm install        # or: pnpm install

# 2. Start XAMPP's MySQL module (Control Panel → MySQL → Start).
#    This launches MariaDB on port 3306, default user root / no password.
#
#    ...or simply run the all-in-one starter (safe to re-run; starts only
#    what's missing):
#        scripts\start-shopmart.bat
#    It launches MariaDB → API → web → admin console → Apache, and leaves
#    the rest alone. Logs land in .logs\.

# 3. (Optional but recommended) Start XAMPP's Apache module too (Control Panel → Apache → Start).
#    This exposes the storefront on http://localhost/ WITHOUT remembering port 3000 —
#    http://localhost/api/v1/* is reverse-proxied to the API on :4000.
#    Apache config lives at C:/xampp/apache/conf/extra/httpd-vhosts.conf.

# 4. Seed the catalog into MariaDB (server-side; creates tables if absent)
cd apps/api && corepack pnpm db:seed

# 5. API → http://localhost:4000  (Swagger docs at /docs)
cd apps/api && corepack pnpm dev

# 6. Web → http://localhost:3000  (or plain http://localhost/ through Apache)
cd apps/web && corepack pnpm dev

# 6b. Admin console → http://localhost:3001  (SEPARATE repo: joejoris/ShopMart-Admin)
cd C:\projects\shopmart-admin && node node_modules/vite/bin/vite.js
# or just run scripts\start-shopmart.bat which launches everything incl. the console

# 6c. Database backup (all tables) → backups\ecommerce-<timestamp>.sql
scripts\backup-db.bat
# backups are gitignored — they contain personal data. Keeps the 14 most recent.

# 7. Mobile (Expo)
cd apps/mobile && corepack pnpm start
```

Database connection — `apps/api/.env`:
```
DATABASE_URL="mysql://root@localhost:3306/ecommerce"
```
Root has no password out of the box. To change the root password, set it in XAMPP's `setup`, then update this string accordingly.

The schema is applied automatically when the API boots — no migration step needed.
Set `VITE_API_URL` in `apps/web/.env.local` and `extra.apiUrl` in `apps/mobile/app.json` if the API is not on `localhost:4000`.
## Kenya-first configuration

- **Prices**: KES (Kenyan Shilling) throughout, `Ksh X,XXX` formatting
- **Tax**: 16% VAT (`TAX_RATE` in `packages/shared`)
- **Currency**: `Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 })`
- **Delivery**: Nairobi same-day, countrywide 2–4 days; express next-day
- **Free delivery threshold**: Ksh 5,000
- **Demo coupons** all in KES:
  - `WELCOME10` — 10% off orders ≥ Ksh 6,000
  - `SAVE25` — Ksh 3,000 off orders ≥ Ksh 15,000

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

**Admin access** lives in the separate console repo at `http://localhost:3001` — see [ShopMart-Admin](https://github.com/joejoris/ShopMart-Admin). Its own login, role-gated (non-admin accounts see an access-denied screen). The ShopMart storefront exposes no admin UI.

Admin-only API endpoints (`GET /admin/*`) reject customers with 403 and anonymous callers with 401.

## Demo coupons

- `WELCOME10` — 10% off orders ≥ Ksh 6,000
- `SAVE25` — Ksh 3,000 off orders ≥ Ksh 15,000

## Features

- **M-Pesa / Safaricom Daraja** — Kenya-native mobile money checkout via `POST /payments/mpesa/stk-push`. In dev the API runs an automatic simulator (`MPESA_SIMULATE=true`) — the order is instantly "paid" as if the customer approved on their phone, confirmation email sent to the outbox. In production set:
  - `MPESA_ENVIRONMENT` = `production`
  - `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` / `MPESA_SHORTCODE` / `MPESA_PASSKEY` (from Daraja)
  - `MPESA_CALLBACK_URL` = `https://<your-host>/api/v1/payments/mpesa/callback` (Daraja cannot reach `localhost`)
  - Leave `MPESA_SIMULATE=""` or `"false"` in production — the simulator flips every STK push to success, which is fine for dev but must never be on for a real store.
  - `STK push` sends an actual payment pop-up to the customer's phone; the customer approves with their M-Pesa PIN; Daraja posts the result to the callback URL; the order is marked paid automatically.
- **Email delivery** — all transactional email (order confirmation, paid, shipped/delivered/cancelled, verification, password reset) flows through an outbox persisted in MariaDB. Without `SMTP_URL`, emails are logged to the API console and stored in `email_outbox`; admins can inspect them at `/admin/emails` (auto-refreshing). Set `SMTP_URL` + `MAIL_FROM` to send real mail.
- **Email verification & password reset** — register / `POST /auth/resend-verification` send a verification link (24h). `Forgot password` sends a 1h reset link (`/auth/forgot-password` → `/auth/reset`). Tokens are single-use and stored hashed in `email_tokens`.
- **PDF invoice** — `GET /orders/:id/invoice` streams a PDF invoice (owner or admin), downloadable from the order page.
- **M-Pesa payments** — Primary checkout option for Kenya. Server-side STK push via `POST /payments/mpesa/stk-push` + Daraja callback at `POST /payments/mpesa/callback` + `GET /payments/mpesa/status/:orderId` for post-purchase status polling. Dev mode auto-simulates payment. Switch to real Safaricom Daraja by setting production credentials (see above).
- **Stripe payments (optional)** — If you want card payments too, server-side PaymentIntents + webhook are already wired. Set `VITE_STRIPE_PUBLISHABLE_KEY` in `apps/web/.env.local`; checkout then offers card alongside M-Pesa.
- **The Stripe secret key lives only in `apps/api/.env` (gitignored).**
- **Featured products curation** — `GET /products/featured` returns curated picks (the latest 3 marked `featured` in the admin), backfilled to 8 with the newest active products so the homepage always has a full carousel. Toggle per-product at `/admin/products`.
- **Low-stock & out-of-stock alerts** — the moment an order pushes a product below 5 units (or to 0), an email goes to the first admin account via the outbox. Shows at `/admin/emails`. Stock restored on cancellation.
- **Abandoned cart recovery + stuck-order digest** — runs every 15 min / every hour; emails each customer once per week if they left a registered cart idle for 24h+, and sends the admin a daily digest of orders stuck in `pending` for 24h+ (suppressed if one was already sent recently).
  Manual triggers (admin only): `POST /admin/operations/run-abandoned-carts`, `POST /admin/operations/run-stuck-orders`, `POST /admin/operations/run-all`.
- **Admin dashboard** — revenue/orders/customers KPIs, product & coupon management, order status pipeline (delivered/cancelled are terminal, stock restored on cancel), low-stock list, email outbox, featured picks.

## Architecture notes

- **Database**: MariaDB 10.11 (XAMPP bundled) via the `mysql2` driver. The DAL lives in `apps/api/src/db/database.ts` (schema + typed helpers) and boots with `CREATE DATABASE IF NOT EXISTS ecommerce` — no migration step. InnoDB FKs model cascade deletes for cart items, order items, reviews, wishlist items, and inventory logs.
- **Payments**: Primary is M-Pesa via Daraja (`apps/api/src/mpesa`). Card fallback via Stripe is wired but optional.
  If neither `MPESA_*` nor `STRIPE_*` are configured, the checkout still works end-to-end in dev mode — every M-Pesa click resolves to `"simulated paid"`.
- The Stripe secret key lives only in `apps/api/.env` (gitignored). Rotate it if it was shared publicly.
- API documentation: Swagger UI at `http://localhost:4000/docs`.

## Quality scripts

```bash
corepack pnpm typecheck
corepack pnpm lint
```

## Deployment

**Netlify** (storefront SSR): the repo ships a root `netlify.toml`
(`pnpm install --frozen-lockfile && pnpm exec turbo run build --filter=@ecommerce/web`,
publish `apps/web/build/client`, Node 24). In Netlify:
1. Add new site → Import `joejoris/ShopMart`
2. Build auto-detects from `netlify.toml` (`@netlify/vite-plugin-react-router` is pre-installed)
3. The API is NOT deployed to Netlify — set `CORS_ORIGINS` on the API host to the Netlify origin, or run everything on one VPS (below)

**Single VPS (everything on one box)**: see `infra/DEPLOY.md` — full runbook
(Ubuntu 24.04, nginx vhosts for storefront/API/admin, systemd units, MariaDB,
nightly backups, certbot HTTPS). `infra/setup-ubuntu.sh` performs the system setup.

**Admin console**: separate repo — https://github.com/joejoris/ShopMart-Admin
(static SPA on Netlify via its own `netlify.toml`, or `vite build --base=/admin/` served by nginx).
