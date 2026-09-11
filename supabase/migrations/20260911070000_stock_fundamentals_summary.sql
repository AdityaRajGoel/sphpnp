-- One row of fundamentals per stock for the screener, built by
-- build-screener-fundamentals from what the stock syncs already store
-- (stock_statements, stock_profiles) - no provider request. IndianAPI's
-- figures where a stock has them, Google Finance's otherwise; `source` says
-- which. Percentages are percentages; debt_to_equity and pb are ratios.

create table if not exists public.stock_fundamentals_summary (
  symbol             text primary key,
  source             text not null check (source in ('indianapi', 'google_finance')),
  roe                numeric,
  roce               numeric,
  opm                numeric,
  sales_growth_yoy   numeric,
  profit_growth_yoy  numeric,
  debt_to_equity     numeric,
  pb                 numeric,
  dividend_yield     numeric,
  eps_ttm            numeric,
  latest_quarter     date,
  updated_at         timestamptz not null default now()
);

alter table public.stock_fundamentals_summary enable row level security;
create policy "Stock fundamentals summary is publicly readable"
  on public.stock_fundamentals_summary for select using (true);
