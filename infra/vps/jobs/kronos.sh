#!/usr/bin/env bash
# Weekly Kronos price forecast into the local stack. Mirrors .github/workflows/kronos-forecast.yml.
set -euo pipefail
export SUPABASE_URL="http://127.0.0.1:8000"
export SUPABASE_ANON_KEY=$(grep '^ANON_KEY=' /opt/supabase/.env | cut -d= -f2-)
export MARKET_SYNC_SECRET=$(grep '^SYNC_SECRET=' /opt/supabase/functions.env | cut -d= -f2-)
export KRONOS_SYMBOLS="${KRONOS_SYMBOLS:-50}"
export PYTHONPATH=/opt/sphpnp/kronos-src
export HF_HOME=/opt/sphpnp/hf-cache
mkdir -p /var/log/sphpnp-sync
/opt/sphpnp/kronos-venv/bin/python /opt/sphpnp/app/scripts/kronos/forecast.py 2>&1 \
  | sed "s/^/$(date '+%F %T') kronos /" | cut -c1-900 >> "/var/log/sphpnp-sync/$(date +%F).log"
