-- Balance sheet and cash flow. These come from Yahoo, not NSE: Indian quarterly
-- filings are income-statement-only by regulation, so the XBRL carries no
-- borrowings, reserves, total assets or cash flow at all.
--
-- Separate tables rather than columns on fundamentals_income, so a Yahoo outage
-- leaves the NSE-sourced income statement untouched and simply produces no
-- balance row. The ratios that depend on these degrade to absent, never to
-- wrong.

create table if not exists fundamentals_balance (
  id                    bigint generated always as identity primary key,
  symbol                text not null,
  period_end            date not null,
  total_assets          numeric,
  total_debt            numeric,
  total_equity          numeric,
  cash_and_equivalents  numeric,
  current_assets        numeric,
  current_liabilities   numeric,
  source                text not null default 'yahoo',
  fetched_at            timestamptz not null default now(),
  unique (symbol, period_end)
);

create table if not exists fundamentals_cashflow (
  id               bigint generated always as identity primary key,
  symbol           text not null,
  period_end       date not null,
  operating_cf     numeric,
  investing_cf     numeric,
  financing_cf     numeric,
  capex            numeric,
  free_cash_flow   numeric,
  source           text not null default 'yahoo',
  fetched_at       timestamptz not null default now(),
  unique (symbol, period_end)
);

alter table fundamentals_balance  enable row level security;
alter table fundamentals_cashflow enable row level security;

create policy "Anyone can view balance sheet"
  on fundamentals_balance for select to anon, authenticated using (true);
create policy "Anyone can view cash flow"
  on fundamentals_cashflow for select to anon, authenticated using (true);
