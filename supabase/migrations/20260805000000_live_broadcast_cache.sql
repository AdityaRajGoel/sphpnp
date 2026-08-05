-- Shared resolution cache for the Live TV section.
--
-- This table exists for one reason: quota. search.list costs 100 units against a
-- 10,000 unit/day project ceiling, and the Learning Center polls every 120
-- seconds while the Live tab is open. Edge function instances are ephemeral and
-- per-request, so an in-process cache would neither survive nor be shared - every
-- concurrent viewer would pay full price and a single open tab would drain the
-- day's quota in under two hours. Caching in Postgres is what collapses a burst
-- of viewers into one upstream check per TTL.
--
-- The name is deliberately specific. A sibling migration once wrote
-- `create table if not exists corporate_actions` for a name an earlier migration
-- already owned with a different shape; the create silently did nothing, the
-- intended table never existed, and every write failed while the function still
-- returned HTTP 200. `live_broadcast_cache` was checked against every
-- `create table` in this directory before being chosen. Do not rename it to
-- something more generic.
create table if not exists live_broadcast_cache (
  -- Matches the CHANNELS[].key constant in fetch-live-broadcasts.
  channel_key            text primary key,
  channel_id             text not null,

  -- Null whenever the channel is not currently live. The absence of a video id
  -- is the offline state; there is no separate sentinel.
  video_id               text,
  is_live                boolean not null default false,
  title                  text,

  -- Which tier answered: 'api' or 'scrape'. Recorded so a day spent silently on
  -- the fallback because quota blew is diagnosable rather than mysterious.
  resolved_from          text,

  -- Drives the TTL freshness check. Every resolution attempt stamps this,
  -- including one that concluded "not live", so a negative result is cached too.
  checked_at             timestamptz not null default now(),

  -- Consecutive discovery attempts that found no live stream. Feeds the
  -- exponential backoff (5, 10, 20, 40 min, then hourly) that stops an off-air
  -- channel from paying 100 units every poll. Reset to 0 the moment a stream is
  -- found.
  consecutive_misses     int not null default 0,
  -- When the expensive search.list last ran, so the backoff has something to
  -- measure from.
  last_discovery_at      timestamptz,

  -- Hard per-UTC-day backstop on search.list, independent of the backoff. Guards
  -- against a pathological loop (a cache row that never persists, a clock moving
  -- backwards) draining the quota in minutes. The date is stored so the counter
  -- resets itself without a scheduled job.
  discovery_day          date,
  discovery_count        int not null default 0,

  updated_at             timestamptz not null default now()
);

-- RLS on with NO policy, so everything public is denied and only the
-- service-role key (which bypasses RLS) can touch it. This follows sync_cursors
-- rather than the fundamentals fact tables: those carry a public select policy
-- because the site renders them, whereas this is internal job plumbing. The
-- browser never reads it - it calls the edge function, which reads on its
-- behalf - so exposing it would leak our quota state for no benefit.
alter table live_broadcast_cache enable row level security;
