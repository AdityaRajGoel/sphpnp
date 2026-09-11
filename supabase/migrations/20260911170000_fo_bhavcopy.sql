-- Every F&O underlying's end-of-day snapshot from NSE's F&O bhavcopy: the
-- near-month future beside the option chain, and the day's build-up.
alter table public.option_chain_eod
  add column if not exists fut_close numeric,
  add column if not exists fut_prev_close numeric,
  add column if not exists fut_oi numeric,
  add column if not exists fut_oi_change numeric,
  add column if not exists build_up text check (build_up in ('long_buildup', 'short_buildup', 'short_covering', 'long_unwinding', 'neutral')),
  add column if not exists lot_size numeric;
create index if not exists option_chain_eod_symbol_idx on public.option_chain_eod (symbol, trade_date desc);
