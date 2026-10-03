#!/usr/bin/env bash
# Dead-man's switch for an outside monitor (Healthchecks.io, or UptimeRobot's heartbeat
# monitor): every 5 minutes, check the site and the API from here, then ping the
# monitor's URL. If this server, its network or cron stops, the pings stop and the
# monitor alerts you - which nothing running on this machine can do for itself.
# The URL lives in /opt/sphpnp/heartbeat.url (one line); without it this is a no-op.
set -uo pipefail
URL_FILE=/opt/sphpnp/heartbeat.url
[ -s "$URL_FILE" ] || exit 0
URL=$(head -1 "$URL_FILE" | tr -d '[:space:]')

site=$(curl -s -o /dev/null -m 15 -w '%{http_code}' https://www.sphpnp.com/)
api=$(curl -s -o /dev/null -m 15 -w '%{http_code}' -X POST https://api.sphpnp.com/functions/v1/fetch-ipos)
if [ "$site" = 200 ] && [ "$api" = 200 ]; then
  curl -fsS -m 10 --retry 3 -o /dev/null "$URL"
else
  # Healthchecks.io's /fail marks the check down at once, with the reason as the body.
  curl -fsS -m 10 --retry 3 -o /dev/null --data-raw "site=$site api=$api" "$URL/fail"
fi
