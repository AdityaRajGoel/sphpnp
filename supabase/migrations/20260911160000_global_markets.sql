-- World indices, currencies, metals, oil and bitcoin from EODHD's free plan
-- (sync-global-markets), and a per-provider daily call counter so a free
-- plan's limit is never crossed.
create table if not exists public.global_markets_daily (
  ticker text not null,
  trade_date date not null,
  open numeric, high numeric, low numeric,
  close numeric not null,
  volume numeric,
  primary key (ticker, trade_date)
);

create table if not exists public.provider_usage (
  provider text not null,
  day date not null,
  calls integer not null default 0,
  primary key (provider, day)
);

alter table public.global_markets_daily enable row level security;
alter table public.provider_usage enable row level security;
drop policy if exists "global_markets_daily public read" on public.global_markets_daily;
create policy "global_markets_daily public read" on public.global_markets_daily for select using (true);
-- provider_usage has no public policy: only the service role reads or writes it.

-- Daily prices for every NSE security grow ~100 MB a year. Stocks the site
-- tracks keep their full history; the rest keep 400 days (see sync-market-data).
create index if not exists eq_eod_symbol_date_idx on public.eq_eod (symbol, trade_date);
