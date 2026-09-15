#!/usr/bin/env bash
# Daily GoAccess traffic report for www.sphpnp.com from the nginx access logs ->
# /var/log/sphpnp/traffic/<date>.html (kept 30 days). Read it over SSH:
#   scp sphpnp-vps:/var/log/sphpnp/traffic/<date>.html . && open <date>.html
# Server-side counts include bots and visitors who block scripts, so they complement
# Umami rather than replace it.
#   traffic-report.sh [YYYY-MM-DD]     default: yesterday
set -euo pipefail

OUT=/var/log/sphpnp/traffic
DAY=${1:-$(date -d yesterday +%F)}
STAMP=$(date -d "$DAY" +%d/%b/%Y)
SYNC_LOG="/var/log/sphpnp-sync/$(date +%F).log"
mkdir -p "$OUT"

lines=$(sudo sh -c 'cat /var/log/nginx/access.log.1 /var/log/nginx/access.log 2>/dev/null' | grep -F "[$STAMP:" || true)
if [ -z "$lines" ]; then
  echo "$(date '+%F %T') traffic-report $DAY: no access log lines, nothing to report" >> "$SYNC_LOG"
  exit 0
fi

printf '%s\n' "$lines" | goaccess - --log-format=COMBINED --no-global-config \
  --html-report-title="www.sphpnp.com - $DAY" -o "$OUT/$DAY.html" >/dev/null 2>&1

echo "$(date '+%F %T') traffic-report $DAY: $(printf '%s\n' "$lines" | wc -l) requests, report $(du -h "$OUT/$DAY.html" | cut -f1)" >> "$SYNC_LOG"
find "$OUT" -name '*.html' -mtime +30 -delete
