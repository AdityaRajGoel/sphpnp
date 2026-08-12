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

## Filings that never declare their headline context

`hdfcbank-q2fy24-standalone.xml` and `tataelxsi-q3fy23-standalone.xml` are here
for one shared reason: **neither declares `<xbrli:context id="OneD">` at all.**

Both instances declare only the *dimensional* contexts
(`OneReportableSegmentRevenue01D` and friends) and omit the plain `OneD` /
`FourD` declarations, while every headline fact still carries
`contextRef="OneD"`. That is invalid XBRL on NSE's side, but the figures are
present, unambiguous and correctly scoped, so they are readable.

A parser that required the *declaration* rejected 27 filings across 9 symbols
with "no OneD headline context" — every banking filing, every NBFC filing and
the `_WEB` Ind-AS variants — and turned the hourly workflow red. These two
fixtures are what stop that from being reintroduced.

### `tataelxsi-q3fy23-standalone.xml`

Tata Elxsi, Q3 FY23, standalone, Ind-AS `_WEB` variant. Verified `OneD` figures:

| Tag | Value |
| --- | --- |
| RevenueFromOperations | 8177431000 |
| OtherIncome | 191348000 |
| Income | 8368779000 |
| Expenses | 5967808000 |
| ProfitBeforeTax | 2400971000 |
| ProfitLossForPeriod | 1946786000 |
| Basic/Diluted EPS (combined tag) | 31.26 |

`FourD` holds the nine-month figures (revenue 23068027000, EPS 88.91), so this
file pins the column as well as the missing declaration.

### `hdfcbank-q2fy24-standalone.xml`

HDFC Bank, Q2 FY24, standalone, **BANKING** taxonomy. Banks name the same line
items differently, so this fixture pins the second tag in each candidate list:

| Our field | Banking tag | Value |
| --- | --- | --- |
| revenue | InterestEarned | 676983900000 |
| otherIncome | OtherIncome | 107078400000 |
| totalIncome | Income | 784062300000 |
| profitBeforeTax | ProfitLossFromOrdinaryActivitiesBeforeTax | 197900500000 |
| profitAfterTax | ProfitLossForThePeriod | 159761100000 |
| basicEps | BasicEarningsPerShareAfterExtraordinaryItems | 21.13 |
| dilutedEps | DilutedEarningsPerShareAfterExtraordinaryItems | 21.02 |

`InterestEarned + OtherIncome = Income` exactly, which is the arithmetic check
the tests assert. Confirmed identical tag names against FEDERALBNK and AUBANK
filings, so this is the taxonomy, not one bank's quirk.

**total_expenses is deliberately null for banks.** The only bank-side candidate
is `ExpenditureExcludingProvisionsAndContingencies` (557123500000), which — as
its name says — excludes provisions, so storing it as "total expenses" would
break the `Income - Expenses = ProfitBeforeTax` identity that every Ind-AS row
in the same column satisfies.

`ReportingQuarter` reads "Half yearly" in this filing. That labels the
disclosure event, not the column: the registry reports 01-Jul-2023 to
30-Sep-2023, and `OneD` (784062300000) against `FourD` (1362229000000) confirms
`OneD` is the quarter and `FourD` the half-year to date.

## Provenance

| File | Source | Fetched | SHA-256 | Bytes |
| --- | --- | --- | --- | --- |
| `reliance-q3fy25-standalone.xml` | [INDAS_117298_1348254_16012025082021.xml](https://nsearchives.nseindia.com/corporate/xbrl/INDAS_117298_1348254_16012025082021.xml) | 2026-08-03 | `7a4376e20bcff469a6674116f0e45a76233d6358517d082a0a714ba78e6c2e96` | 57,588 |
| `hdfcbank-q2fy24-standalone.xml` | [BANKING_97616_956099_17102023052102.xml](https://nsearchives.nseindia.com/corporate/xbrl/BANKING_97616_956099_17102023052102.xml) | 2026-08-12 | `55983daefca2e245975e8fc042c6b5c8821aaeb64bd68d3c837f916894d7a9e6` | 58,425 |
| `tataelxsi-q3fy23-standalone.xml` | [INDAS_87949_779361_27012023113231_WEB.xml](https://nsearchives.nseindia.com/corporate/xbrl/INDAS_87949_779361_27012023113231_WEB.xml) | 2026-08-12 | `a9fe97f0b7b8b1e4924d360641ac5588462dac680c3a7f8dc7c7286c7288c67e` | 30,736 |

NSE archives implement rate-limiting on automated fetches. Re-fetching these filings may fail transiently with HTTP/2 or timeout errors. The SHA-256 hashes above are how to confirm that any replacement file is the same filing.
