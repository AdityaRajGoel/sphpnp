-- Derived ratios. Every row records which inputs were missing, so the UI can
-- distinguish "this company has no ROE because we lack equity data" from
-- "this company's ROE is zero". They are not the same statement.
--
-- missing_inputs vs unusable_inputs is the same distinction the app's
-- computeRatios() keeps separate: missing_inputs is data we never received;
-- unusable_inputs is data we received that turned out to be a zero (or
-- zero-summing) denominator, e.g. a freshly-listed company with
-- totalEquity = 0. Both make inputs_complete false, but a consumer needs to
-- tell them apart to phrase the right message.

create table if not exists fundamentals_derived (
  id               bigint generated always as identity primary key,
  symbol           text not null,
  period_end       date not null,
  roe              numeric,
  roce             numeric,
  current_ratio    numeric,
  free_cash_flow   numeric,
  -- False means at least one input was absent or unusable. A consumer
  -- showing a figure from such a row must label it, or omit it.
  inputs_complete  boolean not null default false,
  missing_inputs   text[] not null default '{}',
  unusable_inputs  text[] not null default '{}',
  computed_at      timestamptz not null default now(),
  unique (symbol, period_end)
);

alter table fundamentals_derived enable row level security;

create policy "Anyone can view derived ratios"
  on fundamentals_derived for select to anon, authenticated using (true);
