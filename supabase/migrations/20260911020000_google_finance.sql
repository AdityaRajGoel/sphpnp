-- Google Finance (via SerpApi) as the fallback source for stock statements.
--
-- IndianAPI covers most stocks but not all: it returned no key metrics for
-- M&M, no NSE code to verify for DIVISLAB, and it rate-limits. SerpApi's
-- Google Finance engine returns quarterly and annual income statement, balance
-- sheet and cash flow plus key stats in one search. sync-google-finance spends
-- its 250-a-month allowance only on those gaps.
--
-- Its grids are stored beside IndianAPI's under their own statement names
-- (gf_*), so the two never overwrite each other; the page shows IndianAPI's
-- when a stock has them and Google's otherwise.

alter table public.stock_statements drop constraint if exists stock_statements_statement_check;
alter table public.stock_statements add constraint stock_statements_statement_check
  check (statement in (
    'quarter_results', 'yoy_results', 'balancesheet', 'cashflow', 'ratios',
    'gf_income_quarterly', 'gf_income_annual',
    'gf_balance_quarterly', 'gf_balance_annual',
    'gf_cashflow_quarterly', 'gf_cashflow_annual'
  ));

alter table public.stock_profiles
  -- { "pe": 18.97, "eps": 164.44, "dividend_yield_pct": 1.06, "market_cap_crore": 378000, ... }
  add column if not exists google_finance              jsonb,
  add column if not exists google_finance_fetched_at   timestamptz,
  add column if not exists google_finance_attempted_at timestamptz,
  add column if not exists google_finance_error        text;
