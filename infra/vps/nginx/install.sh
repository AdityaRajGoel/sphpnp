#!/usr/bin/env bash
# Install an nginx site config onto this server, with the checks that a plain `install`
# does not do.
#
#   bash infra/vps/nginx/install.sh sphpnp-com.conf [more.conf ...]
#
# Why this exists: on 2026-09-16 the repo's HTTP-only copy of sphpnp-com.conf was
# installed over the live one, which carried the `listen 443 ssl` blocks certbot had
# added. www.sphpnp.com then had no server on 443, the catch-all's ssl_reject_handshake
# answered instead, and every visitor got a refused TLS handshake until certbot put the
# blocks back. Three rules follow from that:
#   1. never drop a listener the live file has,
#   2. always keep a copy of what was replaced,
#   3. never leave a failed `nginx -t` installed.
set -euo pipefail

SRC_DIR=$(cd "$(dirname "$0")" && pwd)
DEST_DIR=/etc/nginx/sites-available
BACKUP_DIR=/var/backups/nginx-configs
[ "$#" -gt 0 ] || { echo "usage: install.sh <file.conf> [...]" >&2; exit 1; }

sudo install -d -m 750 "$BACKUP_DIR"
stamp=$(date +%Y%m%d-%H%M%S)
restore=()

for name in "$@"; do
  src="$SRC_DIR/$name"
  dest="$DEST_DIR/$name"
  [ -f "$src" ] || { echo "no such file: $src" >&2; exit 1; }

  if [ -f "$dest" ]; then
    sudo cp -a "$dest" "$BACKUP_DIR/$name.$stamp"
    restore+=("$dest:$BACKUP_DIR/$name.$stamp")
    live_tls=$(grep -c "listen 443" "$dest" || true)
    new_tls=$(grep -c "listen 443" "$src" || true)
    if [ "$live_tls" -gt 0 ] && [ "$new_tls" -eq 0 ]; then
      echo "refusing to install $name: the live file has $live_tls 'listen 443' lines and this one has none." >&2
      echo "Those blocks are added by certbot. Copy the live file into the repo first:" >&2
      echo "  sudo cat $dest > /tmp/live.conf   # then update the repo copy from it" >&2
      exit 1
    fi
  fi
  sudo install -m 644 "$src" "$dest"
  echo "installed $name (backup: $BACKUP_DIR/$name.$stamp)"
done

if ! sudo nginx -t; then
  echo "nginx -t failed - restoring the previous config" >&2
  for pair in "${restore[@]}"; do sudo cp -a "${pair#*:}" "${pair%%:*}"; done
  sudo nginx -t >/dev/null && echo "restored" >&2
  exit 1
fi

sudo systemctl reload nginx
sleep 2
if sudo tail -20 /var/log/nginx/error.log | grep -q "\[emerg\]"; then
  echo "[emerg] in the error log after reload - check it before trusting this reload" >&2
  exit 1
fi
echo "reloaded; backups in $BACKUP_DIR"
