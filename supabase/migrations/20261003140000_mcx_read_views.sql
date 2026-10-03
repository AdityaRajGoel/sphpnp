-- Reads for the commodity pages over mcx_futures_daily.
--
-- mcx_active_latest: each commodity's most-held contract (highest open interest) on its
-- latest trading day in the last week; the MCX futures board on /commodities.
create or replace view public.mcx_active_latest with (security_invoker = true) as
select distinct on (symbol)
  symbol, trade_date, expiry, unit, open, high, low, close, prev_close, change_pct, volume, oi, value_lacs, ltt
from public.mcx_futures_daily
where trade_date >= (select max(trade_date) - 7 from public.mcx_futures_daily)
order by symbol, trade_date desc, oi desc, expiry;

grant select on public.mcx_active_latest to anon, authenticated;

-- mcx_active_series: one close per trading day for a commodity, from that day's
-- most-held contract, as a single JSON array [[date, close, expiry], ...] so a
-- 14-year series is one response, not fourteen pages past PostgREST's row cap.
create or replace function public.mcx_active_series(p_symbol text, p_since date default date '2012-01-01')
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_array(trade_date, close, expiry) order by trade_date), '[]'::jsonb)
  from (
    select distinct on (trade_date) trade_date, close, expiry
    from public.mcx_futures_daily
    where symbol = upper(p_symbol) and trade_date >= p_since
    order by trade_date, oi desc, expiry
  ) d;
$$;

grant execute on function public.mcx_active_series(text, date) to anon, authenticated;
