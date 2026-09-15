#!/usr/bin/env bash
# MoSPI CPI, IIP and WPI into the local sync-market-data. Node, not Deno: MoSPI's API
# needs legacy TLS renegotiation. Mirrors the `macro` job of .github/workflows/market-data-sync.yml.
set -euo pipefail
cd /opt/sphpnp/app
export SUPABASE_ANON_KEY=$(grep '^ANON_KEY=' /opt/supabase/.env | cut -d= -f2-)
export SYNC_SECRET=$(grep '^SYNC_SECRET=' /opt/supabase/functions.env | cut -d= -f2-)
export SYNC_URL="http://127.0.0.1:8000/functions/v1/sync-market-data"
mkdir -p /var/log/sphpnp-sync
node --experimental-strip-types scripts/mospi-collect.mts 2>&1 \
  | sed "s/^/$(date '+%F %T') mospi /" | cut -c1-900 >> "/var/log/sphpnp-sync/$(date +%F).log"
