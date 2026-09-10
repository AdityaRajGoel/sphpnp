-- Puts `source` into fundamentals_income's unique key so two feeds can coexist.
--
-- The table already carries `source` (default 'nse_xbrl') but keyed rows on
-- (symbol, period_end, is_consolidated) alone. That was safe while one feed
-- wrote it. It stops being safe the moment a second does: an upsert from
-- another source would silently REPLACE an authoritative NSE filing with a
-- third-party figure for the same quarter, and nothing in the schema would say
-- it had happened.
--
-- This is the same lesson the macro tables were built around, recorded in
-- 20260810000000_macro_data.sql: `source` belongs in the unique key, not merely
-- alongside it, because this repo has already been bitten once by a key that
-- omitted it.
--
-- Why a second feed is being added at all: NSE's corporates-financial-results
-- endpoint stopped returning filings after 31-Dec-2024 for every symbol tested,
-- while the Yahoo-sourced balance sheet and cash flow reach 30-Jun-2026. Since
-- alignPeriods joins income to balance on an exact period_end match, the two
-- series never meet and derived ratios were computed for 3 rows out of ~1,800 -
-- no stock on the site displayed a ROE. Income from the same source as balance
-- and cash flow makes those periods align by construction.
--
-- NSE XBRL remains authoritative where it exists. Both rows are kept, and the
-- reader picks; nothing is overwritten, and no filing is discarded.

alter table public.fundamentals_income
  drop constraint if exists fundamentals_income_symbol_period_end_is_consolidated_key;

create unique index if not exists fundamentals_income_symbol_period_source_idx
  on public.fundamentals_income (symbol, period_end, is_consolidated, source);

comment on column public.fundamentals_income.source is
  'Which feed produced this row: nse_xbrl (the filing itself, authoritative) or yahoo (a vendor figure, used where no filing is available).';
