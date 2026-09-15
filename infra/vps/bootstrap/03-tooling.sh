#!/usr/bin/env bash
# Tooling for the backend, backups, and building and serving the website.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

SUPABASE_CLI_VERSION="2.117.0"
RCLONE_VERSION="1.75.1"
DENO_VERSION="2.1.4"   # matches the Supabase edge runtime

install -m 0755 -d /etc/apt/keyrings

# Node.js 22 LTS - builds the website (Vite needs >= 22.12).
if ! node --version 2>/dev/null | grep -q '^v22\.'; then
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
fi

# PostgreSQL 17 client from PGDG - pg_dump/psql that handle servers 15 through 17.
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor --yes -o /etc/apt/keyrings/postgresql.gpg
echo "deb [signed-by=/etc/apt/keyrings/postgresql.gpg] https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo "$VERSION_CODENAME")-pgdg main" > /etc/apt/sources.list.d/pgdg.list

# Caddy - reverse proxy and automatic TLS for the website and API.
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/caddy-stable.gpg
echo "deb [signed-by=/etc/apt/keyrings/caddy-stable.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" > /etc/apt/sources.list.d/caddy-stable.list

# cloudflared - Cloudflare Tunnel connector.
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg -o /etc/apt/keyrings/cloudflare-main.gpg
echo "deb [signed-by=/etc/apt/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" > /etc/apt/sources.list.d/cloudflared.list

apt-get update
apt-get install -y nodejs postgresql-client-17 caddy cloudflared age

# SQL and scripting tools. Postgres itself runs in the supabase/postgres container
# (with its extensions); the host only needs clients and diagnostics:
#   pgcli       - interactive psql with autocomplete
#   pg_activity - top-style live view of running queries and locks
#   pgbadger    - turns Postgres logs into a slow-query report
#   sqlite3     - quick local data work and scratch analysis
#   python3     - data/ops scripts (the Kronos forecast job is Python)
apt-get install -y --no-install-recommends \
  pgcli pg-activity pgbadger sqlite3 \
  python3 python3-venv python3-pip pipx build-essential

# Chromium runtime libraries for the Puppeteer prerender step of the website build.
apt-get install -y --no-install-recommends \
  libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libxkbcommon0 libxcomposite1 libxdamage1 \
  libxrandr2 libgbm1 libasound2t64 libpango-1.0-0 libcairo2 libxshmfence1 fonts-liberation fonts-noto-color-emoji

# Web serving: nginx with the brotli modules (nginx/sphpnp-com.conf uses brotli_static),
# certbot for Let's Encrypt with automatic renewal, and the compressors deploy-site.sh
# uses to precompress each release.
apt-get install -y --no-install-recommends \
  nginx certbot python3-certbot-nginx \
  libnginx-mod-http-brotli-static libnginx-mod-http-brotli-filter brotli pigz
systemctl enable --now nginx certbot.timer

# Caddy was the first choice for the web phase; nginx serves the site instead.
# Keep it installed but stopped so it never competes for ports 80 and 443.
systemctl disable --now caddy >/dev/null 2>&1 || true

# Supabase CLI - applies migrations and manages functions against the stack.
if ! supabase --version 2>/dev/null | grep -q "$SUPABASE_CLI_VERSION"; then
  tmp=$(mktemp -d)
  curl -fsSL -o "$tmp/supabase.deb" "https://github.com/supabase/cli/releases/download/v${SUPABASE_CLI_VERSION}/supabase_${SUPABASE_CLI_VERSION}_linux_amd64.deb"
  apt-get install -y "$tmp/supabase.deb"
  rm -rf "$tmp"
fi

# rclone - copies encrypted backups to off-server object storage.
if ! rclone version 2>/dev/null | grep -q "v${RCLONE_VERSION}"; then
  tmp=$(mktemp -d)
  curl -fsSL -o "$tmp/rclone.deb" "https://github.com/rclone/rclone/releases/download/v${RCLONE_VERSION}/rclone-v${RCLONE_VERSION}-linux-amd64.deb"
  apt-get install -y "$tmp/rclone.deb"
  rm -rf "$tmp"
fi

# Deno - type-checks and tests the edge functions with the runtime's version.
if ! deno --version 2>/dev/null | grep -q "deno ${DENO_VERSION}"; then
  tmp=$(mktemp -d)
  curl -fsSL -o "$tmp/deno.zip" "https://github.com/denoland/deno/releases/download/v${DENO_VERSION}/deno-x86_64-unknown-linux-gnu.zip"
  unzip -o -q "$tmp/deno.zip" -d /usr/local/bin
  chmod 0755 /usr/local/bin/deno
  rm -rf "$tmp"
fi

echo "node $(node --version) | npm $(npm --version) | $(psql --version) | supabase $(supabase --version) | $(deno --version | head -1) | $(nginx -v 2>&1) | $(certbot --version 2>&1) | $(cloudflared --version) | $(rclone version | head -1) | age $(age --version)"
