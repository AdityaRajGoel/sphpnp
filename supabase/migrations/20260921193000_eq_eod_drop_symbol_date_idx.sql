-- eq_eod is the largest table (179 MB of 291 MB). Its (symbol, trade_date) index
-- (30 MB) duplicates the primary key (symbol, exchange, series, trade_date):
-- every reader filters by symbol, which the key's leading column already serves,
-- and a symbol holds only a few hundred bars, so ordering them by date is trivial.
drop index if exists public.eq_eod_symbol_date_idx;
