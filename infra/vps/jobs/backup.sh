#!/usr/bin/env bash
# Daily backup of the self-hosted stack -> /var/backups/sphpnp/<date-time>/
#   roles.sql         database roles (pg_dumpall --roles-only)
#   postgres.dump     the whole database, every schema (auth, storage, public...)
#   storage.tar.gz    uploaded files (banners, stock logos)
#   config.tar.gz     .env, functions.env, compose override, nginx, cron (holds secrets)
#   SHA256SUMS
# Seven days are kept on the server. When an rclone remote named "offsite" exists
# (an encrypted crypt remote over Backblaze B2), each backup is also copied there
# and kept for 30 days.
set -euo pipefail

DIR=/var/backups/sphpnp
KEEP_DAYS=7
OFFSITE_KEEP=30d
STAMP=$(date +%F-%H%M)
OUT="$DIR/$STAMP"
LOG="/var/log/sphpnp-sync/$(date +%F).log"

log() { printf '%s backup %s\n' "$(date '+%F %T')" "$*" >> "$LOG"; }
# Optional dead-man's switch for the backup itself (Healthchecks.io): ping on success,
# /fail on failure, so a backup that stops - or starts failing - raises an alert.
HC_URL=$(head -1 /opt/sphpnp/heartbeat-backup.url 2>/dev/null | tr -d '[:space:]')
# ${1:-}: the success ping passes no argument, and under set -u a bare $1 aborted
# the script on its last line - the ping never went out (Healthchecks DOWN, 5 Oct 2026).
hc() { [ -n "$HC_URL" ] && curl -fsS -m 10 --retry 3 -o /dev/null "$HC_URL${1:-}" || true; }
fail() { log "FAILED: $*"; hc /fail; exit 1; }
trap 'fail "line $LINENO"' ERR

umask 077
mkdir -p "$OUT" /var/log/sphpnp-sync

docker exec supabase-db pg_dumpall -U postgres --roles-only > "$OUT/roles.sql"
docker exec supabase-db pg_dump -U postgres -d postgres -Fc -Z 6 > "$OUT/postgres.dump"
# A dump that pg_restore cannot list is not a backup.
docker exec -i supabase-db pg_restore --list < "$OUT/postgres.dump" > /dev/null

sudo tar -C /opt/supabase/volumes -czf "$OUT/storage.tar.gz" storage
sudo tar -czf "$OUT/config.tar.gz" \
  /opt/supabase/.env /opt/supabase/functions.env /opt/supabase/docker-compose.override.yml \
  /etc/nginx/sites-available /etc/nginx/snippets /etc/cron.d/sphpnp-sync 2>/dev/null
sudo chown -R "$(id -u):$(id -g)" "$OUT"

(cd "$OUT" && sha256sum -- * > SHA256SUMS)
size=$(du -sh "$OUT" | cut -f1)

find "$DIR" -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP_DAYS" -exec rm -rf {} +

# R2's API token is IP-filtered to this server's IPv4 address; without this rclone
# reaches R2 over IPv6 and is refused (403, 3 Oct 2026).
export RCLONE_BIND=0.0.0.0
if rclone listremotes 2>/dev/null | grep -qx 'offsite:'; then
  rclone copy "$OUT" "offsite:$STAMP" --transfers 2
  rclone delete offsite: --min-age "$OFFSITE_KEEP"
  rclone rmdirs offsite: --leave-root
  log "ok $STAMP ($size) - also copied off-server"
else
  log "ok $STAMP ($size) - local only (no offsite remote configured)"
fi
date '+%F %T' > "$DIR/last-success"
hc
