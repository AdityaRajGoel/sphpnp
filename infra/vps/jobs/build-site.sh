#!/usr/bin/env bash
# Nightly rebuild of www.sphpnp.com on the VPS: fresh sitemap, new IPO and stock
# pages prerendered with current data, then published by deploy-site.sh.
# A build that fails, or a dist/ that deploy-site.sh rejects, leaves the live
# site untouched. Runs from /opt/sphpnp/app (kept in sync with the repo).
set -euo pipefail

APP=/opt/sphpnp/app
LOGS=/opt/sphpnp/build-logs
LOG="$LOGS/build-$(date +%F-%H%M).log"
SYNC_LOG="/var/log/sphpnp-sync/$(date +%F).log"
mkdir -p "$LOGS"

note() { printf '%s build-site %s\n' "$(date '+%F %T')" "$*" >> "$SYNC_LOG"; }

# A build runs headless Chrome over ~460 pages on the 4 vCPUs the database and the
# edge functions use, so it stays out of market hours (Mon-Fri 09:00-15:45 IST;
# equity F&O closes 15:40). A build started then is deferred: the flag below makes
# the 15:50 cron run (--if-pending) publish it right after the close, and the 04:30
# nightly build clears it too. FORCE_BUILD=1 builds now regardless.
PENDING=/var/lib/sphpnp/build-site.pending
mkdir -p "$(dirname "$PENDING")"
if [ "${1:-}" = "--if-pending" ] && [ ! -f "$PENDING" ]; then exit 0; fi
dow=$(date +%u); hm=$(date +%H%M)
if [ "${FORCE_BUILD:-}" != "1" ] && [ "$dow" -le 5 ] && [ "$hm" -ge 0900 ] && [ "$hm" -lt 1545 ]; then
  touch "$PENDING"
  note "deferred - market hours; publishes at 15:50 (FORCE_BUILD=1 to build now)"
  exit 0
fi
rm -f "$PENDING"

cd "$APP"
ANON=$(grep '^ANON_KEY=' /opt/supabase/.env | cut -d= -f2-)

if env VITE_SUPABASE_URL=https://api.sphpnp.com VITE_SUPABASE_PUBLISHABLE_KEY="$ANON" \
     VITE_SUPABASE_PROJECT_ID=self-hosted PRERENDER_CONCURRENCY=2 \
     NODE_OPTIONS=--max-old-space-size=3072 npm run build > "$LOG" 2>&1; then
  if out=$(/opt/sphpnp/jobs/deploy-site.sh sphpnp 2>&1); then
    note "ok - $out"
  else
    note "FAILED deploy: $out"; exit 1
  fi
else
  note "FAILED build (see $LOG): $(grep -m1 -E 'Prerender failed|Error' "$LOG" | cut -c1-200)"; exit 1
fi

# Keep two weeks of build logs.
find "$LOGS" -name 'build-*.log' -mtime +14 -delete
