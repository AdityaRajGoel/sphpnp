-- Index tuning from pg_stat_user_tables on 21 Sep 2026.

-- The global board and the ticker read every ticker over a date range; with only
-- (ticker, trade_date) that was 361 sequential scans reading 4.4M rows.
create index if not exists global_markets_daily_date_idx on public.global_markets_daily (trade_date);

-- Results filed in the last few days, across all stocks (ticker-feed, telegram-alerts).
create index if not exists fundamentals_filings_filing_date_idx on public.fundamentals_filings (filing_date desc);

-- The Market Pulse insider board reads every stock's trades over a date window.
create index if not exists nse_insider_trades_traded_to_idx on public.nse_insider_trades (traded_to desc);

-- Exact duplicates: each repeats another index (a btree scans backwards as well
-- as forwards), costing every write and nothing on reads.
drop index if exists public.ipo_gmp_snapshots_ipo_captured_idx;          -- = ipo_gmp_snapshots_ipo_id_captured_at_key
drop index if exists public.stock_fundamental_scores_symbol_idx;         -- = stock_fundamental_scores_pkey
drop index if exists public.stock_price_analytics_symbol_idx;            -- = stock_price_analytics_pkey
