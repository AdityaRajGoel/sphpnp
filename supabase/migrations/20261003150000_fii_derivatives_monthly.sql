-- FII net buying per derivatives instrument per calendar month, from
-- fii_derivatives_daily (back to Dec 2014), as one JSON array for /fii-dii-data:
-- [[month 'YYYY-MM', instrument, net_cr, sessions, month-end oi_contracts], ...].
create or replace function public.fii_derivatives_monthly()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_array(month, instrument, net_cr, sessions, oi_end) order by month, instrument), '[]'::jsonb)
  from (
    select to_char(trade_date, 'YYYY-MM') as month, instrument,
           round(sum(buy_cr - sell_cr), 2) as net_cr,
           count(*) as sessions,
           (array_agg(oi_contracts order by trade_date desc))[1] as oi_end
    from public.fii_derivatives_daily
    group by 1, 2
  ) m;
$$;

grant execute on function public.fii_derivatives_monthly() to anon, authenticated;
