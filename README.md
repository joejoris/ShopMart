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
