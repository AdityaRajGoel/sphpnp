-- Indian macro indicators (World Bank Open Data, CC-BY 4.0) and USD/EUR/GBP-INR
-- exchange rates (Frankfurter, open source over ECB reference rates) - the two
-- macro sources in a wide survey with unambiguously clean licensing and no API
-- key requirement, which is why they are the ones being ingested rather than a
-- richer but murkier-licensed source.
--
-- TWO TABLES, not one table with a discriminator column. World Bank rows are
-- keyed on (indicator, year) - annual, sparse, one observation per indicator
-- per calendar year - while Frankfurter rows are keyed on (pair, date) - daily,
-- one rate per trading day. Folding both into a single table would force a
-- nullable `year` on FX rows and a nullable `rate_date` on indicator rows (or a
-- single "period" column doing double duty as a year and a date), and the
-- shared `value` column would mean "percent" for CPI, "current US$" for GDP per
-- capita, and "INR per unit of base currency" for FX all at once - three unit
-- systems behind one number, with nothing in the schema saying which applies to
-- a given row. Two narrow tables, each with an honest unique key and a single
-- unit system, keep every row self-describing.
--
-- `source` is part of BOTH unique constraints, not just a descriptive column.
-- This repo has already been bitten once by a unique key that omitted `source`
-- and let a second feed silently overwrite the first feed's row for what
-- looked like the same entity (see ec7c20b, corporate_actions). Only World Bank
-- and Frankfurter feed these tables today, but the key is built as if a second
-- source could show up tomorrow for either table - because for other tables in
-- this schema, one already has.

create table if not exists macro_indicators (
  id             bigint generated always as identity primary key,
  -- ISO 3166-1 alpha-3, matching the World Bank API's own country path segment.
  -- Carried as a column (not hardcoded into the unique key's meaning) so a
  -- second country can be added later without a migration to widen the key.
  country_code   text not null default 'IND',
  indicator_code text not null,
  -- Human label carried alongside the code (e.g. "Inflation, consumer prices
  -- (annual %)") so a dashboard reading this table doesn't need a separate
  -- lookup table for what is, today, three fixed indicator codes.
  indicator_name text not null,
  year           smallint not null,
  value          numeric not null,
  source         text not null default 'world-bank',
  fetched_at     timestamptz not null default now(),
  unique (country_code, indicator_code, year, source)
);

create table if not exists fx_rates (
  id          bigint generated always as identity primary key,
  -- "USD/INR" - base/quote, matching how Frankfurter's own from/to query
  -- params read, so the stored pair needs no translation to reconstruct the
  -- request that produced it.
  pair        text not null,
  rate_date   date not null,
  rate        numeric not null,
  source      text not null default 'frankfurter',
  fetched_at  timestamptz not null default now(),
  unique (pair, rate_date, source)
);

-- Dominant query on both tables is "the latest observation(s) for one key",
-- so the indexes lead with the natural lookup key and break ties newest first.
create index if not exists macro_indicators_lookup_idx
  on macro_indicators (country_code, indicator_code, year desc);
create index if not exists fx_rates_lookup_idx
  on fx_rates (pair, rate_date desc);

alter table macro_indicators enable row level security;
alter table fx_rates enable row level security;

create policy "Anyone can view macro indicators"
  on macro_indicators for select to anon, authenticated using (true);
create policy "Anyone can view fx rates"
  on fx_rates for select to anon, authenticated using (true);

-- Writes are service-role only (the sync-macro function); no insert/update
-- policy for anon/authenticated is intentional, matching every other
-- sync-fed table in this schema.
