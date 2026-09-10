-- Financial statements and company profile data per stock, from IndianAPI.
--
-- Why a new source: fundamentals_income came from NSE's XBRL registry, which
-- stopped returning anything after 31-Dec-2024 for every symbol, and banks'
-- XBRL parsed to empty rows. Measured 2026-09-10 across 246 stocks: 31 had
-- income newer than Dec 2024, 118 were frozen there, 89 had none, and two had a
-- real ROE. IndianAPI returns Screener.in-layout statements current to the
-- latest quarter.
--
-- STATEMENTS ARE STORED WHOLE, one row per (symbol, statement), as the aligned
-- grid _shared/indianapi.ts parses: period labels, their ISO period ends, and
-- one row per line item. Not normalised into a column per line item because
-- the line items differ by company type - a bank's quarter has Revenue,
-- Financing Profit and Financing Margin % where a manufacturer's has Sales,
-- Operating Profit and OPM % - and a fixed column set would either drop a
-- bank's rows or be mostly null for everyone else. The page renders the grid
-- as delivered, the way Screener does.
--
-- Nothing reaches these tables unless the response was checked to be about the
-- requested symbol (see verifyIdentity / crossCheckRevenue in the sync).

create table if not exists public.stock_statements (
  symbol       text not null,
  statement    text not null
    check (statement in ('quarter_results', 'yoy_results', 'balancesheet', 'cashflow', 'ratios')),
  periods      text[] not null,
  period_ends  date[] not null,
  -- [{ "label": "Sales", "values": [231132, ...] }], values aligned to periods,
  -- in crore (percent for % rows). Null is "not reported", never zero.
  rows         jsonb not null,
  -- True when the quarterly figures were checked against /stock's own
  -- quarterly revenue; false when the two shared no quarter to compare.
  verified     boolean not null default false,
  source       text not null default 'indianapi',
  fetched_at   timestamptz not null default now(),
  primary key (symbol, statement)
);

create table if not exists public.stock_profiles (
  symbol         text primary key,
  company_name   text,
  industry       text,
  isin           text,
  bse_code       text,
  description    text,
  -- keyMetrics by group, every value a number or null:
  -- { "valuation": { "priceToBookMostRecentFiscalYear": 1.96, ... }, ... }
  key_metrics    jsonb not null default '{}'::jsonb,
  -- [{ "days": 50, "nse": 1303.11, "bse": 1302.65 }, ...]
  moving_averages jsonb not null default '[]'::jsonb,
  -- [{ "category": "Promoter", "points": [{ "date": "2026-06-30", "pct": 50.48 }] }]
  shareholding   jsonb not null default '[]'::jsonb,
  -- [{ "period_end": "2026-03-31", "roe": 9.24 }] from the stored statements.
  roe_history    jsonb not null default '[]'::jsonb,
  peers          jsonb not null default '[]'::jsonb,
  analyst_view   jsonb,
  risk_meter     jsonb,
  source         text not null default 'indianapi',
  -- Null until a verified fetch has succeeded; a failed attempt never sets it.
  fetched_at     timestamptz,
  -- The last attempt's outcome, success or not, so a symbol that cannot be
  -- resolved is visible and is not retried ahead of symbols never tried.
  last_attempt_at    timestamptz,
  last_attempt_error text
);

create index if not exists stock_profiles_last_attempt_idx
  on public.stock_profiles (last_attempt_at asc nulls first);

alter table public.stock_statements enable row level security;
alter table public.stock_profiles   enable row level security;

-- Written only by the sync with the service role; read by every visitor.
create policy "Stock statements are publicly readable"
  on public.stock_statements for select using (true);
create policy "Stock profiles are publicly readable"
  on public.stock_profiles for select using (true);
