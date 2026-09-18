#!/usr/bin/env bash
# Daily log archive and error digest -> /var/log/sphpnp/
#   containers/<date>/<container>.log.gz  every Supabase and tools container, last 24h
#   nginx/<date>-error.log.gz             nginx error log lines for the day
#   errors/<date>.log                     one digest: container errors, nginx errors,
#                                         failed syncs, failed or rolled-back builds
# Docker keeps only 5 x 20 MB per container and nginx rotates after 14 days, so this
# is the copy that survives. Archives are kept 90 days, digests 365 days.
set -uo pipefail

ROOT=/var/log/sphpnp
DAY=$(date -d yesterday +%F)
SINCE="$DAY"T00:00:00
UNTIL=$(date +%F)T00:00:00
umask 027
mkdir -p "$ROOT/containers/$DAY" "$ROOT/nginx" "$ROOT/errors"
DIGEST="$ROOT/errors/$DAY.log"
: > "$DIGEST"

ERR='error|exception|fatal|panic|traceback|unhandled|killed|oom|refused|timed out|timeout'

for name in $(docker ps -a --format '{{.Names}}' | grep -E '^(supabase|realtime|sphpnp-tools)'); do
  out="$ROOT/containers/$DAY/$name.log.gz"
  docker logs --since "$SINCE" --until "$UNTIL" --timestamps "$name" 2>&1 | gzip -9 > "$out"
  # Error lines, minus routine noise: health probes, expected 401s on locked functions,
  # Gatus logging passing checks ("success=true; errors=0"), access-log lines that
  # answered 2xx/3xx but mention "error" in the URL, clients hanging up mid-response,
  # and Supavisor's scheduler monitor (its messages carry "timeout:"). Those were ~95%
  # of the ~4,000 lines a day and buried the real ones.
  zcat "$out" | grep -iE "$ERR" \
    | grep -viE 'healthcheck|x-sync-secret|Unauthorized|401|success=true|" [23][0-9]{2} |connection reset by peer|broken pipe|ErlSysMon' \
    | sed "s/^/[$name] /" | cut -c1-400 >> "$DIGEST"
done

nginx_day=$(date -d yesterday +%Y/%m/%d)
sudo cat /var/log/nginx/error.log /var/log/nginx/error.log.1 2>/dev/null | grep "^$nginx_day" > "$ROOT/nginx/$DAY-error.log"
grep -vE 'open\(\) ".*" failed \(2: No such file' "$ROOT/nginx/$DAY-error.log" | sed 's/^/[nginx] /' | cut -c1-400 >> "$DIGEST"
echo "[nginx] missing files requested: $(grep -c 'No such file' "$ROOT/nginx/$DAY-error.log")" >> "$DIGEST"
gzip -9f "$ROOT/nginx/$DAY-error.log"

client_day=$(date -d yesterday +%F)
browser_errors=$(sudo cat /var/log/nginx/client-errors.log.1 /var/log/nginx/client-errors.log 2>/dev/null | grep -c "\"time\":\"$client_day" || true)
echo "[browser] error reports from visitors: $browser_errors (details: https://admin.sphpnp.com/client-errors.txt)" >> "$DIGEST"

sync_log="/var/log/sphpnp-sync/$DAY.log"
if [ -f "$sync_log" ]; then
  grep -E '\((000|4[0-9][0-9]|5[0-9][0-9])\)|FAILED|ROLLED BACK|three calls in a row failed' "$sync_log" \
    | sed 's/^/[jobs] /' | cut -c1-400 >> "$DIGEST"
fi

summary="$(date '+%F %T') logs-archive $DAY: $(wc -l < "$DIGEST") error lines, $(du -sh "$ROOT/containers/$DAY" | cut -f1) of container logs"
echo "$summary" >> "/var/log/sphpnp-sync/$(date +%F).log"

find "$ROOT/containers" -mindepth 1 -maxdepth 1 -type d -mtime +90 -exec rm -rf {} +
find "$ROOT/nginx" -name '*.gz' -mtime +90 -delete
find "$ROOT/errors" -name '*.log' -mtime +365 -delete
