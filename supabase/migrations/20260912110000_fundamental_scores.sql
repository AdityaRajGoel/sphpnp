-- Composite fundamental scores and balance-sheet quality ratios, computed from
-- fundamentals_income / _balance / _cashflow by sync-fundamental-scores.
-- See supabase/functions/_shared/fundamental-scores.ts for each definition and,
-- importantly, for what is NOT here and why (Altman Z, quick ratio,
-- working-capital days and EV/EBITDA all lack a stored input and have no honest
-- proxy).
create table if not exists public.stock_fundamental_scores (
  symbol      text not null,
  -- The newest period the score was computed from, not the run date: a score
  -- does not change between results, and keying on the run date would store the
  -- same answer ninety times a quarter.
  period_end  date not null,
  -- 'consolidated' or 'standalone'. Recorded because a symbol that stops
  -- reporting consolidated figures switches basis, and a score that moved for
  -- that reason must be explicable rather than mysterious.
  basis       text not null,

  -- Piotroski. The pair is meaningless apart: a score of 6 out of 8 tested is a
  -- different statement from 6 out of 9, and only the first is true when the
  -- share-issuance criterion could not be run (it never can be here - no share
  -- count is collected).
  piotroski_score    smallint,
  piotroski_testable smallint,
  -- Every criterion with its outcome, including the untestable ones and the
  -- reason each was skipped, so a surprising score can be read rather than
  -- reverse-engineered.
  piotroski_criteria jsonb,

  net_debt            numeric,
  net_debt_to_equity  numeric,
  accruals_ratio      numeric,
  cash_conversion     numeric,
  capex_intensity     numeric,
  free_cash_flow      numeric,
  fcf_yield           numeric,
  ev_to_sales         numeric,
  peg                 numeric,
  payout_ratio        numeric,
  revenue_cagr_3y     numeric,
  profit_cagr_3y      numeric,

  computed_at timestamptz not null default now(),
  primary key (symbol, period_end)
);

create index if not exists stock_fundamental_scores_symbol_idx
  on public.stock_fundamental_scores (symbol, period_end desc);

create or replace view public.stock_fundamental_scores_latest
  with (security_invoker = true) as
  select distinct on (symbol) *
  from public.stock_fundamental_scores
  order by symbol, period_end desc;

alter table public.stock_fundamental_scores enable row level security;

create policy "Anyone can view fundamental scores"
  on public.stock_fundamental_scores for select
  to anon, authenticated
  using (true);

-- Writes are service-role only (sync-fundamental-scores).
