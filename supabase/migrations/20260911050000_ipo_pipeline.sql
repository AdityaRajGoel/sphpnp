-- The IPO pipeline: companies that have filed offer documents with SEBI.
--
-- SEBI publishes draft offer documents (DRHP, updated DRHP, addenda) months
-- before an issue opens, and red herring prospectuses shortly before. Both
-- lists are read by sync-ipo-pipeline (see _shared/sebi-filings.ts).
--
-- Two tables: every filing as SEBI listed it, and one row per company rebuilt
-- from the filings on each sync - its stage, dates, documents, and the IPO
-- page it links to once the issue is in our catalogue.

create table if not exists public.ipo_pipeline_filings (
  id           bigint generated always as identity primary key,
  url          text not null unique,
  company      text not null,
  -- ipoMatchKey(company): groups one company's filings despite SEBI's
  -- inconsistent casing and suffixes, and matches it to the IPO catalogue.
  company_key  text not null,
  kind         text not null check (kind in ('drhp', 'udrhp', 'addendum', 'corrigendum', 'rhp', 'prospectus', 'other')),
  category     text not null check (category in ('draft', 'rhp')),
  detail       text not null default '',
  filed_on     date not null,
  -- [{ "label": "Draft Abridged Prospectus", "url": "https://www.sebi.gov.in/..." }]
  extra_links  jsonb not null default '[]'::jsonb,
  fetched_at   timestamptz not null default now()
);

create index if not exists ipo_pipeline_filings_filed_on_idx on public.ipo_pipeline_filings (filed_on desc);
create index if not exists ipo_pipeline_filings_company_key_idx on public.ipo_pipeline_filings (company_key);

create table if not exists public.ipo_pipeline (
  key              text primary key,
  name             text not null,
  stage            text not null check (stage in ('drhp_filed', 'udrhp_filed', 'rhp_filed', 'launched')),
  first_filed_on   date not null,
  latest_filed_on  date not null,
  -- The IPO page, once the issue is in the catalogue.
  ipo_slug         text,
  -- The company's filings, newest first, as buildPipeline returns them.
  filings          jsonb not null default '[]'::jsonb,
  updated_at       timestamptz not null default now()
);

create index if not exists ipo_pipeline_latest_idx on public.ipo_pipeline (latest_filed_on desc);

alter table public.ipo_pipeline_filings enable row level security;
alter table public.ipo_pipeline         enable row level security;

create policy "IPO pipeline filings are publicly readable"
  on public.ipo_pipeline_filings for select using (true);
create policy "IPO pipeline is publicly readable"
  on public.ipo_pipeline for select using (true);
