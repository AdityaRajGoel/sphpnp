-- Indicative unlisted-share prices published by other dealers, refreshed daily
-- by the unlisted-quotes GitHub Action (scripts/fetch-unlisted-quotes.mjs).
-- Powers the "How our rates compare" block on /unlisted-space.
-- Run on the MAIN Supabase project (zbkjbbujsdlpujotgltm).
--
-- Every row carries its source and the moment it was collected. That is not
-- bookkeeping: these are other firms' indicative rates, they move, and this
-- codebase has twice removed price displays that presented unverifiable or
-- stale numbers as current. The UI refuses to show a quote it cannot date.

create table if not exists unlisted_market_quotes (
  id           bigint generated always as identity primary key,
  -- Lowercased, punctuation-stripped company name. Two dealers write the same
  -- company differently ("NSE India Limited Unlisted Shares" vs "NSE India
  -- Unlisted Shares"), so joins happen on this, never on the display name.
  match_key    text not null,
  company_name text not null,
  source       text not null,
  source_url   text not null,
  price        numeric not null check (price > 0),
  currency     text not null default 'INR',
  sector       text,
  fetched_at   timestamptz not null default now(),
  unique (source, match_key)
);

alter table unlisted_market_quotes enable row level security;

DROP POLICY IF EXISTS "Public can view unlisted market quotes" ON unlisted_market_quotes;
create policy "Public can view unlisted market quotes"
  on unlisted_market_quotes for select
  using (true);

-- writes come only from the service role (the scheduled fetch); no other policies

create index if not exists unlisted_market_quotes_match_idx
  on unlisted_market_quotes (match_key);
