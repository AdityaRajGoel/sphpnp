-- Bounds the retry of an unparseable filing, and indexes the income table's
-- foreign key.
--
-- A filing whose XBRL cannot be parsed lands on parse_status = 'failed', which
-- the sync's "unchanged and already parsed" skip check never matches - so every
-- run re-downloaded that XBRL from NSE and failed again, forever. NSE is the
-- exchange's own public endpoint and the sync deliberately paces itself against
-- it; a permanent retry loop is exactly the traffic that gets an IP throttled.
-- Counting the attempts lets the sync stop asking after a fixed number.
--
-- The counter is reset to 0 by the sync whenever a filing parses and its income
-- row is written, so a restatement that finally parses does not stay tainted by
-- the previous version's failures.
alter table fundamentals_filings
  add column if not exists parse_attempts int not null default 0;

-- fundamentals_income.filing_id references fundamentals_filings (id) with
-- "on delete cascade". Postgres does not index the referencing side of a
-- foreign key on its own, so every delete of a filing row had to seq-scan
-- fundamentals_income to find the children to cascade to, and any lookup of
-- "which income row came from this filing" did the same.
create index if not exists fundamentals_income_filing_id_idx
  on fundamentals_income (filing_id);
