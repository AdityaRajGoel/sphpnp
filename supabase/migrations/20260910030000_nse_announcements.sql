-- Exchange-published filings from NSE's own RSS feeds.
--
-- Distinct from `market_feed`, which carries business-press stories: those are
-- journalists' summaries and cannot be attributed to a company reliably. These
-- are NSE's record of what a named company filed, which is the only thing that
-- can drive a per-ticker announcements surface on a stock page.
--
-- THREE TABLES, not one with a type column. A corporate action is keyed on
-- (company, purpose, ex-date) and carries a record date and face value; a
-- results filing is keyed on its XBRL URL and carries a period and an audit
-- basis; a general announcement is keyed on its attachment URL and carries a
-- subject. Folding them together would mean a row where most columns are null
-- and nothing in the schema says which subset applies - the same reasoning the
-- macro tables were built on.
--
-- `company` is NSE's display name ("Shaily Engineering Plastics Limited"), NOT
-- a ticker. The feeds do not publish symbols, and deriving one by matching
-- names would be a guess presented as a join. Mapping to screener_stocks is a
-- separate, explicit step and is deliberately not assumed here.

create table if not exists public.nse_corporate_actions (
  id            bigint generated always as identity primary key,
  company       text not null,
  purpose       text,
  series        text,
  face_value    text,
  ex_date       date,
  record_date   date,
  published_at  timestamptz,
  link          text,
  fetched_at    timestamptz not null default now(),
  -- Purpose is part of the key: a company can go ex-dividend and ex-split on
  -- the same date, and those are two different events.
  unique (company, purpose, ex_date)
);

create index if not exists nse_corporate_actions_ex_date_idx
  on public.nse_corporate_actions (ex_date desc nulls last);

create table if not exists public.nse_result_filings (
  id              bigint generated always as identity primary key,
  company         text not null,
  -- The reason this feed matters: a direct XBRL URL. NSE's
  -- corporates-financial-results JSON endpoint stopped returning filings after
  -- 2024-12-31, which is what froze fundamentals_income, so these links are a
  -- possible route to filings that API no longer serves.
  xbrl_url        text not null unique,
  period_ended    date,
  period          text,
  is_consolidated boolean,
  is_audited      boolean,
  published_at    timestamptz,
  -- Null until something tries to parse it, so a backfill can find the ones it
  -- has not attempted without re-reading every filing.
  parsed_at       timestamptz,
  fetched_at      timestamptz not null default now()
);

create index if not exists nse_result_filings_unparsed_idx
  on public.nse_result_filings (published_at desc) where parsed_at is null;

create table if not exists public.nse_announcements (
  id             bigint generated always as identity primary key,
  company        text not null,
  subject        text,
  detail         text,
  attachment_url text not null unique,
  published_at   timestamptz,
  fetched_at     timestamptz not null default now()
);

create index if not exists nse_announcements_published_idx
  on public.nse_announcements (published_at desc nulls last);
create index if not exists nse_announcements_company_idx
  on public.nse_announcements (company);

alter table public.nse_corporate_actions enable row level security;
alter table public.nse_result_filings   enable row level security;
alter table public.nse_announcements    enable row level security;

-- Public exchange disclosures: readable by anyone, written only by the sync
-- function under the service role.
create policy "NSE corporate actions are publicly readable"
  on public.nse_corporate_actions for select using (true);
create policy "NSE result filings are publicly readable"
  on public.nse_result_filings for select using (true);
create policy "NSE announcements are publicly readable"
  on public.nse_announcements for select using (true);
