-- Market data from NSE, BSE, niftyindices, NSDL and MoSPI (2026-09-11), written
-- by sync-market-data (and the MoSPI collector in GitHub Actions). Every table
-- is keyed so a re-run upserts rather than duplicates; history accumulates.

create table if not exists public.index_valuation_daily (
  index_name text not null,
  trade_date date not null,
  open numeric, high numeric, low numeric, close numeric,
  change_pct numeric, volume numeric, turnover_cr numeric,
  pe numeric, pb numeric, div_yield numeric,
  primary key (index_name, trade_date)
);
create index if not exists index_valuation_date_idx on public.index_valuation_daily (trade_date desc);

create table if not exists public.participant_oi_daily (
  trade_date date not null,
  client_type text not null,
  fut_idx_long numeric, fut_idx_short numeric, fut_stk_long numeric, fut_stk_short numeric,
  opt_idx_call_long numeric, opt_idx_put_long numeric, opt_idx_call_short numeric, opt_idx_put_short numeric,
  opt_stk_call_long numeric, opt_stk_put_long numeric, opt_stk_call_short numeric, opt_stk_put_short numeric,
  total_long numeric, total_short numeric,
  primary key (trade_date, client_type)
);

-- End-of-day option chain summary per index underlying and expiry, with open
-- interest by strike kept as JSON (a few dozen strikes a day, not a table's worth).
create table if not exists public.option_chain_eod (
  trade_date date not null,
  symbol text not null,
  expiry date not null,
  spot numeric,
  pcr numeric, max_pain numeric, total_call_oi numeric, total_put_oi numeric,
  call_wall numeric, put_wall numeric,
  strikes jsonb not null default '[]'::jsonb,
  captured_at timestamptz not null default now(),
  primary key (trade_date, symbol, expiry)
);

-- Daily prices: every NSE equity-board security, and BSE for tracked stocks
-- (under their NSE symbol).
create table if not exists public.eq_eod (
  symbol text not null,
  exchange text not null check (exchange in ('NSE', 'BSE')),
  series text not null,
  trade_date date not null,
  prev_close numeric, open numeric, high numeric, low numeric, close numeric,
  volume numeric, turnover_lacs numeric, trades numeric, deliv_qty numeric, deliv_pct numeric,
  primary key (symbol, exchange, series, trade_date)
);
create index if not exists eq_eod_date_idx on public.eq_eod (trade_date);

create table if not exists public.pledge_snapshots (
  company text not null,
  shp_date date not null,
  symbol text,
  broadcast_at timestamptz,
  promoter_pct numeric, pledged_shares numeric, promoter_shares numeric, total_shares numeric,
  pledged_pct_of_promoter numeric, pledged_pct_of_total numeric,
  fetched_at timestamptz not null default now(),
  primary key (company, shp_date)
);
create index if not exists pledge_snapshots_symbol_idx on public.pledge_snapshots (symbol, shp_date desc);

create table if not exists public.deal_history (
  deal_key text primary key,
  trade_date date not null,
  kind text not null check (kind in ('bulk', 'block', 'short')),
  symbol text not null,
  company text, client text, side text, quantity numeric, price numeric, remarks text
);
create index if not exists deal_history_symbol_idx on public.deal_history (symbol, trade_date desc);
create index if not exists deal_history_date_idx on public.deal_history (trade_date desc);

create table if not exists public.nse_ipos (
  symbol text primary key,
  company text not null,
  series text,
  status text not null,
  issue_start date, issue_end date,
  price_band_min numeric, price_band_max numeric,
  issue_size_shares numeric, shares_bid numeric, subscription_times numeric,
  issue_price numeric, listing_date date,
  ipo_slug text,
  fetched_at timestamptz not null default now()
);
create index if not exists nse_ipos_slug_idx on public.nse_ipos (ipo_slug);

create table if not exists public.fpi_daily (
  report_date date not null,
  section text not null check (section in ('cash', 'derivatives')),
  category text not null,
  route text not null,
  buy_cr numeric, sell_cr numeric, net_cr numeric, net_usd_mn numeric,
  buy_contracts numeric, sell_contracts numeric, oi_contracts numeric, oi_cr numeric,
  primary key (report_date, section, category, route)
);

create table if not exists public.week52_levels (
  symbol text not null,
  series text not null,
  adj_high numeric, high_date date, adj_low numeric, low_date date,
  as_of date,
  primary key (symbol, series)
);

-- The latest of each intraday list (most active by value, volume gainers).
create table if not exists public.market_snapshots (
  kind text primary key,
  as_of timestamptz,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

create table if not exists public.index_constituents (
  index_name text not null,
  symbol text not null,
  company text, industry text, isin text,
  as_of date not null default current_date,
  primary key (index_name, symbol)
);
create index if not exists index_constituents_symbol_idx on public.index_constituents (symbol);

-- Current surveillance status; a flag no longer listed is removed each run.
create table if not exists public.surveillance_flags (
  symbol text not null,
  flag text not null check (flag in ('fo_ban', 'asm_long', 'asm_short', 'gsm')),
  stage text, detail text, as_of date,
  primary key (symbol, flag)
);

create table if not exists public.fo_lot_sizes (
  symbol text primary key,
  underlying text,
  lot_size numeric not null,
  as_of date not null default current_date
);

create table if not exists public.corporate_calendar (
  event_key text primary key,
  symbol text,
  company text not null,
  event_date date not null,
  purpose text not null,
  detail text,
  source text not null check (source in ('nse', 'bse'))
);
create index if not exists corporate_calendar_symbol_idx on public.corporate_calendar (symbol, event_date);
create index if not exists corporate_calendar_date_idx on public.corporate_calendar (event_date);

create table if not exists public.macro_monthly (
  series text not null,
  period date not null,
  value numeric not null,
  change_pct numeric,
  source text not null,
  fetched_at timestamptz not null default now(),
  primary key (series, period, source)
);

do $$
declare t text;
begin
  foreach t in array array['index_valuation_daily','participant_oi_daily','option_chain_eod','eq_eod','pledge_snapshots','deal_history','nse_ipos','fpi_daily','week52_levels','market_snapshots','index_constituents','surveillance_flags','fo_lot_sizes','corporate_calendar','macro_monthly']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s public read" on public.%I', t, t);
    execute format('create policy "%s public read" on public.%I for select using (true)', t, t);
  end loop;
end $$;
