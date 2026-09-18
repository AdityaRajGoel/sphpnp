-- Cash flow now comes from Yahoo's fundamentals-timeseries endpoint, which has
-- both annual (12M) and quarterly (3M) series. Indian companies file cash flow
-- annually, so 12M is what most symbols have, and the two share dates: TCS has a
-- 3M and a 12M figure for 31 March 2026. Keyed on (symbol, period_end) alone the
-- second would overwrite the first, and anything reading the row could not tell
-- a year's cash from a quarter's.
--
-- Existing rows default to 3M: they came from quoteSummary's quarterly module
-- (and are all empty, which is why this changed).
alter table public.fundamentals_cashflow
  add column if not exists period_type text not null default '3M'
    check (period_type in ('3M', '12M'));

alter table public.fundamentals_cashflow
  drop constraint if exists fundamentals_cashflow_symbol_period_end_key;

alter table public.fundamentals_cashflow
  add constraint fundamentals_cashflow_symbol_period_end_type_key
    unique (symbol, period_end, period_type);
