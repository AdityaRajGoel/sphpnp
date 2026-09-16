#!/usr/bin/env bash
# Nightly vulnerability scan of every running container image (Trivy, from its own
# container - nothing is installed on the host). Writes a report for the admin panel and
# alerts only on CRITICAL findings with a fix available, which is the actionable set.
#   /opt/sphpnp/jobs/image-scan.sh
set -uo pipefail

OUT=/var/www/admin/image-scan.txt
LOG="/var/log/sphpnp-sync/$(date +%F).log"
CACHE=/opt/sphpnp/trivy-cache
TRIVY_IMAGE=aquasec/trivy:latest
umask 022
mkdir -p "$CACHE"

images=$(docker ps --format '{{.Image}}' | sort -u)
tmp=$(mktemp); trap 'rm -f "$tmp"' EXIT

{
  echo "Container image scan - $(date '+%F %T')"
  echo "Severity shown: HIGH and CRITICAL, only where a fixed version exists."
  echo
} > "$tmp"

critical=0
for image in $images; do
  # --ignore-unfixed keeps the report to things we can actually act on by upgrading.
  report=$(docker run --rm -v /var/run/docker.sock:/var/run/docker.sock:ro -v "$CACHE:/root/.cache" \
    "$TRIVY_IMAGE" image --quiet --scanners vuln --ignore-unfixed \
    --severity HIGH,CRITICAL --format table "$image" 2>&1)
  count=$(printf '%s' "$report" | grep -cE '\|\s+(HIGH|CRITICAL)\s+\|' || true)
  crit=$(printf '%s' "$report" | grep -cE '\|\s+CRITICAL\s+\|' || true)
  critical=$((critical + crit))
  printf '== %s: %s findings (%s critical)\n' "$image" "$count" "$crit" >> "$tmp"
  [ "$count" -gt 0 ] && printf '%s\n\n' "$report" >> "$tmp"
done

mv "$tmp" "$OUT" && trap - EXIT
chmod 644 "$OUT"
echo "$(date '+%F %T') image-scan images=$(printf '%s\n' "$images" | wc -l) critical=$critical (report: $OUT)" >> "$LOG"

if [ "$critical" -gt 0 ] && [ -f /opt/sphpnp-tools/.env ]; then
  topic=$(grep -m1 '^NTFY_TOPIC=' /opt/sphpnp-tools/.env | cut -d= -f2-)
  [ -n "$topic" ] && curl -s -m 15 -H "Title: Container images need an upgrade" \
    -d "$critical critical, fixable vulnerabilities - https://admin.sphpnp.com/image-scan.txt" \
    "http://127.0.0.1:3005/$topic" > /dev/null
fi
