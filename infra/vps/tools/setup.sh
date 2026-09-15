#!/usr/bin/env bash
# Install or update the ops tools in /opt/sphpnp-tools (Gatus, ntfy, Glances).
# Safe to re-run. The ntfy topic is generated once into .env (mode 600).
#   bash infra/vps/tools/setup.sh
set -euo pipefail

DIR=/opt/sphpnp-tools
SRC=$(cd "$(dirname "$0")" && pwd)

sudo install -d -o "$(id -u)" -g "$(id -g)" -m 750 "$DIR" "$DIR/data" "$DIR/data/gatus" "$DIR/data/ntfy"
install -m 644 "$SRC/docker-compose.yml" "$DIR/docker-compose.yml"
install -m 644 "$SRC/gatus.yaml" "$DIR/gatus.yaml"

cd "$DIR"
touch .env && chmod 600 .env
if ! grep -qE '^NTFY_TOPIC=.+' .env; then
  echo "NTFY_TOPIC=sphpnp-alerts-$(openssl rand -hex 16)" >> .env
  echo "generated a private ntfy topic in $DIR/.env"
fi

docker compose pull --quiet
# --remove-orphans also removes tools that are no longer in the compose file.
docker compose up -d --remove-orphans
docker compose ps --format '{{.Service}}: {{.Status}}'
