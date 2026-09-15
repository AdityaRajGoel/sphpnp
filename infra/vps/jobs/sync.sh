#!/usr/bin/env bash
# Runs a sync edge function on the VPS stack, the way the GitHub workflows did.
#
#   sync.sh once   <fn> [json-body] [max-seconds]   2 attempts, 45s apart
#   sync.sh repeat <fn> <calls> [max-seconds]       N sequential calls, each must succeed
#   sync.sh loop   <fn> <max-calls> [max-seconds]   until the pass wraps (.wrapped), a 429, or 3 failures
#   sync.sh market-data                              every daily dataset of sync-market-data
#   sync.sh market-backfill                          walk sync-market-data histories back
#
# Calls go to the local gateway (127.0.0.1:8000); nothing leaves the server except
# what the function itself fetches. Logs: /var/log/sphpnp-sync/YYYY-MM-DD.log
set -uo pipefail

ANON=$(grep '^ANON_KEY=' /opt/supabase/.env | cut -d= -f2-)
SECRET=$(grep '^SYNC_SECRET=' /opt/supabase/functions.env | cut -d= -f2-)
BASE="http://127.0.0.1:8000/functions/v1"
LOG_DIR=/var/log/sphpnp-sync
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/$(date +%F).log"

log() { printf '%s %s\n' "$(date '+%F %T')" "$*" | cut -c1-900 >> "$LOG"; }

CODE="" BODY=""
call() { # fn body max-seconds
  local resp
  # The secret header is read from a file descriptor, so it never shows in `ps`.
  resp=$(curl -sS -w $'\n%{http_code}' --max-time "$3" -X POST "$BASE/$1" \
    -H "Authorization: Bearer $ANON" -H @<(printf 'x-sync-secret: %s\n' "$SECRET") \
    -H "Content-Type: application/json" -d "$2" 2>&1 || true)
  BODY=$(printf '%s' "$resp" | sed '$d')
  CODE=$(printf '%s' "$resp" | tail -n1)
}

mode=${1:?mode}
case "$mode" in
  once)
    fn=${2:?fn}; body=${3:-'{}'}; max=${4:-170}
    for attempt in 1 2; do
      call "$fn" "$body" "$max"
      log "$fn attempt $attempt ($CODE): $BODY"
      [ "$CODE" = "200" ] && exit 0
      [ "$attempt" = 1 ] && sleep 45
    done
    exit 1 ;;

  repeat)
    fn=${2:?fn}; calls=${3:?calls}; max=${4:-300}
    for i in $(seq 1 "$calls"); do
      call "$fn" '{}' "$max"
      log "$fn call $i/$calls ($CODE): $BODY"
      [ "$CODE" = "200" ] || exit 1
    done ;;

  loop)
    fn=${2:?fn}; calls=${3:?max-calls}; max=${4:-170}; fails=0
    for i in $(seq 1 "$calls"); do
      call "$fn" '{}' "$max"
      log "$fn call $i ($CODE): $BODY"
      if [ "$CODE" = "429" ]; then log "$fn rate-limited; cursor resumes next run"; exit 0; fi
      if [ "$CODE" != "200" ]; then
        fails=$((fails + 1)); [ "$fails" -ge 3 ] && { log "$fn: three calls in a row failed"; exit 1; }
        sleep 20; continue
      fi
      fails=0
      [ "$(printf '%s' "$BODY" | jq -r '.wrapped // false' 2>/dev/null)" = "true" ] && exit 0
    done
    log "$fn: $calls calls without completing a pass" ;;

  market-data)
    failed=0
    for ds in index_valuation participant_oi option_chain fo_bhavcopy eq_eod pledges deals nse_ipos fpi fpi_sectors week52 movers constituents surveillance lot_sizes calendar; do
      call sync-market-data "{\"dataset\":\"$ds\"}" 170
      log "sync-market-data $ds ($CODE): $BODY"
      [ "$CODE" = "200" ] || failed=$((failed + 1))
      sleep 3
    done
    [ "$failed" -le 4 ] || exit 1 ;;

  market-backfill)
    # Walks each history back from its cursor until `wrapped`; costs nothing once complete.
    for ds in index_valuation participant_oi eq_eod; do
      fails=0
      for i in $(seq 1 25); do
        call sync-market-data "{\"dataset\":\"$ds\",\"backfill\":true}" 170
        log "sync-market-data $ds backfill $i ($CODE): $BODY"
        if [ "$CODE" != "200" ]; then
          fails=$((fails + 1)); [ "$fails" -ge 3 ] && break; sleep 20; continue
        fi
        fails=0
        [ "$(printf '%s' "$BODY" | jq -r '.wrapped // false' 2>/dev/null)" = "true" ] && break
      done
    done
    for ds in deals fpi_sectors; do
      call sync-market-data "{\"dataset\":\"$ds\",\"backfill\":true}" 170
      log "sync-market-data $ds backfill ($CODE): $BODY"
    done ;;

  *) echo "unknown mode: $mode" >&2; exit 2 ;;
esac
