# Fundamentals Data Layer (Track E)

**Date:** 2026-08-03
**Status:** Approved design, ready for implementation planning
**Scope:** Backend data layer only. No user-facing UI.

## Why this exists

A roadmap review split seventeen proposed features into eight tracks. Five of
them — Research Hub 2.0, Bloomberg-style stock pages, smart screeners, the
ETF/mutual-fund explorer, and parts of the AI research assistant — turned out
to share one blocking dependency: the site has no financial-statement data.

`screener_stocks` carries `price`, `market_cap`, `pe`, 52-week range and volume.
There is no revenue, profit, EPS, ROE, ROCE, debt, cash flow or shareholding
anywhere in the codebase. A screener filter like `ROE > 18%` or
`Debt/Equity < 0.5` cannot be written against what exists today.

This track builds that layer. It ships no UI. Track F consumes it.

## Source research

Every candidate below was tested live on 2026-08-03, not assumed.

| Source | Result | Provides |
| --- | --- | --- |
| NSE `corporates-financial-results` | 200, 130 filings for RELIANCE | Filing registry, 2005-2024, quarterly, consolidated and standalone |
| NSE XBRL (`nsearchives`) | 200, 57 KB | Revenue, PBT, PAT, basic/diluted EPS, expenses, `DebtEquityRatio`, `DebtServiceCoverageRatio` |
| NSE `corporate-share-holdings-master` | 200, 40 KB | Promoter / FII / DII / public holdings |
| NSE `corporates-corporateActions` | 200, 6 KB | Dividends, bonus, splits, rights |
| NSE bhavcopy | already syncing | Prices, volume, delivery percentage |
| Yahoo `quoteSummary` | reachable from edge functions | Balance sheet, cash flow, derived ratios |
| GoogleFinanceAPI | archived 2024-12-10 | Rejected — no fundamentals, maintainer declares it dead |
| FinanceQuery | MIT, self-hostable | Rejected — SEC EDGAR is US-only, thin NSE coverage |
| Oxylabs Google Finance guide | requires paid subscription | Rejected — paid proxy, no India coverage |

Verification: Reliance Q3 FY25 XBRL returned revenue ₹1,28,260 Cr, PBT
₹11,597 Cr, PAT ₹8,721 Cr, basic EPS 6.44 — matching the reported standalone
figures. These become the first parser test fixture.

**No existing library parses Indian fundamentals.** Six GitHub topic pages
(`nse-stock-data`, `indian-stock-exchange`, `indian-stock-data`, `nse`
filtered to TypeScript, `googlefinance`, `stocks-data`) surfaced only price and
derivatives wrappers. `stock-nse-india` (283 stars, TypeScript, maintained) is
the best reference for NSE session and cookie handling, but implements no
fundamentals. The XBRL parser here is net-new work with no prior art to lean on
— the primary technical risk in this track.

XBRL parsers evaluated and rejected as drop-in dependencies:

- `emilycoco/parse-xbrl` — Node, but hardcoded to US-GAAP concepts
  (`Assets`, `Revenues`, `NetIncomeLoss`) and unmaintained. Will not read
  Ind-AS tags. Useful only as a structural reference for XBRL-to-JSON shape.
- `dgunning/edgartools` — Python and SEC-specific. Its approach to resolving
  contexts to periods is worth borrowing conceptually; the code is not usable
  here.

Consequence: the parser is written in-house against the Ind-AS tag set observed
in real filings, which is why fixture-based testing across format variants is
non-negotiable rather than nice-to-have.

### Context resolution is the correctness trap

A single Ind-AS filing contains 46 XBRL contexts and repeats the same tag across
them. In the Reliance Q3 FY25 filing, `RevenueFromOperations` appears twice:

| contextRef | Declared period | Value | Actually |
| --- | --- | --- | --- |
| `OneD` | 2024-10-01 to 2024-12-31 | ₹1,28,260 Cr | Current quarter |
| `FourD` | 2024-10-01 to 2024-12-31 | ₹3,96,645 Cr | Nine-month year-to-date |

