-- 52-week range and current market cap / P/E for every traded NSE stock, so the
-- screener can grow past its 752-stock universe with complete rows.
--
-- nse_52wk: NSE's daily 52-week high/low report (CM_52_wk_High_low_<date>.csv),
-- fed by sync-bhavcopy. One row per security, replaced each day; adjusted for
-- bonuses, splits and rights by NSE.
create table if not exists nse_52wk (
  symbol          text    not null,
  series          text    not null,
  high_52         numeric not null,
  high_date       date,
  low_52          numeric not null,
  low_date        date,
  effective_date  date    not null,
  updated_at      timestamptz not null default now(),
  primary key (symbol, series)
);

alter table nse_52wk enable row level security;

drop policy if exists "Public can view 52-week ranges" on nse_52wk;
create policy "Public can view 52-week ranges"
  on nse_52wk for select
  using (true);

-- Writes come only from the service role (sync-bhavcopy).

-- stock_lite_metrics: the latest close for every equity in the bhavcopy, with
-- its 52-week range and market cap / P/E carried to that close.
--
-- Market cap and P/E come from the nightly screener.in pass (stock_profiles),
-- read at that page's own price, and scale with the price since: shares and
-- trailing EPS do not move day to day. The 52-week report can trail the
-- bhavcopy by a day, so the range is widened to include the latest close.
-- ponytail: a split or bonus between a screener.in visit and today mis-scales
-- market cap and P/E until the next visit (the pass revisits every ~3 nights);
-- carry shares outstanding explicitly if that window ever matters.
-- security_invoker: the reader's own RLS applies (all three tables are public-read).
create or replace view stock_lite_metrics with (security_invoker = true) as
select
  b.symbol,
  b.series,
  b.trade_date,
  b.close,
  b.prev_close,
  case when b.prev_close > 0 then round((b.close / b.prev_close - 1) * 100, 2) end as change_pct,
  b.ttl_trd_qty as volume,
  b.deliv_per,
  -- Blank when NSE's report has no row: greatest()/least() skip nulls and would
  -- otherwise report the close itself as both ends of the range.
  case when w.high_52 is not null then greatest(w.high_52, b.close) end as high_52,
  case when w.low_52  is not null then least(w.low_52, b.close)     end as low_52,
  w.effective_date             as range_as_of,
  case when r.mcap > 0 and r.price > 0 then round(r.mcap * b.close / r.price, 2) end as market_cap_cr,
  case when r.pe   > 0 and r.price > 0 then round(r.pe   * b.close / r.price, 2) end as pe,
  p.screener_fetched_at        as fundamentals_as_of
from bhavcopy_eod b
left join nse_52wk w on w.symbol = b.symbol and w.series = b.series
left join stock_profiles p on p.symbol = b.symbol
left join lateral (
  select
    nullif(p.screener -> 'top_ratios' ->> 'market_cap', '')::numeric as mcap,
    nullif(p.screener -> 'top_ratios' ->> 'price', '')::numeric      as price,
    nullif(p.screener -> 'top_ratios' ->> 'pe', '')::numeric         as pe
) r on true;

grant select on stock_lite_metrics to anon, authenticated;
