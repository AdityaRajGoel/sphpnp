-- FII buying, selling and end-of-day open interest per derivatives instrument, from
-- NSE's daily fii_stats file (supabase/functions/_shared/fii-stats.ts). Filled each
-- evening by sync-market-feed and backfilled from NSE's archive to 2018.
create table if not exists public.fii_derivatives_daily (
  trade_date date not null,
  instrument text not null check (instrument in ('INDEX FUTURES', 'INDEX OPTIONS', 'STOCK FUTURES', 'STOCK OPTIONS')),
  buy_contracts bigint not null,
  buy_cr numeric(14, 2) not null,
  sell_contracts bigint not null,
  sell_cr numeric(14, 2) not null,
  oi_contracts bigint not null,
  oi_cr numeric(14, 2) not null,
  updated_at timestamptz not null default now(),
  primary key (trade_date, instrument)
);

alter table public.fii_derivatives_daily enable row level security;
drop policy if exists "fii_derivatives_daily public read" on public.fii_derivatives_daily;
create policy "fii_derivatives_daily public read" on public.fii_derivatives_daily for select using (true);
