# ShopMart Kenya — Ubuntu VPS deployment runbook

Target architecture (single VPS, e.g. DigitalOcean / Hetzner CPX11, Ubuntu 24.04 LTS):

```
                ┌──────────── nginx (:80 / :443) ────────────┐
        HTTPS   │  /            → 127.0.0.1:3000 (web SSR)   │
   browser ────►│  /api/v1/*    → 127.0.0.1:4000 (NestJS API)│
                │  /admin/*     → ShopMart-Admin static build │
                └──────────────────────────────────────────────┘
```

- **Storefront + API**: Node 24 on bare metal via systemd (`shopmart-web`, `shopmart-api`)
- **Admin console**: static Vite build served by nginx from `/opt/shopmart-admin/dist`
- **Database**: MariaDB on the same host, nightly `mysqldump` backup

## 0. Prerequisites

- A VPS (≥ 2 vCPU / 4 GB RAM recommended) running Ubuntu 24.04 LTS
- A domain (optional but strongly recommended). Example below uses `shopmart.example.co.ke` with `admin.shopmart.example.co.ke` — substitute yours
- DNS A/AAAA records pointing at the VPS IP (fill these when you provisions it)
- SSH access as the root user

Suggested hosts budget: ~$5–6/month (DigitalOcean/Hetzner) + domain (~$10/year).

## 1. Provision the box

SSH in as root and run the idempotent provisioner:

```bash
apt-get update
bash <(curl -fsSL https://raw.githubusercontent.com/joejoris/ShopMart/main/infra/setup-ubuntu.sh)
```
or copy `infra/setup-ubuntu.sh` to the server and run `bash setup-ubuntu.sh`.
It installs: Node 24, pnpm, MariaDB, nginx, ufw (22/80/443), PM2 not used (systemd instead).

## 2. Create the database + a least-privilege user

```bash
mariadb -u root <<'SQL'
CREATE DATABASE IF NOT EXISTS ecommerce CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'shopmart'@'localhost' IDENTIFIED BY 'CHANGE-ME-LONG-RANDOM';
GRANT ALL PRIVILEGES ON ecommerce.* TO 'shopmart'@'localhost';
FLUSH PRIVILEGES;
SQL
```

Give the API its own credential instead of root. Generate a strong password:
`openssl rand -base64 32`

## 3. Clone both apps

```bash
git clone https://github.com/joejoris/ShopMart.git        /opt/shopmart
git clone https://github.com/joejoris/ShopMart-Admin.git  /opt/shopmart-admin
```

## 4. API configuration

Copy the template and edit:

```bash
cd /opt/shopmart/apps/api && cp .env.example .env && nano .env
```

Set (never commit this file):

```
DATABASE_URL="mysql://shopmart:LONG-SECRET@localhost:3306/ecommerce"
JWT_SECRET="<openssl rand -hex 32>"
JWT_REFRESH_SECRET="<openssl rand -hex 32>"
PORT=4000
CORS_ORIGINS="https://shopmart.example.co.ke"
ALLOW_MOCK_PAYMENTS="false"
```

Build shared + api:

```bash
cd /opt/shopmart && corepack pnpm install --frozen-lockfile
corepack pnpm exec turbo run build --filter=@ecommerce/api
```

The schema is applied automatically on first API boot (`ensureSchema()`), or restore your local backup:

```bash
mariadb -u root ecommerce < /opt/shopmart/backups/ecommerce-<stamp>.sql
# (copy the backup up from your Windows machine first)
```

## 5. Web (SSR) configuration

```bash
cd /opt/shopmart && corepack pnpm exec turbo run build --filter=@ecommerce/web
```

`react-router serve` listens on :3000 by default (uses `PORT`, default 3000).

## 6. Admin console static build (served at /admin/)

```bash
cd /opt/shopmart-admin && corepack pnpm install --frozen-lockfile
corepack pnpm exec vite build --base=/admin/
```

`vite build --base=/admin/` makes all asset URLs resolve under `/admin/`.

## 7. systemd units

```bash
cp /opt/shopmart/infra/systemd/shopmart-api.service /etc/systemd/system/
cp /opt/shopmart/infra/systemd/shopmart-web.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now shopmart-api shopmart-web
systemctl status shopmart-api shopmart-web
```

Logs: `journalctl -u shopmart-api -f` and `journalctl -u shopmart-web -f`.

## 8. nginx vhosts

```bash
cp /opt/shopmart/infra/nginx.shopmart.conf /etc/nginx/sites-available/shopmart
ln -s /etc/nginx/sites-available/shopmart /etc/nginx/sites-enabled/shopmart
nginx -t && systemctl reload nginx
```

Replace `shopmart.example.co.ke` with your domain. Without a domain, use the raw VPS IP and three `server_name _` blocks on ports 80/443/8080 (docs note this path in the config comments).

## 9. HTTPS (strongly recommended)

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d shopmart.example.co.ke -d www.shopmart.example.co.ke -d admin.shopmart.example.co.ke
```

certbot rewrites the vhosts with TLS automatically. Renewal is automatic.

## 10. Firewall

```bash
ufw allow 22; ufw allow 80; ufw allow 443; ufw --force enable
```

## 11. First admin account

The production DB starts empty. Register on the live store, then promote yourself:

```bash
mariadb -u root ecommerce -e "UPDATE users SET role='admin' WHERE email='you@example.com';"
```

Sign in at `https://admin.shopmart.example.co.ke/`.

## 12. Nightly backups (off-box)

```bash
cat > /etc/cron.daily/shopmart-backup <<'EOF'
#!/bin/bash
mysqldump -u root ecommerce | gzip > /var/backups/ecommerce-$(date +\%F).sql.gz
find /var/backups -name 'ecommerce-*.sql.gz' -mtime +14 -delete
EOF
chmod +x /etc/cron.daily/shopmart-backup
```

Copy backoff-server backups to a second location (e.g. `rclone` to Backblaze/S3 or your own workstation with `scp`) — a single box is a single point of failure.

## 13. Production checklist

- [ ] Strong secrets in `/opt/shopmart/apps/api/.env` (never committed)
- [ ] `JWT_SECRET` and `JWT_REFRESH_SECRET` are 64+ char random strings
- [ ] MariaDB root has a password; API uses a dedicated least-privilege user
- [ ] `ALLOW_MOCK_PAYMENTS="false"`
- [ ] M-Pesa: `MPESA_SIMULATE="false"`, real Daraja production keys set in `.env`
- [ ] `SMTP_URL` set to a real provider (Brevo/SendGrid/Zoho/Gmail) so emails actually send
- [ ] CORS_ORIGINS locked to your domain
- [ ] nginx serving only :80/:443; ufw enabled; fail2ban optional
- [ ] Backups copied off-box regularly; one restore rehearsed

## Rollback

Stop both services, restore the last good `ecommerce-*.sql.gz` into MariaDB, and `git` to the last known-good SHA for each repo, then `turbo run build` both apps and restart.

## Troubleshooting

| Symptom | Look at |
|---|---|
| Storefront 502 | `journalctl -u shopmart-web`, `nginx -t`, is :3000 listening? |
| API 502 | `journalctl -u shopmart-api`, is :4000 listening? `.env` valid? |
| "Unknown database" | API ran before import — create `ecommerce` first |
| Admin console blank | built with `--base=/admin/`? served at `/admin/`? `_redirects`? |
| Login CORS errors | `CORS_ORIGINS` must exactly match the public origin |
