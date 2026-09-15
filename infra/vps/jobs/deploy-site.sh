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

# Every page's canonical must be its own URL. A build once shipped 247 pages whose
# canonical pointed at the homepage, which tells Google to drop them as duplicates.
wrong=0
while IFS= read -r -d '' f; do
  rel=${f#"$DIST"}; rel=${rel%.html}
  case "$rel" in /404|/ipo-shell|/google*|/yandex*) continue ;; /index) rel=/ ;; esac
  got=$(sed -n '1,/<\/head>/p' "$f" | grep -oE '<link[^>]*rel="canonical"[^>]*>' | head -1 | grep -oE 'href="[^"]*"' | cut -d'"' -f2)
  # Symbols such as M&M are URL-encoded in the canonical (M%26M); compare decoded.
  got=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.unquote(sys.argv[1]).replace("&amp;", "&"))' "$got")
  if [ "$got" != "https://www.sphpnp.com$rel" ]; then
    wrong=$((wrong + 1)); [ "$wrong" -le 5 ] && echo "canonical mismatch: $rel -> ${got:-<none>}" >&2
  fi
done < <(find "$DIST" -name '*.html' -print0)
[ "$wrong" -eq 0 ] || { echo "$wrong pages have a missing or foreign canonical - not deploying" >&2; exit 1; }

cp -a "$DIST" "$REL"

# Keep the previous release's hashed chunks. A visitor still holding the old HTML
# (browser cache, the PWA service worker, or a tab left open) lazy-loads chunks by
# their old hashed names; without these they 404 and parts of the page never load.
# Names are content hashes, so nothing in the new build is overwritten (-n).
prev=$(readlink -f "$ROOT/current" 2>/dev/null || true)
if [ -n "$prev" ] && [ -d "$prev/assets" ]; then
  cp -a --update=none "$prev/assets/." "$REL/assets/"
fi

# Precompress once here so nginx serves .br/.gz files (brotli_static, gzip_static)
# instead of compressing the same 600 KB homepage on every request.
find "$REL" -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.xml' \
  -o -name '*.svg' -o -name '*.json' -o -name '*.txt' -o -name '*.webmanifest' \) -size +1k -print0 \
  | xargs -0 -P 4 -I{} sh -c 'gzip -9 -k -f -- "$1" && { command -v brotli >/dev/null && brotli -q 11 -k -f -- "$1" || true; }' _ {}

chmod -R a+rX "$REL"
ln -sfn "$REL" "$ROOT/current.new" && mv -T "$ROOT/current.new" "$ROOT/current"

ls -1dt "$ROOT"/releases/* | tail -n +$((KEEP + 1)) | xargs -r rm -rf
echo "$SITE now serves $STAMP ($pages pages)"
