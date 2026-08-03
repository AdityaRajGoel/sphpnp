-- Fundamentals ingest, phase one: the filing registry and the income statement
-- parsed out of each filing's XBRL.
--
-- Indian quarterly filings are income-statement-only by regulation, so balance
-- sheet and cash flow arrive from a different source in a later migration and
-- live in their own tables. Keeping them apart means a Yahoo outage cannot
-- leave a half-populated income row behind.

create table if not exists fundamentals_filings (
  id              bigint generated always as identity primary key,
  symbol          text not null,
  period          text not null,
  from_date       date not null,
  to_date         date not null,
  -- Taken from the results-registry metadata. The XBRL document itself reports
  -- "Standalone" against every context even in a consolidated filing, so the
  -- document is not a usable source for this.
  is_consolidated boolean not null,
  is_audited      boolean not null default false,
  xbrl_url        text not null,
  filing_date     timestamptz,
  -- Hash of the fetched XBRL body. An unchanged filing is skipped without a
  -- re-parse; a restatement changes the hash and is reprocessed rather than
  -- silently overwritten.
  content_hash    text,
  parse_status    text not null default 'pending'
                  check (parse_status in ('pending','parsed','failed','skipped')),
  parse_error     text,
  fetched_at      timestamptz not null default now(),
  unique (symbol, from_date, to_date, is_consolidated)
);

create index if not exists fundamentals_filings_symbol_idx
  on fundamentals_filings (symbol, to_date desc);
create index if not exists fundamentals_filings_pending_idx
  on fundamentals_filings (parse_status) where parse_status = 'pending';

create table if not exists fundamentals_income (
  id                           bigint generated always as identity primary key,
  symbol                       text not null,
  period_end                   date not null,
  is_consolidated              boolean not null,
  revenue                      numeric,
  other_income                 numeric,
  total_income                 numeric,
  total_expenses               numeric,
  profit_before_tax            numeric,
  profit_after_tax             numeric,
  basic_eps                    numeric,
  diluted_eps                  numeric,
  debt_equity_ratio            numeric,
  debt_service_coverage_ratio  numeric,
  filing_id                    bigint references fundamentals_filings (id) on delete cascade,
  source                       text not null default 'nse_xbrl',
  fetched_at                   timestamptz not null default now(),
  unique (symbol, period_end, is_consolidated)
);

create index if not exists fundamentals_income_symbol_idx
  on fundamentals_income (symbol, period_end desc);

-- Resumable cursor. The sync processes a bounded batch per run so it never
-- approaches the function timeout, and an interrupted run costs nothing.
create table if not exists sync_cursors (
  job         text primary key,
  cursor      text,
  updated_at  timestamptz not null default now()
);

alter table fundamentals_filings enable row level security;
alter table fundamentals_income  enable row level security;
alter table sync_cursors         enable row level security;

create policy "Anyone can view filings"
  on fundamentals_filings for select to anon, authenticated using (true);
create policy "Anyone can view income"
  on fundamentals_income for select to anon, authenticated using (true);
