#!/usr/bin/env bash
# Nightly broken-link check over the sitemap (lychee, run from its own container so
# nothing is installed on the host). Writes a report for the admin panel and appends a
# one-line summary to the day's sync log; alerts only when something is actually broken.
#   /opt/sphpnp/jobs/link-check.sh
set -uo pipefail

OUT=/var/www/admin/link-check.txt
LOG="/var/log/sphpnp-sync/$(date +%F).log"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
umask 022

# --max-concurrency keeps the site (and our own rate limits) comfortable; the VPS's own
# address is exempt from them anyway. Mail and tel links are not HTTP.
# Flags kept to the ones this lychee build accepts; the report format follows the .md
# output extension. Mail links are excluded by default.
docker run --rm --network host -v "$TMP:/out" lycheeverse/lychee:latest \
  --no-progress --max-concurrency 8 --timeout 20 --max-retries 2 \
  --output /out/report.md \
  https://www.sphpnp.com/sitemap.xml > "$TMP/run.log" 2>&1
rc=$?

{
  echo "Broken link check - $(date '+%F %T')"
  echo
  if [ -s "$TMP/report.md" ]; then cat "$TMP/report.md"; else tail -30 "$TMP/run.log"; fi
} > "$OUT.tmp" && mv "$OUT.tmp" "$OUT"

broken=$(grep -cE '^\s*\[[0-9]{3}\]' "$TMP/report.md" 2>/dev/null || echo 0)
echo "$(date '+%F %T') link-check exit=$rc broken=$broken (report: $OUT)" >> "$LOG"

# Only shout when links are actually broken; lychee exits 2 for that.
if [ "$rc" = "2" ] && [ -f /opt/sphpnp-tools/.env ]; then
  topic=$(grep -m1 '^NTFY_TOPIC=' /opt/sphpnp-tools/.env | cut -d= -f2-)
  [ -n "$topic" ] && curl -s -m 15 -H "Title: Broken links on sphpnp.com" \
    -d "$broken broken links - https://admin.sphpnp.com/link-check.txt" \
    "http://127.0.0.1:3005/$topic" > /dev/null
fi
