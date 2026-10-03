-- MCX commodity futures from MCX's own market watch (supabase/functions/_shared/mcx.ts),
-- written every few minutes in MCX hours by scripts/host-mcx.mts via sync-mcx. One row
-- per contract per trading day: the day's last quote, so it doubles as a daily history.
create table if not exists public.mcx_futures_daily (
  trade_date date not null,
  symbol text not null,
  expiry date not null,
  unit text not null default '',
  open numeric, high numeric, low numeric,
  close numeric not null,
  prev_close numeric,
  change_pct numeric,
  volume bigint not null default 0,
  oi bigint not null default 0,
  value_lacs numeric,
  ltt timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (trade_date, symbol, expiry)
);
create index if not exists mcx_futures_daily_symbol_date on public.mcx_futures_daily (symbol, trade_date desc);

alter table public.mcx_futures_daily enable row level security;
drop policy if exists "mcx_futures_daily public read" on public.mcx_futures_daily;
create policy "mcx_futures_daily public read" on public.mcx_futures_daily for select using (true);
