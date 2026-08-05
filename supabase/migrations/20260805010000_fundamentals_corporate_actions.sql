-- The corporate-actions table the fundamentals sync actually needs.
--
-- Why the name is not `corporate_actions`: it could not be. That name was already
-- created by 20260709000000_market_feed.sql with a completely different shape
-- (company, action_type, details, ex_date, is_active - with company and details
-- both NOT NULL, and a unique key on (company, action_type, ex_date)). So when
-- 20260804010000_fundamentals_ownership.sql said
-- `create table if not exists corporate_actions` with the fundamentals shape, the
-- statement was a SILENT no-op: the table existed, nothing was altered, no error
-- was raised, and the fundamentals shape never came into being.
--
-- The consequence went unnoticed through two commits and a deploy. Every upsert
-- from sync-fundamentals failed with 42703 (no such column "symbol") / 42P10 (no
-- matching unique constraint), and because postgrest-js RESOLVES with an error
-- object instead of throwing, the surrounding try/catch never fired, nothing was
-- logged, and the function still answered HTTP 200 with {ok: true}. It was
-- verified against the live project the only way that actually proves anything -
-- selecting a column that exists in only one of the two shapes:
--   ?select=symbol              -> 42703 "column corporate_actions.symbol does not exist"
--   ?select=company,details     -> 200 [{"company":"RPOWER", ...}]
-- Note that a plain existence probe returns 200 for BOTH shapes, which is exactly
-- why an earlier "all tables verified live, every one returns 200" check missed it.
--
-- Merging into the market-feed table was rejected rather than merely avoided.
-- sync-market-feed runs a daily `delete().lt("ex_date", today)` to keep its feed
-- forward-looking, which would silently purge all historical fundamentals actions;
-- and the two use different action_type conventions ("dividend" here vs
-- "Dividend" there), which useMarketFeed renders straight onto the homepage.
--
-- Do not "tidy" this back to a shorter name.
create table if not exists fundamentals_corporate_actions (
  id            bigint generated always as identity primary key,
  symbol        text        not null,
  ex_date       date        not null,
  record_date   date,
  action_type   text        not null,
  -- Rupee figure where one can be attributed to THIS action type, else null. A
  -- combined "bonus and dividend" purpose yields the figure only on the row it
  -- belongs to; a borrowed number next to the wrong action_type is worse than an
  -- absent one.
  value         numeric,
  -- In the unique key, so a company announcing two actions on the same ex-date
  -- keeps both rows instead of one silently overwriting the other.
  description   text        not null,
  source        text        not null default 'nse',
  fetched_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (symbol, ex_date, action_type, description)
);

create index if not exists fundamentals_corporate_actions_symbol_idx
  on fundamentals_corporate_actions (symbol, ex_date desc);

-- Public read, service-role write. Matches the fundamentals fact tables: the site
-- renders these, but only the sync may write them, and the service-role key
-- bypasses RLS so no write policy is needed.
alter table fundamentals_corporate_actions enable row level security;

drop policy if exists "fundamentals_corporate_actions_public_read"
  on fundamentals_corporate_actions;
create policy "fundamentals_corporate_actions_public_read"
  on fundamentals_corporate_actions
  for select
  to anon, authenticated
  using (true);
