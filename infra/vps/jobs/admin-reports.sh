#!/usr/bin/env bash
# Every 10 minutes: static reports for admin.sphpnp.com (behind the admin login).
#   /var/www/admin/traffic-today.html   GoAccess report for today so far
#   /var/www/admin/client-errors.txt    latest browser error reports, newest first
#   /var/www/admin/status.txt           last build, backup, sync failures, disk, memory
set -uo pipefail

WEB=/var/www/admin
TODAY_NGINX=$(date +%d/%b/%Y)
SYNC_LOG="/var/log/sphpnp-sync/$(date +%F).log"
umask 022

# Traffic today.
lines=$(sudo sh -c 'cat /var/log/nginx/access.log' | grep -F "[$TODAY_NGINX:" || true)
if [ -n "$lines" ]; then
  printf '%s\n' "$lines" | goaccess - --log-format=COMBINED --no-global-config \
    --html-report-title="www.sphpnp.com - today ($(date '+%F %H:%M'))" -o "$WEB/.traffic-today.html" >/dev/null 2>&1 \
    && mv "$WEB/.traffic-today.html" "$WEB/traffic-today.html"
fi

# Browser errors (nginx writes JSON lines; newest first, last 300).
{
  echo "Browser error reports from www.sphpnp.com - newest first (generated $(date '+%F %T'))"
  echo
  # The rotated file only exists after the first logrotate: a missing file must not
  # fail the pipeline (pipefail would skip publishing the report).
  sudo sh -c 'cat /var/log/nginx/client-errors.log.1 2>/dev/null; cat /var/log/nginx/client-errors.log 2>/dev/null; true' | tail -n 300 | tac \
    | python3 /opt/sphpnp/jobs/client-errors-report.py
} > "$WEB/.client-errors.txt" && mv "$WEB/.client-errors.txt" "$WEB/client-errors.txt"

# Jobs and resources.
{
  echo "sphpnp VPS status (generated $(date '+%F %T'))"
  echo
  echo "Website build:   $(cat /var/log/sphpnp-sync/*.log 2>/dev/null | grep -E ' build-site ' | tail -1 | cut -c1-160)"
  echo "Live release:    $(basename "$(readlink -f /var/www/sphpnp/current)")"
  echo "Last backup:     $(cat /var/backups/sphpnp/last-success 2>/dev/null || echo never)"
  echo "Failed syncs today:"
  grep -E '\((000|4[0-9][0-9]|5[0-9][0-9])\)|FAILED' "$SYNC_LOG" 2>/dev/null | tail -10 | cut -c1-160 | sed 's/^/  /' || true
  echo
  df -h / | awk 'NR==2 {print "Disk:            " $3 " used of " $2 " (" $5 ")"}'
  free -h | awk '/Mem/ {print "Memory:          " $3 " used of " $2}'
  echo "Load:            $(cut -d' ' -f1-3 /proc/loadavg)"
  echo "Containers not running: $(docker ps -a --filter status=exited --filter status=restarting --format '{{.Names}}' | grep -vE 'migrate' | tr '\n' ' ')"
} > "$WEB/.status.txt" && mv "$WEB/.status.txt" "$WEB/status.txt"
