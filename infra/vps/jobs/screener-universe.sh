#!/usr/bin/env bash
# Writes /var/www/sphpnp-data/screener-universe.json (+ .br/.gz) for nginx to serve.
# See scripts/write-screener-universe.mts.
set -euo pipefail
cd /opt/sphpnp/app
export SUPABASE_ANON_KEY=$(grep '^ANON_KEY=' /opt/supabase/.env | cut -d= -f2-)
mkdir -p /var/log/sphpnp-sync
node --experimental-strip-types scripts/write-screener-universe.mts 2>&1 \
  | sed "s/^/$(date '+%F %T') screener-universe /" | cut -c1-400 >> "/var/log/sphpnp-sync/$(date +%F).log"
