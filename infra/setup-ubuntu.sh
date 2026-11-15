#!/usr/bin/env bash
# Idempotent Ubuntu 24.04 provisioner for ShopMart (run as root).
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

echo "=== Update & base packages ==="
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg lsb-release ufw \
  nginx mariadb-server mariadb-client \
  git build-essential

echo "=== Node 24 via NodeSource ==="
if ! command -v node >/dev/null || [[ "$(node -v)" != v24.* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
npm install -g pnpm@11.19.0
corepack enable || true

echo "=== MariaDB hardening (root socket auth) ==="
mysql -u root <<'SQL' || true
ALTER USER 'root'@'localhost' IDENTIFIED VIA unix_socket;
FLUSH PRIVILEGES;
SQL

echo "=== nginx service ==="
systemctl enable --now nginx

echo "=== Firewall: SSH + HTTP + HTTPS only ==="
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "=== Done. Next steps (see infra/DEPLOY.md) ==="
echo "  1. Create DB + least-privilege user (section 2)"
echo "  2. Clone both repos into /opt"
echo "  3. Build API + web, configure nginx, systemd units"
echo "  4. Restore backup / register admin / nightly backups"
