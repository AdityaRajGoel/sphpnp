#!/usr/bin/env bash
# The page watcher's watch list (changedetection.io, https://admin.sphpnp.com:8449).
# Replaces whatever is there with the list below; alerts go to the ntfy topic every
# other job uses. Run on the server:  bash /opt/sphpnp-tools/changedetection-watches.sh
#
# Only pages a plain fetch can read are here: NSE's circulars list is drawn by script
# (a fetch sees the menus only), MCX answers 403, CDSL and NSDL moved their lists.
set -euo pipefail

DATA=/opt/sphpnp-tools/data/changedetection/changedetection.json
API=http://127.0.0.1:3008/api/v1
KEY=$(sudo python3 -c "import json; print(json.load(open('$DATA'))['settings']['application']['api_access_token'])")
TOPIC=$(grep -E '^NTFY_TOPIC=' /opt/sphpnp-tools/.env | cut -d= -f2-)
[ -n "$KEY" ] && [ -n "$TOPIC" ] || { echo "API key or NTFY_TOPIC missing" >&2; exit 1; }
NOTIFY="ntfy://ntfy:80/$TOPIC"   # same compose network as ntfy

api() { curl -sf -H "x-api-key: $KEY" -H "Content-Type: application/json" "$@"; }

# Start clean: remove every existing watch (the install shipped two demo ones).
for uuid in $(api "$API/watch" | python3 -c "import json,sys; print(' '.join(json.load(sys.stdin)))"); do
  api -X DELETE "$API/watch/$uuid" >/dev/null
done

# title | url | hours between checks | CSS filter: the list itself, not menus and
# tickers; for IPO Watch only the header row, so GMP moves do not alert, a new layout does.
while IFS='|' read -r title url hours filter; do
  [ -z "$title" ] && continue
  body=$(TITLE="$title" URL="$url" HOURS="$hours" FILTER="$filter" NOTIFY="$NOTIFY" python3 -c '
import json, os
w = {"title": os.environ["TITLE"], "url": os.environ["URL"],
     "time_between_check": {"hours": int(os.environ["HOURS"])},
     "notification_urls": [os.environ["NOTIFY"]],
     "notification_title": "Page changed: {{watch_title}}",
     "notification_body": "{{watch_url}}\n\n{{diff_added}}"}
if os.environ["FILTER"]:
    w["include_filters"] = [os.environ["FILTER"]]
print(json.dumps(w))')
  api -X POST "$API/watch" -d "$body" >/dev/null && echo "added: $title"
done <<'EOF'
SEBI circulars|https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=1&ssid=7&smid=0|6|#sample_1
RBI press releases|https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx|6|table.tablebg
RBI circulars|https://www.rbi.org.in/Scripts/BS_CircularIndexDisplay.aspx|12|table.tablebg
IPO Watch GMP table layout (sync-ipos parses it)|https://ipowatch.in/ipo-grey-market-premium-latest-ipo-gmp/|6|table thead
EOF

api "$API/watch" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d), 'watches')"
