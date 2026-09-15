#!/usr/bin/env bash
# Renders InvestorGain + Chittorgarh in headless Chromium and posts the IPOs to the
# local sync-ipos function. Mirrors .github/workflows/ipo-browser-sync.yml.
set -euo pipefail
cd /opt/sphpnp/app
export SUPABASE_ANON_KEY=$(grep '^ANON_KEY=' /opt/supabase/.env | cut -d= -f2-)
export MARKET_SYNC_SECRET=$(grep '^SYNC_SECRET=' /opt/supabase/functions.env | cut -d= -f2-)
export SYNC_URL="http://127.0.0.1:8000/functions/v1/sync-ipos"
mkdir -p /var/log/sphpnp-sync
node --experimental-strip-types scripts/ipo-browser-scrape.mts 2>&1 \
  | sed "s/^/$(date '+%F %T') ipo-browser /" | cut -c1-900 >> "/var/log/sphpnp-sync/$(date +%F).log"
