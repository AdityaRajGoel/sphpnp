# Fundamentals validation gate

The full backfill does not start until the parser round-trips the Nifty 50.
A parser bug caught over fifty symbols is cheap; the same bug found after five
hundred means re-parsing everything.

## Before you can run this at all

This gate is a SQL checklist run against live data, not a script - it only
produces a meaningful answer once the sync has actually walked the Nifty 50.
As of this writing:

- The four fundamentals migrations
  (`20260804000000_fundamentals_core.sql`,
  `20260804010000_fundamentals_ownership.sql`,
  `20260804020000_fundamentals_balance_cashflow.sql`,
  `20260804030000_fundamentals_derived.sql`) are already applied, and the
  `sync-fundamentals` edge function is already deployed, to project
  `zbkjbbujsdlpujotgltm`.
- Nothing has synced yet on its own. Triggering a batch means calling
  `sync-fundamentals` with the `x-sync-secret` header set to the same
  `SYNC_SECRET` value shared with `sync-bhavcopy`, `sync-market-feed` and
  `sync-unlisted-quotes`. That value is deliberately not stored anywhere in
  this repo or checked out locally - it lives only as the `MARKET_SYNC_SECRET`
  GitHub Actions secret and the matching Supabase edge function secret. Ask
  whoever holds it, or trigger the `Fundamentals sync` workflow
  (`.github/workflows/fundamentals-sync.yml`) via `workflow_dispatch`, which
  already has the secret wired in.
- `sync-fundamentals` processes `BATCH_SIZE = 5` symbols per invocation
  (see `supabase/functions/sync-fundamentals/index.ts`), resuming from a
  cursor in `sync_cursors`. Covering the Nifty 50 (50 symbols) therefore
  takes roughly 50 / 5 = **10 hourly runs** at minimum - more if any batch
  hits a delisted/renamed cursor symbol and restarts from the top, or if a
  symbol's registry call fails and gets skipped rather than counted. Do not
  run this gate before that many runs have elapsed; a partial pass over the
  universe will look like a failure of check 4 (only one basis populated)
  for reasons that have nothing to do with the parser.

Once the sync has covered the Nifty 50, run the four checks below in order.

## Gate criteria

```sql
-- 1. No parse failures.
select symbol, to_date, parse_error, parse_attempts
from fundamentals_filings
where parse_status = 'failed'
order by symbol;
```
Expected: zero rows. Any row is a format variant the parser does not handle -
add it as a fixture and fix the parser before widening. A row where
`parse_attempts` has reached the sync's cap (`MAX_PARSE_ATTEMPTS = 5`) is no
longer being retried automatically; it needs a person to look at
`parse_error`; it will not resolve itself by waiting for more hourly runs.

```sql
-- 2. The known-good figure is exact.
select revenue, basic_eps
from fundamentals_income
where symbol = 'RELIANCE' and period_end = '2024-12-31' and is_consolidated = false;
```
Expected: `1282600000000` and `6.44`. A revenue of `3966450000000` means the
year-to-date column was taken.

```sql
-- 3. Quarterly revenue is not implausibly large.
-- A row where the quarter exceeds the trailing four quarters' average by more
-- than 2.5x is the signature of a year-to-date figure stored as a quarter.
select symbol, period_end, revenue
from fundamentals_income
where is_consolidated = false and revenue is not null
order by revenue desc
limit 20;
```
Inspect the top rows against the company's reported quarterly revenue.

```sql
-- 4. Both bases are present where the company files both.
select is_consolidated, count(*)
from fundamentals_income group by is_consolidated;
```
Expected: both `true` and `false` populated.

Only when all four pass does the universe widen beyond Nifty 500.
