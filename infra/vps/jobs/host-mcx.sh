#!/usr/bin/env bash
# MCX futures quotes from MCX's market watch, read in headless Chromium and posted to
# the local sync-mcx function. See scripts/host-mcx.mts.
set -euo pipefail
cd /opt/sphpnp/app
export SUPABASE_ANON_KEY=$(grep '^ANON_KEY=' /opt/supabase/.env | cut -d= -f2-)
export MARKET_SYNC_SECRET=$(grep '^SYNC_SECRET=' /opt/supabase/functions.env | cut -d= -f2-)
mkdir -p /var/log/sphpnp-sync
# Full Chromium, not the headless shell: MCX's CDN refuses the shell. No-op when present.
npx playwright install chromium >/dev/null 2>&1 || true
timeout 150 node --experimental-strip-types scripts/host-mcx.mts 2>&1 \
  | sed "s/^/$(date '+%F %T') host-mcx /" | cut -c1-500 >> "/var/log/sphpnp-sync/$(date +%F).log"
