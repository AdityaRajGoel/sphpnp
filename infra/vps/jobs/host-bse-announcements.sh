#!/usr/bin/env bash
# BSE announcements for every tracked stock, fetched from this host with Node and
# written by the sync-bse-announcements function (modes "plan" and "ingest").
# The function's own fetch has been refused by BSE's CDN since 24 Sep 2026 while
# Node on this host is answered - see scripts/host-bse-announcements.mts.
set -euo pipefail
cd /opt/sphpnp/app
export SUPABASE_ANON_KEY=$(grep '^ANON_KEY=' /opt/supabase/.env | cut -d= -f2-)
export MARKET_SYNC_SECRET=$(grep '^SYNC_SECRET=' /opt/supabase/functions.env | cut -d= -f2-)
mkdir -p /var/log/sphpnp-sync
node --experimental-strip-types --no-warnings scripts/host-bse-announcements.mts 2>&1 \
  | sed "s/^/$(date '+%F %T') host-bse-announcements /" | cut -c1-900 >> "/var/log/sphpnp-sync/$(date +%F).log"
