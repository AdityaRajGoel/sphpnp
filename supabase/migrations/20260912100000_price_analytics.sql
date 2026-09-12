-- Risk, trend and participation measures derived from the daily bars already
-- collected in eq_eod. Written by sync-price-analytics; see
-- supabase/functions/_shared/price-analytics.ts for what each column means and
-- the minimum window each one needs before it is anything but null.
--
-- KEYED ON (symbol, as_of), NOT symbol ALONE. One row per symbol would be
-- cheaper and is all today's screener needs, but the history is what makes
-- half of these measures interpretable later: "34% volatility" says little
-- until you can see it was 19% for the six months before. The row count is
-- modest - the tracked universe is ~250 symbols, so a year of daily rows is
-- ~60k - and the latest-row view below keeps the common read simple.
--
-- Every measure column is nullable ON PURPOSE and none has a default. A symbol
-- with four months of bars genuinely has no 52-week position and no one-year
-- return; a zero there would be a false statement rather than a missing one,
-- and the sync writes null in exactly the cases the computation refuses.
create table if not exists public.stock_price_analytics (
  symbol      text not null,
  -- The trade_date of the last bar the row was computed from, not the day the
  -- job ran: a Sunday run and the Friday run before it describe the same
  -- market, and keying on the run date would store that twice.
  as_of       date not null,
  observations    integer not null,
  -- How many splits/bonuses were back-applied to the window. A non-zero value
  -- means the stored closes and the numbers here deliberately disagree.
  actions_applied integer not null default 0,
  benchmark   text,

  volatility_1y          numeric,
  downside_volatility_1y numeric,
  var_95                 numeric,
  cvar_95                numeric,
  max_drawdown_1y        numeric,
  drawdown_from_peak     numeric,
  beta_1y                numeric,
  correlation_1y         numeric,
  atr_pct_14             numeric,
  rsi_14                 numeric,
  return_1m              numeric,
  return_3m              numeric,
  return_6m              numeric,
  return_1y              numeric,
  week52_high            numeric,
  week52_low             numeric,
  week52_position        numeric,
  volume_zscore          numeric,
  delivery_recent        numeric,
  delivery_change        numeric,

  -- Trend and momentum, from the same adjusted bars in the same pass (see
  -- _shared/technical-indicators.ts). Stored alongside rather than in their own
  -- table because they share every input and are always read together.
  sma_20             numeric,
  sma_50             numeric,
  sma_200            numeric,
  distance_from_200  numeric,
  -- 'golden' when the 50-day is above the 200-day, 'death' when below. The
  -- state, not the crossing event.
  ma_trend           text check (ma_trend in ('golden', 'death')),
  macd               numeric,
  macd_signal        numeric,
  macd_histogram     numeric,
  bollinger_upper    numeric,
  bollinger_lower    numeric,
  bollinger_percent_b numeric,
  bollinger_bandwidth numeric,
  stochastic_k       numeric,
  stochastic_d       numeric,
  adx                numeric,
  plus_di            numeric,
  minus_di           numeric,
  obv_trend_20       numeric,
  money_flow_index   numeric,
  -- The day's true volume-weighted average price, from the bhavcopy's own
  -- turnover figure rather than the (H+L+C)/3 approximation every daily-bar
  -- library falls back on.
  vwap               numeric,
  close_vs_vwap      numeric,
  relative_strength_3m numeric,

  computed_at timestamptz not null default now(),
  primary key (symbol, as_of)
);

create index if not exists stock_price_analytics_symbol_idx
  on public.stock_price_analytics (symbol, as_of desc);

-- The screener sorts the whole universe by one measure, which means "the newest
-- row per symbol" - a distinct-on the UI should not have to spell out itself.
--
-- security_invoker is not optional here: a Postgres view runs with its
-- creator's rights by default, which would read the base table straight past
-- the row-level policy below. With it on, the view is exactly as visible as
-- what it selects from.
create or replace view public.stock_price_analytics_latest
  with (security_invoker = true) as
  select distinct on (symbol) *
  from public.stock_price_analytics
  order by symbol, as_of desc;

alter table public.stock_price_analytics enable row level security;

-- Readable by anyone, like every other market table in this schema: these are
-- measures computed from published exchange data, not customer data.
create policy "Anyone can view price analytics"
  on public.stock_price_analytics for select
  to anon, authenticated
  using (true);

-- Writes are service-role only (sync-price-analytics). No insert/update policy
-- for anon/authenticated is intentional, matching every other sync-fed table.
