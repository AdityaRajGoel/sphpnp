#!/usr/bin/env bash
# Fetches the feeds the edge runtime cannot reach (NSDL FPI, BSE results calendar) from
# this host and posts them to sync-market-data, which parses and writes them.
# Mirrors ipo-browser.sh, which does the same for the two JavaScript-rendered IPO pages.
set -euo pipefail
cd /opt/sphpnp/app
export SUPABASE_ANON_KEY=$(grep '^ANON_KEY=' /opt/supabase/.env | cut -d= -f2-)
export MARKET_SYNC_SECRET=$(grep '^SYNC_SECRET=' /opt/supabase/functions.env | cut -d= -f2-)
export SYNC_URL="http://127.0.0.1:8000/functions/v1/sync-market-data"
mkdir -p /var/log/sphpnp-sync
node --experimental-strip-types scripts/host-fetch.mts 2>&1 \
  | sed "s/^/$(date '+%F %T') host-fetch /" | cut -c1-900 >> "/var/log/sphpnp-sync/$(date +%F).log"
