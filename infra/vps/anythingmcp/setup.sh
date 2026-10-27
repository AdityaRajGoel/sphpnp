#!/usr/bin/env bash
# Install or update AnythingMCP in /opt/sphpnp-anythingmcp and the read-only database
# role it uses. Safe to re-run: secrets and the role password are generated once.
#
#   bash infra/vps/anythingmcp/setup.sh
#
# Then register the first (admin) account in the UI and load the tools - README.md.
set -euo pipefail

DIR=/opt/sphpnp-anythingmcp
SRC=$(cd "$(dirname "$0")" && pwd)

sudo install -d -o "$(id -u)" -g "$(id -g)" -m 750 "$DIR" "$DIR/data"
install -m 644 "$SRC/docker-compose.yml" "$DIR/docker-compose.yml"
install -m 644 "$SRC/tools.json" "$DIR/tools.json"
install -m 755 "$SRC/connect.mjs" "$DIR/connect.mjs"

cd "$DIR"
touch .env && chmod 600 .env
for name in JWT_SECRET ENCRYPTION_KEY AMCP_DB_PASSWORD; do
  if ! grep -qE "^$name=.+" .env; then
    echo "$name=$(openssl rand -hex 32)" >> .env
    echo "generated $name in $DIR/.env"
  fi
done

# mcp_reader inherits anon: it reads exactly what www.sphpnp.com's public key already
# reads, through the same RLS policies, and nothing else (no leads, no profiles).
# default_transaction_read_only is fixed when each transaction starts, so not even a
# security-definer function anon may execute can write through this role (verified,
# including set_config attempts). AnythingMCP connects with its own 60 s
# statement_timeout, which overrides a role default; the connection limit is what bounds
# a burst of model-written queries. The password is passed as a psql variable through
# \gexec, never on a command line (see tools/setup.sh).
if ! grep -qE '^MCP_READER_PASSWORD=.+' .env; then
  pw=$(openssl rand -hex 24)
  docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=1 -q \
    -v pw="$pw" <<'SQL' || { echo "could not create the mcp_reader role" >&2; exit 1; }
select format('create role mcp_reader login password %L', :'pw')
where not exists (select 1 from pg_roles where rolname = 'mcp_reader') \gexec
select format('alter role mcp_reader login password %L', :'pw') \gexec
grant anon to mcp_reader;
grant connect on database postgres to mcp_reader;
alter role mcp_reader set default_transaction_read_only = on;
alter role mcp_reader connection limit 5;
SQL
  echo "MCP_READER_PASSWORD=$pw" >> .env
  echo "created the read-only mcp_reader role; its password is in $DIR/.env"
fi

docker compose pull -q
docker compose up -d
echo "AnythingMCP: UI http://127.0.0.1:8460, API http://127.0.0.1:8461 (SSH tunnel; see README.md)"
