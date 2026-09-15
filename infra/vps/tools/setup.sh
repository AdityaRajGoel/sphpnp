#!/usr/bin/env bash
# Install or update the ops tools in /opt/sphpnp-tools. Safe to re-run: secrets are
# generated once and kept in .env (mode 600); images are pulled and containers
# recreated only when something changed.
#   bash infra/vps/tools/setup.sh
set -euo pipefail

DIR=/opt/sphpnp-tools
SRC=$(cd "$(dirname "$0")" && pwd)

sudo install -d -o "$(id -u)" -g "$(id -g)" -m 750 "$DIR" "$DIR/data"
install -m 644 "$SRC/docker-compose.yml" "$DIR/docker-compose.yml"
install -m 644 "$SRC/init-db.sql" "$DIR/init-db.sql"

cd "$DIR"
if [ ! -f .env ]; then
  umask 077
  {
    echo "TOOLS_DB_PASSWORD=$(openssl rand -hex 24)"
    echo "UMAMI_APP_SECRET=$(openssl rand -hex 32)"
    echo "GLITCHTIP_SECRET_KEY=$(openssl rand -hex 32)"
    echo "BESZEL_AGENT_KEY="
  } > .env
  echo "generated $DIR/.env"
fi
chmod 600 .env

docker compose pull --quiet
docker compose up -d db valkey
docker compose run --rm glitchtip-migrate >/dev/null
docker compose up -d umami glitchtip-web glitchtip-worker uptime-kuma beszel

if grep -qE '^BESZEL_AGENT_KEY=.+' .env; then
  docker compose --profile agent up -d beszel-agent
else
  echo "beszel-agent not started: add the hub's public key as BESZEL_AGENT_KEY in $DIR/.env and re-run"
fi

docker compose ps --format '{{.Service}}: {{.Status}}'
