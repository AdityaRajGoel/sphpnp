-- Two unrelated RLS gaps closed together because both were found during the
-- same audit and both are additive, low-risk policy/constraint changes.

-- =============================================================================
-- Gap 1: page_analytics accepts unlimited, unbounded anonymous inserts.
-- =============================================================================
--
-- "Allow anonymous inserts" ... WITH CHECK (true) means any holder of the
-- publishable key - which ships in the browser bundle by design, see
-- src/integrations/supabase/client.ts - can insert arbitrarily many rows of
-- arbitrary shape. Reads are correctly locked down ("No public reads" ...
-- USING (false)), so this is not a data-leak: it is unbounded storage growth
-- and cost. The table has 0 rows today, so nothing has happened yet.
--
-- What actually inserts (src/hooks/usePageTracking.ts trackEvent):
--   page_path:  a React Router pathname, e.g. "/learn/:slug" - always starts
--               with "/", always short (longest static route in App.tsx is
--               "/brokerage-calculator", 22 chars).
--   event_type: "page_view" by default; trackCustomEvent exists for future
--               events ("form submission, stock view, etc.") but is not
--               called from anywhere yet. Snake_case identifier, no spaces.
--   session_id: crypto.randomUUID(), i.e. 36 characters, generated client-side
--               once per tab and cached in sessionStorage.
--   metadata:   a plain object, {} unless a future caller supplies one.
--
-- Rate limiting (per-IP throttling) is deliberately NOT attempted here. RLS
-- policies have no notion of request rate or caller identity beyond the JWT
-- role, so "N inserts per minute from this client" cannot be expressed as a
-- WITH CHECK predicate - a policy claiming to do it would just be wrong. That
-- protection belongs at the edge (Supabase's built-in rate limiting, a
-- Cloudflare rule in front of the project, or a real edge function acting as
-- the write path instead of direct PostgREST access). None of that exists
-- today; this migration only closes the *shape* half of the gap - rejecting
-- rows that are not plausible analytics events - which is what a database
-- constraint can actually enforce.
--
-- Table CHECK constraints (apply to every writer, not just anon/authenticated,
-- so they hold even if a service-role job or an admin tool starts writing
-- here later) reject implausible rows:
alter table public.page_analytics
  drop constraint if exists page_analytics_page_path_shape_chk;
alter table public.page_analytics
  add constraint page_analytics_page_path_shape_chk
  check (
    page_path ~ '^/'
    and char_length(page_path) between 1 and 512
  );

alter table public.page_analytics
  drop constraint if exists page_analytics_event_type_shape_chk;
alter table public.page_analytics
  add constraint page_analytics_event_type_shape_chk
  -- Lowercase snake_case identifier, matching "page_view" and the style implied
  -- by trackCustomEvent's own examples. Not an enumerated allow-list, because
  -- trackCustomEvent is meant to grow new event names without a migration each
  -- time - the shape is constrained, the vocabulary is not.
  check (event_type ~ '^[a-z][a-z0-9_]{0,63}$');

alter table public.page_analytics
  drop constraint if exists page_analytics_session_id_len_chk;
alter table public.page_analytics
  add constraint page_analytics_session_id_len_chk
  -- Nullable column; a NULL session_id already passes (char_length(NULL) is
  -- NULL, and Postgres CHECK constraints only reject on a FALSE result). The
  -- generated id is 36 chars; 100 leaves headroom without allowing a payload
  -- dump under this field.
  check (session_id is null or char_length(session_id) <= 100);

alter table public.page_analytics
  drop constraint if exists page_analytics_metadata_shape_chk;
alter table public.page_analytics
  add constraint page_analytics_metadata_shape_chk
  -- metadata is nullable (no NOT NULL in the original migration) so NULL
  -- passes the same way session_id's NULL does. When present it must be a
  -- JSON object (not an array/string/number used to smuggle a different
  -- shape) and capped at 4KB serialized, well above what a page view or a
  -- form-submission event needs and well below anything that could be used
  -- to inflate storage one row at a time.
  check (
    metadata is null
    or (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 4096)
  );

