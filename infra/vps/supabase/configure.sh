#!/usr/bin/env bash
# Configure the self-hosted Supabase stack in /opt/supabase. Safe to re-run:
# secrets are generated only once; URLs and settings are (re)applied every time.
set -euo pipefail
cd /opt/supabase

API_DOMAIN="api.sphpnp.com"
SITE_DOMAIN="staging.sphpnp.com"

[ -f .env ] || cp .env.example .env
chmod 600 .env

# Secrets (JWT secret, anon/service keys, Postgres and dashboard passwords):
# generating twice would invalidate every key and the database password.
if [ ! -f .secrets-generated ]; then
  sh utils/generate-keys.sh --update-env >/dev/null
  touch .secrets-generated
fi

setenv() {
  if grep -q "^$1=" .env; then
    sed -i "s|^$1=.*|$1=$2|" .env
  else
    echo "$1=$2" >> .env
  fi
}

setenv COMPOSE_FILE "docker-compose.yml:docker-compose.override.yml"
setenv SUPABASE_PUBLIC_URL "https://$API_DOMAIN"
setenv API_EXTERNAL_URL "https://$API_DOMAIN/auth/v1"
setenv SITE_URL "https://www.sphpnp.com"
setenv ADDITIONAL_REDIRECT_URLS "https://www.sphpnp.com/**,https://sphpnp.com/**,https://$SITE_DOMAIN/**"
setenv PGRST_DB_SCHEMAS "public,graphql_public"
# The site only signs in by email. Phone signup was on with auto-confirm, so anyone
# could create a signed-in account without any verification.
setenv ENABLE_PHONE_SIGNUP "false"
setenv ENABLE_PHONE_AUTOCONFIRM "false"

# Functions secrets file must exist for compose to start; keys are added separately.
[ -f functions.env ] || install -m 600 /dev/null functions.env

# Upstream's edge router kills every worker after 60 s at 150 MB. The sync functions are
# written for hosted limits (150 s+) and the cron runner waits up to 300 s, so match that.
MAIN=volumes/functions/main/index.ts
sed -i -E 's|const workerTimeoutMs = .*|const workerTimeoutMs = 5 * 60 * 1000|; s|const memoryLimitMb = .*|const memoryLimitMb = 256|' "$MAIN"
grep -E 'const (workerTimeoutMs|memoryLimitMb) =' "$MAIN"

echo "configured: public URL https://$API_DOMAIN, site https://$SITE_DOMAIN"
grep -E '^(COMPOSE_FILE|SUPABASE_PUBLIC_URL|API_EXTERNAL_URL|SITE_URL)=' .env
