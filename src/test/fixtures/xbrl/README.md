# XBRL fixtures

Real filings, committed deliberately. The parser is written against the Ind-AS
tag set, no library handles it, and the failure mode is silent: a wrong context
yields a plausible number that is three times too large.

`reliance-q3fy25-standalone.xml` — Reliance Industries, Q3 FY25, standalone,
Ind-AS New format, non-bank. Verified figures for the `OneD` (current quarter)
context:

| Tag (all under `contextRef="OneD"`) | Value |
| --- | --- |
| RevenueFromOperations | 1282600000000 (₹1,28,260 Cr) |
| OtherIncome | 32140000000 (₹3,214 Cr) |
| Income | 1314740000000 (₹1,31,474 Cr) |
| Expenses | 1198770000000 (₹1,19,877 Cr) |
| ProfitBeforeTax | 115970000000 (₹11,597 Cr) |
| ProfitLossForPeriod | 87210000000 (₹8,721 Cr) |
| BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations | 6.44 |
| DilutedEarningsLossPerShareFromContinuingAndDiscontinuedOperations | 6.44 |
| DebtServiceCoverageRatio | 0.03 |

Two naming traps confirmed against this file:

- There is no bare `BasicEarningsLossPerShare` tag. Ind-AS splits EPS into
  continuing, discontinued, and the combined total. The combined tag is the
  headline figure.
- `SegmentRevenueFromOperations` also sits under `OneD` at 1341330000000. A
  parser matching tag substrings picks it up instead of revenue.

The same file's `FourD` context holds the nine-month year-to-date figures —
revenue 3966450000000 (₹3,96,645 Cr) and EPS 17.77 — while declaring the
identical three-month period. That trap is the reason these tests exist.

## Provenance

**Source:** https://nsearchives.nseindia.com/corporate/xbrl/INDAS_117298_1348254_16012025082021.xml

**Fetched:** 2026-08-03

**SHA-256:** `7a4376e20bcff469a6674116f0e45a76233d6358517d082a0a714ba78e6c2e96`

**Size:** 57,588 bytes

NSE archives implement rate-limiting on automated fetches. Re-fetching this filing may fail transiently with HTTP/2 or timeout errors. The SHA-256 hash above is how to confirm that any replacement file is the same filing.