**Two rules follow, and both are counter-intuitive.**

**1. The declared period cannot be trusted.** Both contexts above declare the
identical three-month period, yet `FourD` holds the nine-month cumulative — it
is the April-to-December figure carrying a October-to-December label. A parser
that reads `<xbrli:period>` and believes it will store year-to-date revenue as
a quarter, overstating the quarter roughly threefold.

The reliable signal is the context id prefix, which encodes the *column* of the
standard Indian results table: `One` = current quarter, `Four` = year to date.
Only these two appear in this filing; longer prefixes such as
`OneReportableSegmentRevenue01` are dimensional breakdowns of segments and
operating expenses, not headline figures. A trailing `D` marks a duration
context, `I` an instant.

**2. Consolidation is a property of the filing, not the context.** The filing
carries `NatureOfReportStandaloneConsolidated = Standalone` against *both*
contexts. Standalone and consolidated are filed as separate documents — the
registry for Reliance holds 84 non-consolidated and 46 consolidated filings.
The basis therefore comes from the `consolidated` field of the
`corporates-financial-results` response, never from parsing contexts.

Therefore the parser MUST:

1. Select headline facts by exact `contextRef` equal to `OneD`, never by tag
   name alone and never by reading the declared period.
2. Ignore `FourD` and every dimensional sub-context for headline figures.
3. Take `is_consolidated` from the filing registry metadata, not the document.
4. Reject a filing with no resolvable `OneD` context, recording
   `parse_status = 'failed'`, rather than falling back to another context.

`dgunning/edgartools` solves the analogous problem for SEC filings, but its
model assumes trustworthy context periods and so does not transfer directly.

### The regulatory gap

Indian quarterly filings are income-statement-only by regulation. The XBRL
carries no borrowings, reserves, total assets or cash flow. Therefore **ROE,
ROCE, free cash flow, Piotroski score and Altman Z-score cannot be derived from
NSE data alone** and depend on Yahoo for their balance-sheet and cash-flow
inputs. This asymmetry drives the provenance design below.

## Architecture

NSE XBRL is the system of record for the income statement. Yahoo supplements
balance sheet and cash flow. Every stored row records where it came from.

### Tables

`fundamentals_filings` — the crawl ledger.
symbol, period, from_date, to_date, is_consolidated, is_audited, xbrl_url,
filing_date, content_hash, parse_status, parse_error, fetched_at.
Unique on (symbol, from_date, to_date, is_consolidated).

`fundamentals_income` — parsed from XBRL.
symbol, period_end, is_consolidated, revenue, other_income, total_income,
total_expenses, profit_before_tax, profit_after_tax, basic_eps, diluted_eps,
debt_equity_ratio, debt_service_coverage_ratio, filing_id, source, fetched_at.

`fundamentals_balance` — from Yahoo.
symbol, period_end, total_assets, total_debt, total_equity, cash_and_equivalents,
current_assets, current_liabilities, source, fetched_at.

`fundamentals_cashflow` — from Yahoo.
symbol, period_end, operating_cf, investing_cf, financing_cf, capex,
free_cash_flow, source, fetched_at.

`fundamentals_derived` — computed, never fetched.
symbol, period_end, roe, roce, interest_coverage, current_ratio,
piotroski_score, altman_z, revenue_cagr_3y, revenue_cagr_5y, eps_cagr_3y,
eps_cagr_5y, inputs_complete, missing_inputs, computed_at.

`shareholding_pattern` — from NSE.
symbol, period_end, promoter_pct, promoter_pledged_pct, fii_pct, dii_pct,
public_pct, source, fetched_at.

`corporate_actions` — from NSE.
symbol, ex_date, record_date, action_type, value, description, source,
fetched_at. Unique on (symbol, ex_date, action_type).

