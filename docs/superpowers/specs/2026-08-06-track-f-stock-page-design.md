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

| Table | Written by | Usable here |
| --- | --- | --- |
| `fundamentals_filings` | `sync-fundamentals` | Yes — provenance |
| `fundamentals_income` | `sync-fundamentals` | Yes — the core of the page |
| `fundamentals_corporate_actions` | `sync-fundamentals` | Yes — dividends, splits |
| `fundamentals_balance` | **nothing** | No |
| `fundamentals_cashflow` | **nothing** | No |
| `fundamentals_derived` | **nothing** | No |
| `shareholding_pattern` | **nothing** | No |

Commit `5d69968` ("add balance sheet and cash flow tables") shipped a migration
and no fetcher. Commit `5e04992` ("compute derived ratios fail-closed") shipped
a migration, `_shared/ratios.ts`, and 53 lines of tests — but no caller.
`computeRatios` is referenced only by its own test file. ROE, ROCE, current
ratio and free cash flow therefore cannot be computed today.

Two ratios survive: `debt_equity_ratio` and `debt_service_coverage_ratio` are
parsed straight from XBRL into `fundamentals_income`, so they are real.

The universe is `screener_stocks`. `sync-fundamentals` walks it 5 symbols per
hourly run behind a cursor in `sync_cursors`, so a full cycle takes about a day
and **coverage at any moment is partial by design**. The page must treat an
uncovered symbol as an ordinary state, not an error.

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
whatever DOM exists. Across 28 mostly-static routes that is harmless; across
~130 data-fetching routes it would silently bake loading skeletons into
crawlable HTML. **A content assertion is therefore required regardless of which
delivery mechanism is chosen**: a stock page whose HTML lacks its financial
data fails the build rather than shipping.

> **Open decision.** Whether each page fetches client-side and puppeteer
> captures the hydrated DOM, or the build injects pre-fetched data, is pending
> two measurements now in flight: the per-route prerender cost and capture
> reliability under `networkidle2`, and the serialized per-symbol payload size.
>
> The decision rule is fixed in advance, so the measurement decides rather than
> taste. Take the client-fetch path if **both** hold: every trial run captures
> complete HTML for every stock route (no partial captures at any tested
> concurrency), and projected total prerender wall-clock for the full route set
> stays under five minutes at a concurrency the runs show to be stable.
> Otherwise inject the data at build time and accept the second data path.
> Client-fetch is preferred on a tie because it keeps one data path; the
> `corporate_actions` shape mismatch in Track E is what a second, diverging
> path costs. This section will be completed with the answer before
> implementation planning begins.

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
