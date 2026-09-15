#!/usr/bin/env bash
# Publish a finished build (/opt/sphpnp/app/dist) as the live site.
#   deploy-site.sh [sphpnp|staging]     default: sphpnp (www.sphpnp.com)
# Copies dist/ to /var/www/<site>/releases/<stamp>, refuses a build that is
# missing pages, then swaps the `current` symlink atomically. The last five
# releases stay for rollback:  ln -sfn <older release> /var/www/<site>/current
set -euo pipefail

SITE=${1:-sphpnp}
DIST=/opt/sphpnp/app/dist
ROOT=/var/www/$SITE
KEEP=5
MIN_PAGES=300
STAMP=$(date +%Y%m%d-%H%M%S)
REL="$ROOT/releases/$STAMP"

[ -d "$ROOT/releases" ] || { echo "no $ROOT/releases - is nginx set up for $SITE?" >&2; exit 1; }
for f in index.html 404.html ipo-shell.html sitemap.xml robots.txt; do
  [ -s "$DIST/$f" ] || { echo "build is missing $f - not deploying" >&2; exit 1; }
done
pages=$(find "$DIST" -name '*.html' | wc -l)
[ "$pages" -ge "$MIN_PAGES" ] || { echo "only $pages pages prerendered (need $MIN_PAGES) - not deploying" >&2; exit 1; }
grep -q '<loc>https://www.sphpnp.com/stock/' "$DIST/sitemap.xml" || { echo "sitemap lists no stock pages - not deploying" >&2; exit 1; }

cp -a "$DIST" "$REL"
chmod -R a+rX "$REL"
ln -sfn "$REL" "$ROOT/current.new" && mv -T "$ROOT/current.new" "$ROOT/current"

ls -1dt "$ROOT"/releases/* | tail -n +$((KEEP + 1)) | xargs -r rm -rf
echo "$SITE now serves $STAMP ($pages pages)"