All tables carry RLS with public `SELECT` for `anon` and `authenticated`,
matching `screener_stocks`. Writes are service-role only.

### Ingestion

A single `sync-fundamentals` edge function, cron-driven, processing a bounded
batch of symbols per invocation with a resumable cursor persisted between runs.
Bounded batches keep each run well inside the function timeout and make an
interrupted run harmless.

Idempotency is on `content_hash` of the fetched XBRL. An unchanged filing is
skipped without a re-parse. A re-filed result changes the hash and is
reprocessed — restatements are detected rather than silently overwritten.

Rate limiting is deliberate and conservative: NSE is a public exchange service,
not an API product sold to us. Requests are serialised with a fixed delay, and
a 4xx halts the symbol rather than retrying, on the same reasoning the unlisted
sync already applies — a 403 means access changed and asking again will not
help. Transient 5xx retries once.

### Provenance and fail-closed derivation

This is the load-bearing decision.

Every fact row records `source` (`nse_xbrl` or `yahoo`) and `fetched_at`, so
the UI in Track F can label a figure "as filed with NSE" versus "via Yahoo".

`fundamentals_derived` additionally carries `inputs_complete` and a
`missing_inputs` list. **A ratio is written only when every input it requires
is present for that period.** ROE needs Yahoo-sourced equity; if Yahoo is
unavailable or thin for a smallcap, the correct output is no ROE at all, never
an ROE computed against a stale or partial denominator.

This mirrors the rule the `google-reviews` function and `GoogleReviews`
component already follow: for a SEBI-registered intermediary, a figure that
looks authoritative and is wrong is worse than an absent figure. A wrong ROE on
a stock page is a number a retail investor may act on.

### Rollout

The target for this track is **Nifty 500**, which covers the overwhelming
majority of user searches. Nifty 50 is a validation gate rather than a separate
release: the parser must round-trip all Nifty 50 format variants before the
full backfill is allowed to start, so a parser bug is caught over fifty symbols
instead of five hundred. Widening beyond Nifty 500 is a later track.

## Error handling

- Unparseable XBRL: `parse_status = 'failed'` with `parse_error`, symbol
  continues. Failures are queryable, not silent.
- Yahoo unavailable: income statement still ingests; balance-sheet-dependent
  ratios simply are not written that cycle.
- NSE 4xx: halt that symbol, record the status, continue the batch.
- Never write a partial row to make a page look complete.

## Testing

The XBRL parser is the risk. Ind-AS filings vary by `format` (New/Old) and by
`bank` flag — a bank's income statement has a different tag set from a
manufacturer's.

- Checked-in real filings as fixtures, one per observed variant: Ind-AS New
  non-bank (Reliance Q3 FY25, figures above), Ind-AS Old, a bank, and a
  consolidated filing.
- Parser unit tests assert exact known figures against those fixtures.
- Derived-ratio tests assert `inputs_complete = false` and no ratio written
  when a balance-sheet input is withheld.
- Idempotency test: same filing twice produces one row and one parse.
- Coverage target 80 percent per repository standard.

## Non-goals

No UI (Track F). No intraday or real-time data. No international equities. No
mutual-fund or ETF holdings (Track F, different source). No annual-report PDF
parsing — if balance-sheet depth beyond Yahoo is needed later, NSE annual
filings are a follow-up, not part of this track.

## Open dependency

Yahoo returned 429 when probed from a local IP during this research, while the
already-deployed `fetch-screener-data` and `ai-stock-analysis` functions reach
it successfully with a crumb-and-cookie handshake. The Yahoo dependency should
therefore reuse that existing `getYahooCrumb` path rather than a fresh client.

Implementation should confirm balance-sheet and cash-flow module coverage
against a smallcap sample early, since Yahoo coverage thins outside large caps.
If it proves too thin, the fallback is to ship NSE-sourced fields and mark the
balance-sheet-dependent ratios unavailable — never to substitute a weaker
source silently.
