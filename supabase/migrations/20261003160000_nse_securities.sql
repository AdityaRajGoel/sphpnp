-- Every security NSE lists (EQUITY_L.csv and SME_EQUITY_L.csv, parsed by
-- supabase/functions/_shared/nse-securities.ts), refreshed weekly by sync-market-data.
-- Names the stocks the bhavcopy only knows by symbol, so each gets a page.
create table if not exists public.nse_securities (
  symbol text primary key,
  name text not null,
  series text not null default '',
  board text not null check (board in ('main', 'sme')),
  listing_date date,
  isin text,
  face_value numeric,
  updated_at timestamptz not null default now()
);

alter table public.nse_securities enable row level security;
drop policy if exists "nse_securities public read" on public.nse_securities;
create policy "nse_securities public read" on public.nse_securities for select using (true);

-- The stocks that get a lighter page: listed, traded on NSE in the last two weeks,
-- and not in the screener universe (those have the full page). One JSON array, so
-- the build reads ~2,600 symbols in one response past PostgREST's row cap.
create or replace function public.lite_stock_symbols()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(s.symbol order by s.symbol), '[]'::jsonb)
  from public.nse_securities s
  where exists (
          select 1 from public.eq_eod e
          where e.symbol = s.symbol and e.exchange = 'NSE'
            and e.trade_date >= (select max(trade_date) - 14 from public.eq_eod where exchange = 'NSE')
        )
    and not exists (select 1 from public.screener_stocks q where q.symbol = s.symbol);
$$;

grant execute on function public.lite_stock_symbols() to anon, authenticated;
