# Stock Fundamentals Page (Track F, Spec 1)

**Date:** 2026-08-06
**Status:** Approved design, ready for implementation planning
**Scope:** One user-facing route, `/stock/:symbol`, built only on fundamentals
data that is actually populated today. No screener changes, no Research Hub, no
dividend calculator.

## Why this exists

Track E shipped a fundamentals data layer and no way to see it. The tables are
queryable, the sync runs hourly, and not a single `src/` component reads any of
it. This spec turns the populated part of that data into the first surface.

Track F as written in the Track E plan covered "stock pages, screeners and
Research Hub 2.0" — three independent subsystems. That is too much for one
spec, so it is decomposed:

| Spec | Deliverable |
| --- | --- |
| **1 (this)** | `/stock/:symbol` on income, corporate actions, XBRL-native ratios |
| 2 | Yahoo balance-sheet and cash-flow ingestion + the derived-ratio job |
| 3 | Dividend calculator (reuses this page's data-access layer) |
| 4 | Screener upgrade, Research Hub 2.0 |

## What the data actually contains

This was verified against the code, not the plan, and the two disagree.

| Table | Written by | Rows today | Usable here |
| --- | --- | --- | --- |
| `screener_stocks` (universe) | `fetch-screener-data` | **159** | Yes — header, route list |
| `fundamentals_filings` | `sync-fundamentals` | **0** | Provenance, once populated |
| `fundamentals_income` | `sync-fundamentals` | **0** | Core of the page, once populated |
| `fundamentals_corporate_actions` | `sync-fundamentals` | **0** | Dividends and splits, once populated |
| `fundamentals_balance` | **nothing** | 0 | No |
| `fundamentals_cashflow` | **nothing** | 0 | No |
| `fundamentals_derived` | **nothing** | 0 | No |
| `shareholding_pattern` | **nothing** | 0 | No |

Row counts are exact, read live from PostgREST with `Prefer: count=exact`, with
`bhavcopy_eod` (3183) as a control confirming anon can read real data and that
the counts are not RLS masking.

Commit `5d69968` ("add balance sheet and cash flow tables") shipped a migration
and no fetcher. Commit `5e04992` ("compute derived ratios fail-closed") shipped
a migration, `_shared/ratios.ts`, and 53 lines of tests — but no caller.
`computeRatios` is referenced only by its own test file. ROE, ROCE, current
ratio and free cash flow therefore cannot be computed today.

Two ratios survive: `debt_equity_ratio` and `debt_service_coverage_ratio` are
parsed straight from XBRL into `fundamentals_income`, so they are real.

### Why every table is empty

Two independent defects, both confirmed by running the workflow on 2026-08-06.

**1. The cron had never fired.**
`.github/workflows/fundamentals-sync.yml` was added in commit `0476731`, which
lived only on `feat/fundamentals-data-layer`. **GitHub Actions `schedule`
triggers fire only from the repository's default branch**, so the hourly cron
never ran. The workflow's run history confirmed it: `total_count: 1`, that one
being the manual dispatch. Merging to `main` fixed this.

**2. NSE blocks the function's requests.** *(still open — blocks everything)*
That manual run finished in 16 seconds against a design that paces 30s per
symbol, and returned:

```json
{"ok":true,"symbols":5,"filings":0,"parsed":0,"failed":0,"skipped":0}
```

`NSE_HEADERS` (`_shared/nse.ts:10`) sends `User-Agent:
sphpnp-fundamentals/1.0` and no cookies. NSE's WAF drops the connection
outright — verified by request: those exact headers yield a connection failure
with no HTTP response, while a browser User-Agent with cookies primed from
`nseindia.com` returns HTTP 200 and 130 filing rows for RELIANCE. Because this
fails below the HTTP layer, `nseGet`'s 4xx/5xx retry logic never engages.

The fix is to prime cookies from the NSE homepage once per invocation, reuse
that `Cookie` header across the batch, and present a browser User-Agent. Deno's
`fetch` has no cookie jar, so `Set-Cookie` must be captured and replayed
manually.

**3. The health signal cannot see either failure.**
`index.ts:126` catches a registry failure, logs it to `console.error`, and
deliberately leaves `registry` empty so the symbol's corporate actions still
run. That is reasonable in isolation, but no counter records it: the summary's
`failed` counts only parse failures. So total NSE blockage reports
`{"ok":true,"filings":0,"failed":0}` and the workflow's `[ "$code" = "200" ]`
gate passes green — indefinitely, with zero rows.

**A green run is not evidence of a working sync.** The summary needs a
registry-failure counter, and the workflow must fail when registry failures
approach the batch size. Until that exists, row counts are the only trustworthy
signal.

### Coverage ramps from zero

The universe is `screener_stocks` — 159 symbols. `sync-fundamentals` walks it 5
symbols per hourly run behind a cursor, so a full first pass is **32 runs, about
32 hours**. Coverage is therefore not merely partial, it starts at zero and
climbs.

This elevates one state from edge case to primary case: for the first hours
after the sync starts, *most* symbols will have no financials. "Not yet synced"
is the majority rendering on day one and must be designed as a first-class
state, not an afterthought — and this page cannot be validated against real data
until the sync has run.

## Architecture

### Route and identity

`/stock/:symbol`, uppercase NSE ticker (`/stock/RELIANCE`). This is the site's
second dynamic route; `/learn/:slug` is the existing precedent.

The symbol is validated against `screener_stocks`. An unknown symbol returns a
real 404 — the site already serves genuine 404s rather than falling back to the
SPA shell, and a stock page must not become a soft-404 farm across a namespace
of arbitrary tickers. Title, meta description and canonical URL derive from
`screener_stocks.name` and `sector`.

### Consolidated vs standalone is the correctness trap

`fundamentals_income` is unique on `(symbol, period_end, is_consolidated)`, and
Indian companies routinely file both bases for the same quarter. A naive
`select ... where symbol = ? order by period_end` interleaves them, producing a
table that reads as a revenue trend and is not one — consolidated revenue
against standalone revenue in adjacent columns, with nothing on screen saying
so. For a SEBI-registered broker publishing financials, that is the worst
defect this page could ship.

Rules:

- Prefer consolidated for the whole displayed range.
- Fall back to standalone only when no consolidated row exists for that symbol.
- Never mix bases within one rendered table.
- Always label the basis on screen.
- Offer a toggle only when both bases exist across the range.

The selection is a pure function over the fetched rows and is unit-tested,
including the mixing trap explicitly.

### Sections

1. **Header** — name, symbol, sector, price / change / market cap from
   `screener_stocks`, with an explicit "as of" stamp from `updated_at`.
2. **Quarterly income statement** — revenue, other income, total income, total
   expenses, profit before tax, profit after tax, basic and diluted EPS.
   Quarters as columns, most recent first.
3. **Ratios** — `debt_equity_ratio` and `debt_service_coverage_ratio` only.
4. **Corporate actions** — ex-date, type, value, description, newest first.
5. **Provenance** — link to the source `xbrl_url`, `filing_date`, and the
   audited/unaudited flag.

### Missing values

Two different absences, deliberately treated differently.

**A null column in a present filing** means the XBRL fact was absent. The row
stays visible, renders "Not available", and states the reason. Every covered
stock shows the same row set, so a gap can never be read as a zero and two
stocks stay comparable. Null is never rendered as `0` or as a bare dash.

**A metric with no ingestion at all** — ROE, ROCE, current ratio, free cash
flow — is omitted entirely rather than rendered as permanently unavailable.
Rendering them would put an identical "Not available" on all ~130 pages on
every load, which is noise, not honesty. They appear when Spec 2 lands.

### Staleness

Financial figures carry the filing date they came from. Price carries its own
`updated_at`. Because the sync cursor reaches a given symbol roughly daily,
nothing on the page may imply real-time financials.

### Data delivery and prerendering

`scripts/prerender.js` and `scripts/generate-sitemap.js` both read hardcoded
route arrays today. Per-symbol routes are instead **fetched from
`screener_stocks` at build time**, using the publishable key already hardcoded
as a fallback in `src/integrations/supabase/client.ts` — the same key shipped in
the browser bundle, so this adds no credential exposure. Both scripts consume
one shared route-derivation module so the sitemap and the prerendered set can
never disagree.

The build **fails closed on an empty or failed fetch**, mirroring the existing
guard in `prerender.js` that refuses to prerender when `learnContent.ts` yields
no article slugs.

`prerender.js` currently catches a `page.goto` timeout, warns, and writes
whatever DOM exists. Across 39 mostly-static routes that is harmless; across
~159 data-fetching routes it would silently bake loading skeletons into
crawlable HTML. **A content assertion on every written stock page is therefore
required**: a page whose HTML lacks its financial data fails the build rather
than shipping.

This is not hypothetical. At concurrency 8 the measurement produced 126
well-formed 28KB files containing the loading skeleton, with `timeouts=0` and
nothing in the log distinguishing that run from a good one. The current script
cannot tell a clean run from a catastrophic one.

**Decision: each page fetches client-side and puppeteer captures the hydrated
DOM.** No build-time data injection. Measured, against a decision rule fixed
before the numbers came in.

| Measurement | Result |
| --- | --- |
| `vite build` cost of adding the route | ~0 (flat) |
| Prerender, 169 routes, sequential | **157.8s** (measured, not extrapolated) |
| Per-route cost: data-fetching vs static | +88ms median (~11%) |
| Capture completeness, sequential | **190/190 (100%)** |
| Capture completeness, concurrency 4 | **390/390 (100%)** |
| Capture completeness, concurrency 6 | 39/130 (30%) |
| Capture completeness, concurrency 8 | 10/260 (3.8%) |

Sequential comes in at 2.6 minutes against the five-minute bar with perfect
capture, so **no concurrency is needed** and the collapse above 4 never applies
to the shipped configuration. Client-fetch also keeps a single data path; the
`corporate_actions` shape mismatch in Track E is what a second, diverging path
costs.

Two facts from the same measurement change the build regardless:

1. The existing prerender set is **39 routes**, not 28 — 27 explicit, 11
   `/learn/:slug` derived from `learnContent.ts`, plus `/404`.
2. `scripts/prerender.js:82` serves the SPA fallback as
   `res.sendFile(path.join(DIST_DIR, 'index.html'))`, which `send`'s dotfile
   guard 404s for **every** route when the repo path contains a dot-segment.
   It is masked today only because the service worker registers on `/` and then
   serves `navigateFallback` from precache for later routes. Fix:
   `res.sendFile('index.html', { root: DIST_DIR })`.

The per-route figure is a floor, not a ceiling: it was measured against empty
fundamentals tables and a page with no chart. A populated page will cost more.

### Performance

The route is lazy-loaded like every other page. **No price chart in v1**, which
keeps the 113.9 kB gzip `chart-vendor` chunk off the page entirely; a chart is
the obvious v2 addition and should stay behind its own dynamic import when it
lands. Tables are plain markup.

For reference, a current chart-bearing page ships roughly 441 kB gzip of JS
against a 150 kB budget. This page must not add to that class.

### Motion and interaction

Motion uses `src/lib/motion.ts` exclusively — `revealSection` for section
entry, `revealItem` for row stagger. No new animation dependency: `motion`
^12.42.2 is already installed, and the July motion sweep unified the site onto
these tokens after finding four competing ease-out curves and ~90 unanimated
transitions. Third-party animated component kits reintroduce exactly that
fragmentation, because each ships its own hardcoded durations and easings.

A ⌘K symbol switcher lets users move between covered stocks, built on the
installed `cmdk` and existing `src/components/ui/command.tsx`; the mobile
presentation uses the installed `vaul` and existing `drawer.tsx`.

## Error handling

| Condition | Behaviour |
| --- | --- |
| Symbol absent from `screener_stocks` | Real 404 |
| Symbol present, zero income rows (cursor hasn't reached it) | "Financials not yet synced" — an expected state, not an error |
| Symbol present, income rows but no corporate actions | Section renders an explicit empty state |
| Supabase query fails | Error state with retry; never an empty table |
| Build-time route fetch empty or failing | Build fails |
| Prerendered stock page missing its data | Build fails |

The distinction between "not synced yet" and "query failed" matters: the first
is routine given the batch cursor and must not look broken.

## Testing

Pure functions carry the load, matching `ratios.test.ts` and `xbrl.test.ts`:

- Consolidated/standalone selection, including an explicit mixing-trap case
  asserting that a symbol with both bases never yields an interleaved series.
- Null → "Not available" mapping, asserting null never formats as `0`.
- Indian crore/lakh number formatting, including negatives and nulls.
- Corporate-action grouping and ordering by ex-date.
- Route derivation: a symbol list of length zero must throw, not return `[]`.

Integration-level:

- A prerendered page for a known-covered symbol contains its real revenue
  figure in the written HTML — this is the regression test for the
  silent-skeleton failure mode.

## Non-goals

- Balance sheet, cash flow, ROE, ROCE, current ratio, free cash flow (Spec 2).
- Dividend calculator (Spec 3).
- Screener changes, Research Hub 2.0 (Spec 4).
- Price charts, peer comparison, shareholding pattern.
- Any new animation or UI dependency.

## Open dependency

Spec 2 (Yahoo balance-sheet and cash-flow ingestion plus the derived-ratio job)
unblocks the ratio section of this page. This page is designed so that landing
Spec 2 adds rows without restructuring anything.
