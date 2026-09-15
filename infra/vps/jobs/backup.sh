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
fail() { log "FAILED: $*"; exit 1; }
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

if rclone listremotes 2>/dev/null | grep -qx 'offsite:'; then
  rclone copy "$OUT" "offsite:$STAMP" --transfers 2
  rclone delete offsite: --min-age "$OFFSITE_KEEP"
  rclone rmdirs offsite: --leave-root
  log "ok $STAMP ($size) - also copied off-server"
else
  log "ok $STAMP ($size) - local only (no offsite remote configured)"
fi
date '+%F %T' > "$DIR/last-success"
