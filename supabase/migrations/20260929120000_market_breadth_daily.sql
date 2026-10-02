-- Advances, declines and unchanged across NSE's EQ and BE series, one row per
-- trading day, for the advance/decline history on Market Pulse. Derived from
-- eq_eod (close against the bhavcopy's own prev_close), and kept in its own
-- table because eq_eod is pruned to bound its size while this history is not.
create table if not exists public.market_breadth_daily (
  trade_date date primary key,
  advances integer not null,
  declines integer not null,
  unchanged integer not null,
  computed_at timestamptz not null default now()
);

alter table public.market_breadth_daily enable row level security;
drop policy if exists "market_breadth_daily public read" on public.market_breadth_daily;
create policy "market_breadth_daily public read" on public.market_breadth_daily for select using (true);

-- Recomputes every day from p_since onwards (all of eq_eod when null).
-- sync-market-data calls it after each day's NSE bhavcopy lands.
create or replace function public.refresh_market_breadth_daily(p_since date default null)
returns integer
language sql
security definer
set search_path = public
as $$
  with day as (
    select trade_date,
      count(*) filter (where close > prev_close)::int as advances,
      count(*) filter (where close < prev_close)::int as declines,
      count(*) filter (where close = prev_close)::int as unchanged
    from eq_eod
    where exchange = 'NSE' and series in ('EQ', 'BE') and close is not null and prev_close > 0
      and (p_since is null or trade_date >= p_since)
    group by trade_date
  ), written as (
    insert into market_breadth_daily (trade_date, advances, declines, unchanged, computed_at)
    select trade_date, advances, declines, unchanged, now() from day
    on conflict (trade_date) do update
      set advances = excluded.advances, declines = excluded.declines, unchanged = excluded.unchanged, computed_at = now()
    returning 1
  )
  select count(*)::int from written;
$$;

revoke all on function public.refresh_market_breadth_daily(date) from public, anon, authenticated;
grant execute on function public.refresh_market_breadth_daily(date) to service_role;

-- Backfill from the history eq_eod still holds.
select public.refresh_market_breadth_daily();
