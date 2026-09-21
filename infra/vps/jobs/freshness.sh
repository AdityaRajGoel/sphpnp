#!/usr/bin/env bash
# Hourly: is every dataset still moving? Every failure found in September 2026
# (NSE results frozen since Dec 2024, insider trades since April, MoSPI since
# Dec 2025, the pledge feed empty, the IPO browser down five days) had a sync
# reporting "ok" while its data stood still. This checks the data, not the job.
#
# Two kinds of date per dataset where it matters:
#   content - the newest thing the source published (catches upstream freezes)
#   fetched - the last time our sync wrote a row (catches our own job failing)
#
# Report: /var/www/admin/freshness.txt. A dataset newly stale sends one ntfy
# alert; it is not repeated until the dataset recovers and goes stale again.
set -uo pipefail

OUT=/var/www/admin/freshness.txt
STATE=/var/lib/sphpnp/freshness.stale
mkdir -p "$(dirname "$STATE")"; touch "$STATE"

# name | SQL returning the newest date | allowed age in days
CHECKS=$(cat <<'EOF'
Equity EOD bars (NSE/BSE)|select max(trade_date) from eq_eod|4
Index valuations (NSE)|select max(trade_date) from index_valuation_daily|4
Option chain EOD|select max(trade_date) from option_chain_eod|4
Bulk/block deals|select max(trade_date) from deal_history|6
FPI flows (NSDL)|select max(report_date) from fpi_daily|6
Global markets|select max(trade_date) from global_markets_daily|4
Live quotes (screener)|select max(updated_at) from screener_stocks|3
Oldest quote - a delisted or renamed stock|select min(updated_at) from screener_stocks|6
IPO GMP snapshots|select max(captured_at) from ipo_gmp_snapshots|3
IPO catalogue sync|select max(updated_at) from ipos|3
NSE announcements|select max(published_at) from nse_announcements|4
BSE announcements|select max(published_at) from bse_announcements|4
Insider trades - newest disclosure|select max(disclosed_at) from nse_insider_trades|21
Insider trades - sync|select max(fetched_at) from nse_insider_trades|3
Shareholding filings - sync|select max(fetched_at) from nse_shareholding_filings|3
Promoter pledge (shareholding XBRL)|select max(quarter_end) from nse_shareholding_filings where promoter_pledged_pct is not null|140
NSE pledge feed - sync|select max(fetched_at) from pledge_snapshots|3
Quarterly results - newest filing|select max(filing_date) from fundamentals_filings|110
Income statements - sync|select max(fetched_at) from fundamentals_income|3
Fundamental scores|select max(computed_at) from stock_fundamental_scores|3
Price analytics|select max(computed_at) from stock_price_analytics|4
Surveillance flags (ASM/GSM)|select max(as_of) from surveillance_flags|5
Corporate actions|select max(fetched_at) from fundamentals_corporate_actions|3
SEBI actions|select max(fetched_at) from sebi_actions|3
Market snapshots|select max(fetched_at) from market_snapshots|4
FX rates|select max(rate_date) from fx_rates|5
CPI (MoSPI)|select max(period) from macro_monthly where series like 'CPI%'|75
IIP (MoSPI)|select max(period) from macro_monthly where series like 'IIP%'|100
WPI (MoSPI)|select max(period) from macro_monthly where series like 'WPI%'|60
Stock profiles (screener.in)|select max(screener_fetched_at) from stock_profiles|3
Stock profiles (Tickertape)|select max(tickertape_fetched_at) from stock_profiles|3
EOF
)

now=$(date +%s)
report="" stale_now=""
while IFS='|' read -r name sql max; do
  [ -z "$name" ] && continue
  newest=$(docker exec supabase-db psql -U postgres -d postgres -tAc "$sql" 2>/dev/null | head -1)
  if [ -z "$newest" ]; then
    age="?" status="NO DATA"
  else
    age=$(( (now - $(date -d "$newest" +%s)) / 86400 ))
    status=$([ "$age" -le "$max" ] && echo ok || echo STALE)
  fi
  [ "$status" != ok ] && stale_now+="$name"$'\n'
  report+=$(printf '%-8s %-38s newest %-26s %4s days old (allowed %s)' "$status" "$name" "${newest:-none}" "$age" "$max")$'\n'
done <<< "$CHECKS"

{
  echo "Data freshness - $(date '+%F %T')"
  echo "Each dataset's newest date against how old it is allowed to get."
  echo
  printf '%s' "$report" | sort
} > "$OUT.tmp" && mv "$OUT.tmp" "$OUT" && chmod 644 "$OUT"

# Alert once per newly stale dataset.
new=$(comm -13 <(sort -u "$STATE") <(printf '%s' "$stale_now" | sort -u) | grep -v '^$' || true)
printf '%s' "$stale_now" | sort -u > "$STATE"
if [ -n "$new" ] && [ -f /opt/sphpnp-tools/.env ]; then
  topic=$(grep -m1 '^NTFY_TOPIC=' /opt/sphpnp-tools/.env | cut -d= -f2-)
  [ -n "$topic" ] && curl -s -m 15 -H "Title: Data stopped updating" \
    -d "$(printf '%s\n' "$new" | head -8) - https://admin.sphpnp.com/freshness.txt" \
    "http://127.0.0.1:3005/$topic" > /dev/null
fi
echo "$(date '+%F %T') freshness stale=$(printf '%s' "$stale_now" | grep -c . || true)" >> "/var/log/sphpnp-sync/$(date +%F).log"