-- The INSERT policy itself is rewritten to add the one bound a table CHECK
-- constraint cannot express cleanly against a volatile default: created_at is
-- NOT NULL DEFAULT now(), and the app's writer never sets it, but a direct
-- PostgREST call under the anon key still could. Bounding it in WITH CHECK
-- (evaluated per-row at insert time, same as a CHECK constraint using now()
-- would be) stops a caller from backdating or future-dating rows to defeat
-- time-window queries on this table.
drop policy if exists "Allow anonymous inserts" on public.page_analytics;
create policy "Allow anonymous inserts"
  on public.page_analytics
  for insert
  to anon, authenticated
  with check (created_at <= now() + interval '5 minutes');

-- "No public reads" (USING (false)) is untouched - it was already correct.

-- =============================================================================
-- Gap 2: sync_cursors and live_broadcast_cache have RLS enabled with no
-- SELECT policy at all, which reads as "0 rows" - indistinguishable from a
-- genuinely empty table over PostgREST (verified live: both currently return
-- HTTP 200 [] for an anon SELECT, exactly like an empty table would).
-- =============================================================================
--
-- This is the same drift 20260807000000_sync_observations.sql called out and
-- deliberately did not fix in place (that migration only documented it and
-- fixed sync_observations itself). This migration closes it explicitly, one
-- decision per table, each one recorded so it cannot drift back into silence.

-- sync_cursors: holds a job name and a cursor position (see
-- 20260804000000_fundamentals_core.sql - job text primary key, cursor text,
-- updated_at). Operational metadata only, same category as sync_observations:
-- no secrets, no customer data, no market data. The missing SELECT policy was
-- never a decision - nobody wrote a comment explaining why it should stay
-- unreadable, because nobody meant it to be unreadable. It caused a real
-- misdiagnosis this week: sync_cursors read as "the job has never run" when
-- the truth was "this key cannot see this table", and that wrong inference
-- shaped an hour of debugging. Fixing it for consistency with
-- sync_observations, which made the identical call for the identical reason.
drop policy if exists "Anyone can view sync cursors" on public.sync_cursors;
create policy "Anyone can view sync cursors"
  on public.sync_cursors
  for select
  to anon, authenticated
  using (true);

-- Writes stay service-role only - no INSERT/UPDATE policy is added here,
-- matching sync_observations and every other sync-owned table in this schema.

comment on table public.sync_cursors is
  'RLS: anon/authenticated SELECT is granted (see 20260807010000). Operational '
  'metadata only (job name + cursor position), no secrets or customer data. '
  'Writes remain service-role only. Do not remove the SELECT policy without '
  'reading that migration - an unreadable sync_cursors previously caused a '
  'real debugging misdiagnosis by reading identically to an empty table.';

-- live_broadcast_cache: judged separately and the answer is the opposite.
-- Per 20260805000000_live_broadcast_cache.sql, this table caches YouTube
-- Data API resolution state for the Live TV section - channel_id, video_id,
-- is_live, resolved_from, consecutive_misses, discovery_day/discovery_count
-- (the quota backstop). The browser never queries this table directly; it
-- calls the fetch-live-broadcasts edge function, which reads and writes it
-- with the service-role key on the caller's behalf. Granting anon SELECT here
-- would not serve any real reader (nothing in src/ queries this table by
-- name) and would expose the project's YouTube quota-consumption state -
-- discovery_count, discovery_day, consecutive_misses - to anyone with the
-- publishable key, for zero product benefit. That table's own migration
-- already says as much ("RLS on with NO policy, so everything public is
-- denied... This follows sync_cursors rather than the fundamentals fact
-- tables"); the sync_cursors comparison it draws is now stale now that
-- sync_cursors has a SELECT policy, but the conclusion for
-- live_broadcast_cache itself is unchanged and is reaffirmed here rather than
-- carried over by accident. No SELECT policy is added. This is a deliberate,
-- recorded "stays unreadable", not an oversight.
comment on table public.live_broadcast_cache is
  'RLS: no SELECT policy, intentionally (reaffirmed 20260807010000). Only the '
  'service-role key (used by fetch-live-broadcasts) may read or write this '
  'table. It holds YouTube API quota-consumption state (discovery_count, '
  'consecutive_misses) that the browser has no legitimate reason to see, and '
  'nothing in src/ queries it directly - the edge function is the only '
  'reader. See 20260805000000_live_broadcast_cache.sql for the full '
  'reasoning and 20260807010000 for the reaffirmation.';
