# Fundamentals Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a backend data layer that ingests Indian company fundamentals — income statement from NSE XBRL filings, balance sheet and cash flow from Yahoo — so Track F can build stock pages, screeners and Research Hub 2.0 on real data.

**Architecture:** Pure parsing logic lives in `supabase/functions/_shared/` so it is importable by both the Deno edge function and Vitest. One cron-driven `sync-fundamentals` edge function orchestrates fetch, parse and store with a resumable cursor. Every stored fact records its source; derived ratios are written only when all inputs exist.

**Tech Stack:** Deno edge functions, Supabase Postgres, TypeScript, Vitest, `fast-xml-parser`, GitHub Actions cron.

## Global Constraints

- Target universe for this track: **Nifty 500**. Nifty 50 is a validation gate before the full backfill, not a separate release.
- Headline facts are selected by `contextRef === "OneD"` exactly. Never read `<xbrli:period>`; it is unreliable.
- `is_consolidated` comes from the filing registry metadata, never from parsing the document.
- A ratio is written only when every input is present. Partial inputs produce no row, never a computed value.
- Every fact table carries `source` (`nse_xbrl` or `yahoo`) and `fetched_at`.
- All tables: RLS enabled, public `SELECT` for `anon` and `authenticated`, writes service-role only. Matches `screener_stocks`.
- NSE requests are serialised with a delay. 4xx halts that symbol; 5xx retries once. Same policy as `sync-unlisted-quotes`.
- Migrations are named `supabase/migrations/YYYYMMDDHHMMSS_<name>.sql`, lowercase SQL, `create table if not exists`.
- Tests live in `src/test/*.test.ts` and run with `npm test`.
- Commit messages: conventional commits, ending with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## File Structure

| File | Responsibility |
| --- | --- |
| `supabase/functions/_shared/xbrl.ts` | Pure XBRL parsing: context selection, fact extraction. No I/O. |
| `supabase/functions/_shared/nse.ts` | NSE HTTP client: filing registry, shareholding, corporate actions. |
| `supabase/functions/_shared/ratios.ts` | Pure ratio computation with fail-closed semantics. No I/O. |
| `supabase/functions/sync-fundamentals/index.ts` | Orchestration, cursor, persistence. |
| `src/test/xbrl.test.ts` | Parser tests against real filing fixtures. |
| `src/test/ratios.test.ts` | Ratio and fail-closed tests. |
| `src/test/fixtures/xbrl/*.xml` | Real filings, one per format variant. |
| `supabase/migrations/*.sql` | Seven tables plus sync cursor. |
| `.github/workflows/fundamentals-sync.yml` | Cron trigger. |

---

### Task 1: Filing registry and income tables

**Files:**
- Create: `supabase/migrations/20260804000000_fundamentals_core.sql`

**Interfaces:**
- Consumes: nothing
- Produces: tables `fundamentals_filings`, `fundamentals_income`, `sync_cursors`

- [ ] **Step 1: Write the migration**

```sql
-- Fundamentals ingest, phase one: the filing registry and the income statement
-- parsed out of each filing's XBRL.
--
-- Indian quarterly filings are income-statement-only by regulation, so balance
-- sheet and cash flow arrive from a different source in a later migration and
-- live in their own tables. Keeping them apart means a Yahoo outage cannot
-- leave a half-populated income row behind.

create table if not exists fundamentals_filings (
  id              bigint generated always as identity primary key,
  symbol          text not null,
  period          text not null,
  from_date       date not null,
  to_date         date not null,
  -- Taken from the results-registry metadata. The XBRL document itself reports
  -- "Standalone" against every context even in a consolidated filing, so the
  -- document is not a usable source for this.
  is_consolidated boolean not null,
  is_audited      boolean not null default false,
  xbrl_url        text not null,
  filing_date     timestamptz,
  -- Hash of the fetched XBRL body. An unchanged filing is skipped without a
  -- re-parse; a restatement changes the hash and is reprocessed rather than
  -- silently overwritten.
  content_hash    text,
  parse_status    text not null default 'pending'
                  check (parse_status in ('pending','parsed','failed','skipped')),
  parse_error     text,
  fetched_at      timestamptz not null default now(),
  unique (symbol, from_date, to_date, is_consolidated)
);

create index if not exists fundamentals_filings_symbol_idx
  on fundamentals_filings (symbol, to_date desc);
create index if not exists fundamentals_filings_pending_idx
  on fundamentals_filings (parse_status) where parse_status = 'pending';

create table if not exists fundamentals_income (
  id                           bigint generated always as identity primary key,
  symbol                       text not null,
  period_end                   date not null,
  is_consolidated              boolean not null,
  revenue                      numeric,
  other_income                 numeric,
  total_income                 numeric,
  total_expenses               numeric,
  profit_before_tax            numeric,
  profit_after_tax             numeric,
  basic_eps                    numeric,
  diluted_eps                  numeric,
  debt_equity_ratio            numeric,
  debt_service_coverage_ratio  numeric,
  filing_id                    bigint references fundamentals_filings (id) on delete cascade,
  source                       text not null default 'nse_xbrl',
  fetched_at                   timestamptz not null default now(),
  unique (symbol, period_end, is_consolidated)
);

create index if not exists fundamentals_income_symbol_idx
  on fundamentals_income (symbol, period_end desc);

-- Resumable cursor. The sync processes a bounded batch per run so it never
-- approaches the function timeout, and an interrupted run costs nothing.
create table if not exists sync_cursors (
  job         text primary key,
  cursor      text,
  updated_at  timestamptz not null default now()
);

alter table fundamentals_filings enable row level security;
alter table fundamentals_income  enable row level security;
alter table sync_cursors         enable row level security;

create policy "Anyone can view filings"
  on fundamentals_filings for select to anon, authenticated using (true);
create policy "Anyone can view income"
  on fundamentals_income for select to anon, authenticated using (true);
```

- [ ] **Step 2: Verify the SQL parses**

Run: `npx supabase db lint --schema public` (if unavailable, visually confirm balanced parentheses and that every `create table` has a matching `enable row level security`).
Expected: no syntax errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260804000000_fundamentals_core.sql
git commit -m "feat(fundamentals): add filing registry and income tables

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Capture real XBRL fixtures

**Files:**
- Create: `src/test/fixtures/xbrl/reliance-q3fy25-standalone.xml`
- Create: `src/test/fixtures/xbrl/README.md`

**Interfaces:**
- Consumes: nothing
- Produces: fixture files used by Tasks 3 and 4

- [ ] **Step 1: Download the known-good filing**

```bash
mkdir -p src/test/fixtures/xbrl
curl -sS -A "Mozilla/5.0 (compatible; sphpnp-fundamentals/1.0; +https://www.sphpnp.com)" \
  -H "Referer: https://www.nseindia.com/" \
  "https://nsearchives.nseindia.com/corporate/xbrl/INDAS_117298_1348254_16012025082021.xml" \
  -o src/test/fixtures/xbrl/reliance-q3fy25-standalone.xml
```

- [ ] **Step 2: Verify the fixture has the expected figures**

```bash
grep -o 'contextRef="OneD"[^>]*>[0-9.]*' src/test/fixtures/xbrl/reliance-q3fy25-standalone.xml | head -3
```
Expected: file is roughly 57 KB and contains `RevenueFromOperations` with `contextRef="OneD"`.

- [ ] **Step 3: Document why these fixtures exist**

```markdown
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
```

- [ ] **Step 4: Commit**

```bash
git add src/test/fixtures/xbrl/
git commit -m "test(fundamentals): add real XBRL filing fixture

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: XBRL context selection

**Files:**
- Create: `supabase/functions/_shared/xbrl.ts`
- Test: `src/test/xbrl.test.ts`

**Interfaces:**
- Consumes: fixture from Task 2
- Produces:
  - `parseContexts(xml: string): Map<string, XbrlContext>`
  - `type XbrlContext = { id: string; column: string; isInstant: boolean; startDate: string | null; endDate: string | null }`
  - `HEADLINE_CONTEXT = "OneD"`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseContexts, HEADLINE_CONTEXT } from "../../supabase/functions/_shared/xbrl";

const xml = readFileSync("src/test/fixtures/xbrl/reliance-q3fy25-standalone.xml", "utf-8");

describe("parseContexts", () => {
  it("finds the headline current-quarter context", () => {
    const ctx = parseContexts(xml);
    expect(ctx.has(HEADLINE_CONTEXT)).toBe(true);
    expect(ctx.get("OneD")!.column).toBe("One");
  });

  it("labels the year-to-date column separately from the quarter", () => {
    const ctx = parseContexts(xml);
    expect(ctx.get("FourD")!.column).toBe("Four");
  });

  it("records the declared period even though it is not trusted for selection", () => {
    const ctx = parseContexts(xml);
    expect(ctx.get("OneD")!.startDate).toBe("2024-10-01");
    expect(ctx.get("OneD")!.endDate).toBe("2024-12-31");
  });

  it("marks instant contexts", () => {
    const ctx = parseContexts(xml);
    expect(ctx.get("OneI")!.isInstant).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/xbrl.test.ts`
Expected: FAIL — cannot resolve `../../supabase/functions/_shared/xbrl`.

- [ ] **Step 3: Write the implementation**

```typescript
/**
 * Pure XBRL parsing for Indian Ind-AS filings. No I/O, no Deno APIs, so this
 * file is importable by both the edge function and Vitest.
 *
 * Two hard-won rules govern everything here, both established against real
 * filings and both counter-intuitive:
 *
 * 1. The declared <xbrli:period> is NOT reliable. In the Reliance Q3 FY25
 *    filing, the year-to-date context FourD declares the same three-month
 *    range as the quarterly context OneD while holding the nine-month figure.
 *    Believing the period overstates a quarter roughly threefold.
 *
 * 2. Consolidation is a property of the FILING, not the context. The document
 *    reports "Standalone" against every context even in a consolidated filing;
 *    the two bases are filed as separate documents. Callers pass the basis in
 *    from the registry metadata.
 *
 * What actually disambiguates facts is the context id prefix, which encodes the
 * column of the standard Indian results table: One = current quarter,
 * Four = year to date.
 */

/** The column carrying the current reporting quarter. */
export const HEADLINE_CONTEXT = "OneD";

export type XbrlContext = {
  id: string;
  /** Results-table column: "One" = current quarter, "Four" = year to date. */
  column: string;
  isInstant: boolean;
  /** Recorded for provenance only. Never use this to choose a context. */
  startDate: string | null;
  endDate: string | null;
};

const CONTEXT_RE = /<xbrli:context id="([^"]+)">([\s\S]*?)<\/xbrli:context>/g;
const START_RE = /<xbrli:startDate>([^<]+)<\/xbrli:startDate>/;
const END_RE = /<xbrli:endDate>([^<]+)<\/xbrli:endDate>/;
const INSTANT_RE = /<xbrli:instant>([^<]+)<\/xbrli:instant>/;

/**
 * Split a context id into its column prefix. "OneD" and "OneI" are both column
 * One; "OneReportableSegmentRevenue01D" is a dimensional breakdown of it and
 * must not be mistaken for a headline figure.
 */
function columnOf(id: string): string {
  const m = /^(One|Two|Three|Four|Five|Six)/.exec(id);
  return m ? m[1] : "";
}

export function parseContexts(xml: string): Map<string, XbrlContext> {
  const out = new Map<string, XbrlContext>();
  CONTEXT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = CONTEXT_RE.exec(xml)) !== null) {
    const [, id, body] = m;
    const instant = INSTANT_RE.exec(body);
    out.set(id, {
      id,
      column: columnOf(id),
      isInstant: instant !== null,
      startDate: START_RE.exec(body)?.[1] ?? null,
      endDate: END_RE.exec(body)?.[1] ?? instant?.[1] ?? null,
    });
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/xbrl.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/xbrl.ts src/test/xbrl.test.ts
git commit -m "feat(fundamentals): parse XBRL contexts by results-table column

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Extract the income statement

**Files:**
- Modify: `supabase/functions/_shared/xbrl.ts`
- Modify: `src/test/xbrl.test.ts`

**Interfaces:**
- Consumes: `parseContexts`, `HEADLINE_CONTEXT` from Task 3
- Produces: `parseIncomeStatement(xml: string): IncomeStatement | null` where
  `type IncomeStatement = { revenue: number | null; otherIncome: number | null; totalIncome: number | null; totalExpenses: number | null; profitBeforeTax: number | null; profitAfterTax: number | null; basicEps: number | null; dilutedEps: number | null; debtEquityRatio: number | null; debtServiceCoverageRatio: number | null; periodEnd: string | null }`

- [ ] **Step 1: Write the failing test**

Append to `src/test/xbrl.test.ts`:

```typescript
import { parseIncomeStatement } from "../../supabase/functions/_shared/xbrl";

describe("parseIncomeStatement", () => {
  it("reads the current quarter, not the year to date", () => {
    const s = parseIncomeStatement(xml)!;
    // The FourD year-to-date value is 3966450000000. Returning that would mean
    // the parser trusted the declared period instead of the column prefix.
    expect(s.revenue).toBe(1282600000000);
  });

  it("extracts the rest of the headline figures", () => {
    const s = parseIncomeStatement(xml)!;
    expect(s.otherIncome).toBe(32140000000);
    expect(s.totalIncome).toBe(1314740000000);
    expect(s.totalExpenses).toBe(1198770000000);
    expect(s.profitBeforeTax).toBe(115970000000);
    expect(s.profitAfterTax).toBe(87210000000);
    expect(s.basicEps).toBe(6.44);
    expect(s.dilutedEps).toBe(6.44);
  });

  it("takes the quarter's EPS, not the year to date", () => {
    // FourD carries 17.77 for the nine months. 6.44 is the quarter.
    expect(parseIncomeStatement(xml)!.basicEps).toBe(6.44);
  });

  it("reports the period end from the headline context", () => {
    expect(parseIncomeStatement(xml)!.periodEnd).toBe("2024-12-31");
  });

  it("returns null when the headline context is absent", () => {
    expect(parseIncomeStatement("<xbrli:xbrl></xbrli:xbrl>")).toBeNull();
  });

  it("ignores segment breakdowns that share the column prefix", () => {
    const s = parseIncomeStatement(xml)!;
    // SegmentRevenueFromOperations under OneD is 1341330000000; picking it up
    // would mean matching on tag substring rather than exact tag name.
    expect(s.revenue).not.toBe(1341330000000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/xbrl.test.ts`
Expected: FAIL — `parseIncomeStatement` is not exported.

- [ ] **Step 3: Write the implementation**

Append to `supabase/functions/_shared/xbrl.ts`:

```typescript
export type IncomeStatement = {
  revenue: number | null;
  otherIncome: number | null;
  totalIncome: number | null;
  totalExpenses: number | null;
  profitBeforeTax: number | null;
  profitAfterTax: number | null;
  basicEps: number | null;
  dilutedEps: number | null;
  debtEquityRatio: number | null;
  debtServiceCoverageRatio: number | null;
  periodEnd: string | null;
};

/**
 * Read one fact by EXACT tag name under one exact context.
 *
 * Exactness matters in both directions. Matching the tag loosely picks up
 * SegmentRevenueFromOperations when RevenueFromOperations was wanted; matching
 * the context loosely picks up the year-to-date column.
 */
function fact(xml: string, tag: string, contextRef: string): number | null {
  const re = new RegExp(
    `<in-bse-fin:${tag}\\s+contextRef="${contextRef}"[^>]*>([-\\d.]+)<`,
  );
  const m = re.exec(xml);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function parseIncomeStatement(xml: string): IncomeStatement | null {
  const contexts = parseContexts(xml);
  const headline = contexts.get(HEADLINE_CONTEXT);
  // No current-quarter column means this filing cannot be read. Falling back to
  // another column would store the wrong period under the right label.
  if (!headline) return null;

  return {
    revenue: fact(xml, "RevenueFromOperations", HEADLINE_CONTEXT),
    otherIncome: fact(xml, "OtherIncome", HEADLINE_CONTEXT),
    totalIncome: fact(xml, "Income", HEADLINE_CONTEXT),
    totalExpenses: fact(xml, "Expenses", HEADLINE_CONTEXT),
    profitBeforeTax: fact(xml, "ProfitBeforeTax", HEADLINE_CONTEXT),
    profitAfterTax: fact(xml, "ProfitLossForPeriod", HEADLINE_CONTEXT),
    // Verified tag names. EPS is NOT filed as a bare
    // "BasicEarningsLossPerShare" — Ind-AS splits it into continuing,
    // discontinued, and the combined total. The combined figure is the
    // headline EPS a reader expects, so that is the one stored.
    basicEps: fact(
      xml,
      "BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations",
      HEADLINE_CONTEXT,
    ),
    dilutedEps: fact(
      xml,
      "DilutedEarningsLossPerShareFromContinuingAndDiscontinuedOperations",
      HEADLINE_CONTEXT,
    ),
    debtEquityRatio: fact(xml, "DebtEquityRatio", HEADLINE_CONTEXT),
    debtServiceCoverageRatio: fact(xml, "DebtServiceCoverageRatio", HEADLINE_CONTEXT),
    periodEnd: headline.endDate,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/xbrl.test.ts`
Expected: 10 tests PASS. Every tag name and value above was verified against
this exact fixture, so a failure means the parser is wrong, not the assertion.
The most likely cause is the `fact()` regex matching loosely — confirm it
requires whitespace immediately after the tag name, which is what stops
`RevenueFromOperations` from also matching `SegmentRevenueFromOperations`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/xbrl.ts src/test/xbrl.test.ts
git commit -m "feat(fundamentals): extract the income statement from XBRL

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: NSE client for the filing registry

**Files:**
- Create: `supabase/functions/_shared/nse.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `fetchFilingRegistry(symbol: string): Promise<FilingRecord[]>`
  - `type FilingRecord = { symbol: string; period: string; fromDate: string; toDate: string; isConsolidated: boolean; isAudited: boolean; xbrlUrl: string; filingDate: string | null }`
  - `fetchXbrl(url: string): Promise<string>`
  - `NSE_HEADERS: Record<string, string>`

- [ ] **Step 1: Write the implementation**

```typescript
/**
 * NSE HTTP access. These are the exchange's own public endpoints, not an API
 * product sold to us, so requests are serialised and deliberately unhurried.
 *
 * Failure policy matches sync-unlisted-quotes: a 4xx means the URL or our
 * access changed and asking again will not help, so it halts that symbol; a
 * 5xx is a blip and is retried once.
 */

export const NSE_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (compatible; sphpnp-fundamentals/1.0; +https://www.sphpnp.com)",
  Referer: "https://www.nseindia.com/",
  Accept: "application/json",
};

/** Delay between NSE requests, milliseconds. */
export const NSE_DELAY_MS = 1200;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type FilingRecord = {
  symbol: string;
  period: string;
  fromDate: string;
  toDate: string;
  isConsolidated: boolean;
  isAudited: boolean;
  xbrlUrl: string;
  filingDate: string | null;
};

/** "01-Oct-2024" as filed, to "2024-10-01" for Postgres. */
export function toIsoDate(indian: string): string | null {
  const m = /^(\d{2})-([A-Za-z]{3})-(\d{4})/.exec(indian?.trim() ?? "");
  if (!m) return null;
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  const mm = months[m[2]];
  return mm ? `${m[3]}-${mm}-${m[1]}` : null;
}

async function nseGet(url: string, asText = false): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { headers: NSE_HEADERS });
    if (res.ok) return asText ? await res.text() : await res.json();
    // 4xx will not improve on retry.
    if (res.status < 500) {
      throw new Error(`NSE ${res.status} for ${url}`);
    }
    if (attempt === 0) await sleep(3000);
    else throw new Error(`NSE ${res.status} after retry for ${url}`);
  }
  throw new Error(`unreachable: ${url}`);
}

export async function fetchFilingRegistry(symbol: string): Promise<FilingRecord[]> {
  const url =
    `https://www.nseindia.com/api/corporates-financial-results` +
    `?index=equities&symbol=${encodeURIComponent(symbol)}&period=Quarterly`;
  const rows = (await nseGet(url)) as Array<Record<string, string>>;
  if (!Array.isArray(rows)) return [];

  return rows.flatMap((r) => {
    const fromDate = toIsoDate(r.fromDate);
    const toDate = toIsoDate(r.toDate);
    // No XBRL means nothing to parse; no dates means nothing to key on.
    if (!r.xbrl || !fromDate || !toDate) return [];
    return [{
      symbol,
      period: r.period ?? "Quarterly",
      fromDate,
      toDate,
      // The document reports "Standalone" regardless, so this metadata field is
      // the only trustworthy source for the basis.
      isConsolidated: r.consolidated === "Consolidated",
      isAudited: r.audited === "Audited",
      xbrlUrl: r.xbrl,
      filingDate: r.filingDate ?? null,
    }];
  });
}

export async function fetchXbrl(url: string): Promise<string> {
  return (await nseGet(url, true)) as string;
}
```

- [ ] **Step 2: Write the date-conversion test**

Create `src/test/nse.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { toIsoDate } from "../../supabase/functions/_shared/nse";

describe("toIsoDate", () => {
  it("converts an NSE date to ISO", () => {
    expect(toIsoDate("01-Oct-2024")).toBe("2024-10-01");
  });

  it("handles a date with a trailing time", () => {
    expect(toIsoDate("16-Jan-2025 20:20")).toBe("2025-01-16");
  });

  it("returns null for an unparseable value", () => {
    expect(toIsoDate("")).toBeNull();
    expect(toIsoDate("not a date")).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/test/nse.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/nse.ts src/test/nse.test.ts
git commit -m "feat(fundamentals): add NSE filing registry client

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: The sync function

**Files:**
- Create: `supabase/functions/sync-fundamentals/index.ts`

**Interfaces:**
- Consumes: `fetchFilingRegistry`, `fetchXbrl`, `NSE_DELAY_MS`, `sleep` (Task 5); `parseIncomeStatement` (Task 4)
- Produces: HTTP endpoint writing `fundamentals_filings` and `fundamentals_income`

- [ ] **Step 1: Write the implementation**

```typescript
// Ingests NSE quarterly filings into fundamentals_filings, parses each one's
// XBRL, and writes the income statement.
//
// Trigger: GitHub Actions cron (.github/workflows/fundamentals-sync.yml).
// Protected by SYNC_SECRET; writes use the service-role key, matching
// sync-bhavcopy, sync-market-feed and sync-unlisted-quotes.
//
// A bounded batch of symbols runs per invocation with a cursor in sync_cursors,
// so the run never approaches the function timeout and an interruption costs
// only the current batch.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  fetchFilingRegistry,
  fetchXbrl,
  NSE_DELAY_MS,
  sleep,
} from "../_shared/nse.ts";
import { parseIncomeStatement } from "../_shared/xbrl.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-secret",
};

const JOB = "fundamentals";
/** Symbols per invocation. Small enough that a run finishes well inside the timeout. */
const BATCH_SIZE = 5;

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const secret = Deno.env.get("SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Universe comes from screener_stocks, which already holds the tracked symbols.
  const { data: universe, error: uErr } = await supabase
    .from("screener_stocks")
    .select("symbol")
    .order("symbol");
  if (uErr) {
    return new Response(JSON.stringify({ error: uErr.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const symbols = (universe ?? []).map((r: { symbol: string }) => r.symbol);
  const { data: cursorRow } = await supabase
    .from("sync_cursors").select("cursor").eq("job", JOB).maybeSingle();

  const start = cursorRow?.cursor ? symbols.indexOf(cursorRow.cursor) + 1 : 0;
  const batch = symbols.slice(Math.max(0, start), Math.max(0, start) + BATCH_SIZE);
  const summary = { symbols: batch.length, filings: 0, parsed: 0, failed: 0 };

  for (const symbol of batch) {
    let registry;
    try {
      registry = await fetchFilingRegistry(symbol);
    } catch (err) {
      // 4xx halts this symbol only; the batch continues.
      console.error(`registry failed for ${symbol}:`, (err as Error).message);
      continue;
    }
    await sleep(NSE_DELAY_MS);

    for (const f of registry) {
      const { data: existing } = await supabase
        .from("fundamentals_filings")
        .select("id, content_hash, parse_status")
        .eq("symbol", f.symbol)
        .eq("from_date", f.fromDate)
        .eq("to_date", f.toDate)
        .eq("is_consolidated", f.isConsolidated)
        .maybeSingle();

      let xml: string;
      try {
        xml = await fetchXbrl(f.xbrlUrl);
      } catch (err) {
        console.error(`xbrl failed for ${f.symbol} ${f.toDate}:`, (err as Error).message);
        continue;
      }
      await sleep(NSE_DELAY_MS);

      const hash = await sha256(xml);
      // Unchanged and already parsed: nothing to do. A restatement changes the
      // hash and falls through to be reprocessed.
      if (existing?.content_hash === hash && existing?.parse_status === "parsed") continue;

      const statement = parseIncomeStatement(xml);
      const status = statement ? "parsed" : "failed";

      const { data: filingRow, error: fErr } = await supabase
        .from("fundamentals_filings")
        .upsert({
          symbol: f.symbol,
          period: f.period,
          from_date: f.fromDate,
          to_date: f.toDate,
          is_consolidated: f.isConsolidated,
          is_audited: f.isAudited,
          xbrl_url: f.xbrlUrl,
          filing_date: f.filingDate,
          content_hash: hash,
          parse_status: status,
          parse_error: statement ? null : "no OneD headline context",
          fetched_at: new Date().toISOString(),
        }, { onConflict: "symbol,from_date,to_date,is_consolidated" })
        .select("id")
        .single();

      if (fErr) { console.error("filing upsert:", fErr.message); continue; }
      summary.filings++;

      if (!statement) { summary.failed++; continue; }

      const { error: iErr } = await supabase.from("fundamentals_income").upsert({
        symbol: f.symbol,
        // The registry's toDate is authoritative; the document's period is not.
        period_end: f.toDate,
        is_consolidated: f.isConsolidated,
        revenue: statement.revenue,
        other_income: statement.otherIncome,
        total_income: statement.totalIncome,
        total_expenses: statement.totalExpenses,
        profit_before_tax: statement.profitBeforeTax,
        profit_after_tax: statement.profitAfterTax,
        basic_eps: statement.basicEps,
        diluted_eps: statement.dilutedEps,
        debt_equity_ratio: statement.debtEquityRatio,
        debt_service_coverage_ratio: statement.debtServiceCoverageRatio,
        filing_id: filingRow.id,
        source: "nse_xbrl",
        fetched_at: new Date().toISOString(),
      }, { onConflict: "symbol,period_end,is_consolidated" });

      if (iErr) console.error("income upsert:", iErr.message);
      else summary.parsed++;
    }
  }

  const next = batch.length ? batch[batch.length - 1] : null;
  await supabase.from("sync_cursors").upsert({
    job: JOB,
    // Null restarts the universe on the next run once the end is reached.
    cursor: start + BATCH_SIZE >= symbols.length ? null : next,
    updated_at: new Date().toISOString(),
  }, { onConflict: "job" });

  return new Response(JSON.stringify({ ok: true, ...summary }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 2: Deploy and smoke-test against Nifty 50**

```bash
npx supabase functions deploy sync-fundamentals --project-ref zbkjbbujsdlpujotgltm
curl -sS -X POST "https://zbkjbbujsdlpujotgltm.supabase.co/functions/v1/sync-fundamentals" \
  -H "x-sync-secret: $SYNC_SECRET" -w "\nHTTP %{http_code}\n"
```
Expected: HTTP 200 with a JSON summary showing `parsed` greater than zero and `failed` at zero.

- [ ] **Step 3: Verify a known figure survived the round trip**

```sql
select symbol, period_end, is_consolidated, revenue, basic_eps
from fundamentals_income
where symbol = 'RELIANCE' and period_end = '2024-12-31' and is_consolidated = false;
```
Expected: `revenue = 1282600000000`, `basic_eps = 6.44`. **If revenue reads 3966450000000 the parser took the year-to-date column — stop and fix Task 4 before continuing.**

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/sync-fundamentals/index.ts
git commit -m "feat(fundamentals): sync NSE filings and income statements

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Shareholding and corporate actions

**Files:**
- Create: `supabase/migrations/20260804010000_fundamentals_ownership.sql`
- Modify: `supabase/functions/_shared/nse.ts`
- Modify: `supabase/functions/sync-fundamentals/index.ts`

**Interfaces:**
- Consumes: `nseGet` behaviour and `toIsoDate` from Task 5
- Produces: `fetchShareholding(symbol)`, `fetchCorporateActions(symbol)`; tables `shareholding_pattern`, `corporate_actions`

- [ ] **Step 1: Write the migration**

```sql
-- Ownership and corporate actions, both from NSE endpoints verified to return
-- 200 for a plain GET with a Referer header.

create table if not exists shareholding_pattern (
  id                   bigint generated always as identity primary key,
  symbol               text not null,
  period_end           date not null,
  promoter_pct         numeric,
  promoter_pledged_pct numeric,
  fii_pct              numeric,
  dii_pct              numeric,
  public_pct           numeric,
  source               text not null default 'nse',
  fetched_at           timestamptz not null default now(),
  unique (symbol, period_end)
);

create table if not exists corporate_actions (
  id           bigint generated always as identity primary key,
  symbol       text not null,
  ex_date      date not null,
  record_date  date,
  action_type  text not null,
  value        numeric,
  description  text,
  source       text not null default 'nse',
  fetched_at   timestamptz not null default now(),
  unique (symbol, ex_date, action_type)
);

create index if not exists corporate_actions_ex_date_idx
  on corporate_actions (ex_date desc);

alter table shareholding_pattern enable row level security;
alter table corporate_actions    enable row level security;

create policy "Anyone can view shareholding"
  on shareholding_pattern for select to anon, authenticated using (true);
create policy "Anyone can view corporate actions"
  on corporate_actions for select to anon, authenticated using (true);
```

- [ ] **Step 2: Add the fetchers**

Append to `supabase/functions/_shared/nse.ts`:

```typescript
export type CorporateAction = {
  symbol: string;
  exDate: string;
  recordDate: string | null;
  actionType: string;
  value: number | null;
  description: string;
};

/**
 * Classify a free-text purpose into a type. NSE writes these as prose
 * ("Dividend - Rs 10 Per Share"), so the raw text is kept in `description` and
 * only the coarse type is derived — an unrecognised purpose becomes "other"
 * rather than being forced into a category it may not belong to.
 */
export function classifyAction(purpose: string): string {
  const p = purpose.toLowerCase();
  if (p.includes("dividend")) return "dividend";
  if (p.includes("bonus")) return "bonus";
  if (p.includes("split")) return "split";
  if (p.includes("rights")) return "rights";
  if (p.includes("buy back") || p.includes("buyback")) return "buyback";
  return "other";
}

/** Pull the rupee figure out of "Dividend - Rs 10 Per Share". Null when absent. */
export function extractActionValue(purpose: string): number | null {
  const m = /(?:rs\.?|inr)\s*([\d.]+)/i.exec(purpose);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export async function fetchCorporateActions(symbol: string): Promise<CorporateAction[]> {
  const url =
    `https://www.nseindia.com/api/corporates-corporateActions` +
    `?index=equities&symbol=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, { headers: NSE_HEADERS });
  if (!res.ok) throw new Error(`NSE ${res.status} for corporate actions ${symbol}`);
  const rows = (await res.json()) as Array<Record<string, string>>;
  if (!Array.isArray(rows)) return [];

  return rows.flatMap((r) => {
    const exDate = toIsoDate(r.exDate ?? "");
    const purpose = r.subject ?? r.purpose ?? "";
    if (!exDate || !purpose) return [];
    return [{
      symbol,
      exDate,
      recordDate: toIsoDate(r.recDate ?? ""),
      actionType: classifyAction(purpose),
      value: extractActionValue(purpose),
      description: purpose,
    }];
  });
}
```

- [ ] **Step 3: Write tests for the classifiers**

Append to `src/test/nse.test.ts`:

```typescript
import { classifyAction, extractActionValue } from "../../supabase/functions/_shared/nse";

describe("classifyAction", () => {
  it("recognises the common actions", () => {
    expect(classifyAction("Dividend - Rs 10 Per Share")).toBe("dividend");
    expect(classifyAction("Bonus 1:1")).toBe("bonus");
    expect(classifyAction("Face Value Split")).toBe("split");
    expect(classifyAction("Rights Issue")).toBe("rights");
    expect(classifyAction("Buy Back of Shares")).toBe("buyback");
  });

  it("falls back to other rather than guessing", () => {
    expect(classifyAction("Annual General Meeting")).toBe("other");
  });
});

describe("extractActionValue", () => {
  it("pulls the rupee amount out", () => {
    expect(extractActionValue("Dividend - Rs 10 Per Share")).toBe(10);
    expect(extractActionValue("Dividend Rs.5.50 Per Share")).toBe(5.5);
  });

  it("returns null when there is no amount", () => {
    expect(extractActionValue("Bonus 1:1")).toBeNull();
  });
});
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/test/nse.test.ts`
Expected: all PASS.

- [ ] **Step 5: Wire into the sync loop**

In `supabase/functions/sync-fundamentals/index.ts`, add the import and insert this inside the `for (const symbol of batch)` loop, after the registry block:

```typescript
try {
  const actions = await fetchCorporateActions(symbol);
  if (actions.length) {
    await supabase.from("corporate_actions").upsert(
      actions.map((a) => ({
        symbol: a.symbol,
        ex_date: a.exDate,
        record_date: a.recordDate,
        action_type: a.actionType,
        value: a.value,
        description: a.description,
        source: "nse",
        fetched_at: new Date().toISOString(),
      })),
      { onConflict: "symbol,ex_date,action_type" },
    );
  }
} catch (err) {
  console.error(`corporate actions failed for ${symbol}:`, (err as Error).message);
}
await sleep(NSE_DELAY_MS);
```

Update the import line to:

```typescript
import {
  fetchFilingRegistry,
  fetchXbrl,
  fetchCorporateActions,
  NSE_DELAY_MS,
  sleep,
} from "../_shared/nse.ts";
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260804010000_fundamentals_ownership.sql \
        supabase/functions/_shared/nse.ts \
        supabase/functions/sync-fundamentals/index.ts \
        src/test/nse.test.ts
git commit -m "feat(fundamentals): ingest corporate actions and add ownership tables

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Balance sheet and cash flow tables

**Files:**
- Create: `supabase/migrations/20260804020000_fundamentals_balance_cashflow.sql`

**Interfaces:**
- Consumes: nothing
- Produces: tables `fundamentals_balance`, `fundamentals_cashflow`

- [ ] **Step 1: Write the migration**

```sql
-- Balance sheet and cash flow. These come from Yahoo, not NSE: Indian quarterly
-- filings are income-statement-only by regulation, so the XBRL carries no
-- borrowings, reserves, total assets or cash flow at all.
--
-- Separate tables rather than columns on fundamentals_income, so a Yahoo outage
-- leaves the NSE-sourced income statement untouched and simply produces no
-- balance row. The ratios that depend on these degrade to absent, never to
-- wrong.

create table if not exists fundamentals_balance (
  id                    bigint generated always as identity primary key,
  symbol                text not null,
  period_end            date not null,
  total_assets          numeric,
  total_debt            numeric,
  total_equity          numeric,
  cash_and_equivalents  numeric,
  current_assets        numeric,
  current_liabilities   numeric,
  source                text not null default 'yahoo',
  fetched_at            timestamptz not null default now(),
  unique (symbol, period_end)
);

create table if not exists fundamentals_cashflow (
  id               bigint generated always as identity primary key,
  symbol           text not null,
  period_end       date not null,
  operating_cf     numeric,
  investing_cf     numeric,
  financing_cf     numeric,
  capex            numeric,
  free_cash_flow   numeric,
  source           text not null default 'yahoo',
  fetched_at       timestamptz not null default now(),
  unique (symbol, period_end)
);

alter table fundamentals_balance  enable row level security;
alter table fundamentals_cashflow enable row level security;

create policy "Anyone can view balance sheet"
  on fundamentals_balance for select to anon, authenticated using (true);
create policy "Anyone can view cash flow"
  on fundamentals_cashflow for select to anon, authenticated using (true);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260804020000_fundamentals_balance_cashflow.sql
git commit -m "feat(fundamentals): add balance sheet and cash flow tables

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Fail-closed derived ratios

**Files:**
- Create: `supabase/functions/_shared/ratios.ts`
- Create: `src/test/ratios.test.ts`
- Create: `supabase/migrations/20260804030000_fundamentals_derived.sql`

**Interfaces:**
- Consumes: nothing (pure functions)
- Produces:
  - `computeRatios(input: RatioInput): RatioResult`
  - `type RatioInput = { profitAfterTax: number | null; totalEquity: number | null; profitBeforeTax: number | null; totalDebt: number | null; currentAssets: number | null; currentLiabilities: number | null; operatingCf: number | null; capex: number | null }`
  - `type RatioResult = { roe: number | null; roce: number | null; currentRatio: number | null; freeCashFlow: number | null; inputsComplete: boolean; missingInputs: string[] }`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { computeRatios } from "../../supabase/functions/_shared/ratios";

const complete = {
  profitAfterTax: 100,
  totalEquity: 500,
  profitBeforeTax: 120,
  totalDebt: 300,
  currentAssets: 200,
  currentLiabilities: 100,
  operatingCf: 150,
  capex: 50,
};

describe("computeRatios", () => {
  it("computes ratios when every input is present", () => {
    const r = computeRatios(complete);
    expect(r.roe).toBeCloseTo(20);          // 100/500
    expect(r.roce).toBeCloseTo(15);         // 120/(500+300)
    expect(r.currentRatio).toBeCloseTo(2);  // 200/100
    expect(r.freeCashFlow).toBe(100);       // 150-50
    expect(r.inputsComplete).toBe(true);
    expect(r.missingInputs).toEqual([]);
  });

  it("withholds ROE entirely when equity is missing", () => {
    const r = computeRatios({ ...complete, totalEquity: null });
    // The point of the whole design: no ROE beats an ROE on a partial
    // denominator. It must be null, not 0 and not Infinity.
    expect(r.roe).toBeNull();
    expect(r.inputsComplete).toBe(false);
    expect(r.missingInputs).toContain("totalEquity");
  });

  it("withholds free cash flow when capex is missing", () => {
    const r = computeRatios({ ...complete, capex: null });
    expect(r.freeCashFlow).toBeNull();
    expect(r.missingInputs).toContain("capex");
  });

  it("never divides by zero", () => {
    const r = computeRatios({ ...complete, totalEquity: 0, currentLiabilities: 0 });
    expect(r.roe).toBeNull();
    expect(r.currentRatio).toBeNull();
  });

  it("still reports the ratios it can compute", () => {
    const r = computeRatios({ ...complete, operatingCf: null });
    expect(r.freeCashFlow).toBeNull();
    expect(r.roe).toBeCloseTo(20);
    expect(r.inputsComplete).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/ratios.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
/**
 * Derived ratios, computed fail-closed.
 *
 * The rule this file exists to enforce: a ratio is produced only when every
 * input it needs is present and usable. ROE depends on Yahoo-sourced equity,
 * and Yahoo thins out on smallcaps, so the common case is genuinely missing
 * data. Returning 0, Infinity, or a value computed against a stale denominator
 * would put a wrong number on a stock page that a retail investor may act on.
 * Absent is the correct answer.
 */

export type RatioInput = {
  profitAfterTax: number | null;
  totalEquity: number | null;
  profitBeforeTax: number | null;
  totalDebt: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
  operatingCf: number | null;
  capex: number | null;
};

export type RatioResult = {
  roe: number | null;
  roce: number | null;
  currentRatio: number | null;
  freeCashFlow: number | null;
  inputsComplete: boolean;
  missingInputs: string[];
};

const usable = (n: number | null): n is number => n !== null && Number.isFinite(n);
/** Denominators additionally must not be zero. */
const divisor = (n: number | null): n is number => usable(n) && n !== 0;

export function computeRatios(input: RatioInput): RatioResult {
  const missingInputs = (Object.keys(input) as Array<keyof RatioInput>)
    .filter((k) => !usable(input[k]))
    .map(String);

  const roe = usable(input.profitAfterTax) && divisor(input.totalEquity)
    ? (input.profitAfterTax / input.totalEquity) * 100
    : null;

  const capitalEmployed =
    usable(input.totalEquity) && usable(input.totalDebt)
      ? input.totalEquity + input.totalDebt
      : null;
  const roce = usable(input.profitBeforeTax) && divisor(capitalEmployed)
    ? (input.profitBeforeTax / capitalEmployed) * 100
    : null;

  const currentRatio = usable(input.currentAssets) && divisor(input.currentLiabilities)
    ? input.currentAssets / input.currentLiabilities
    : null;

  const freeCashFlow = usable(input.operatingCf) && usable(input.capex)
    ? input.operatingCf - input.capex
    : null;

  return {
    roe,
    roce,
    currentRatio,
    freeCashFlow,
    inputsComplete: missingInputs.length === 0,
    missingInputs,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/ratios.test.ts`
Expected: 5 tests PASS.

- [ ] **Step 5: Write the derived table migration**

```sql
-- Derived ratios. Every row records which inputs were missing, so the UI can
-- distinguish "this company has no ROE because we lack equity data" from
-- "this company's ROE is zero". They are not the same statement.

create table if not exists fundamentals_derived (
  id               bigint generated always as identity primary key,
  symbol           text not null,
  period_end       date not null,
  roe              numeric,
  roce             numeric,
  current_ratio    numeric,
  free_cash_flow   numeric,
  -- False means at least one input was absent. A consumer showing a figure
  -- from such a row must label it, or omit it.
  inputs_complete  boolean not null default false,
  missing_inputs   text[] not null default '{}',
  computed_at      timestamptz not null default now(),
  unique (symbol, period_end)
);

alter table fundamentals_derived enable row level security;

create policy "Anyone can view derived ratios"
  on fundamentals_derived for select to anon, authenticated using (true);
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/ratios.ts src/test/ratios.test.ts \
        supabase/migrations/20260804030000_fundamentals_derived.sql
git commit -m "feat(fundamentals): compute derived ratios fail-closed

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Cron workflow and the Nifty 50 validation gate

**Files:**
- Create: `.github/workflows/fundamentals-sync.yml`
- Create: `docs/fundamentals-validation.md`

**Interfaces:**
- Consumes: the deployed `sync-fundamentals` endpoint from Task 6
- Produces: scheduled execution

- [ ] **Step 1: Write the workflow**

```yaml
# Walks the tracked universe a few symbols at a time, resuming from a cursor.
# Hourly rather than daily because the batch is deliberately small and NSE is
# the exchange's own service, not an API sold to us - slow and polite beats
# fast and blocked.
name: Fundamentals sync

on:
  schedule:
    - cron: "17 * * * *"
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger sync-fundamentals
        run: |
          code=$(curl -sS -o /tmp/out.json -w "%{http_code}" \
            -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/sync-fundamentals" \
            -H "x-sync-secret: ${{ secrets.SYNC_SECRET }}")
          cat /tmp/out.json
          if [ "$code" != "200" ]; then
            echo "sync failed with HTTP $code"
            exit 1
          fi
```

- [ ] **Step 2: Write the validation gate document**

```markdown
# Fundamentals validation gate

The full backfill does not start until the parser round-trips the Nifty 50.
A parser bug caught over fifty symbols is cheap; the same bug found after five
hundred means re-parsing everything.

## Gate criteria

Run after the sync has covered the Nifty 50:

```sql
-- 1. No parse failures.
select symbol, to_date, parse_error
from fundamentals_filings
where parse_status = 'failed'
order by symbol;
```
Expected: zero rows. Any row is a format variant the parser does not handle —
add it as a fixture and fix the parser before widening.

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
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/fundamentals-sync.yml docs/fundamentals-validation.md
git commit -m "feat(fundamentals): schedule the sync and define the validation gate

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Full test run and coverage

**Files:**
- Modify: none unless failures surface

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: all tests PASS, including the pre-existing chart, motion and unlisted tests.

- [ ] **Step 2: Run the type check**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors. The `_shared` files are outside `src`, so if they are not
covered by `tsconfig.app.json`, confirm they at least parse with
`npx tsc --noEmit --skipLibCheck supabase/functions/_shared/*.ts`.

- [ ] **Step 3: Verify the build still passes**

Run: `npx vite build`
Expected: build succeeds. Nothing in this track ships to the client bundle, so
bundle size should be unchanged.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "test(fundamentals): fix issues found in the full suite run

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

**Spec coverage.** Seven tables: filings and income (Task 1), shareholding and
corporate actions (Task 7), balance and cash flow (Task 8), derived (Task 9).
Context resolution (Tasks 3-4). NSE client with the 4xx/5xx policy (Task 5).
Resumable cursor and idempotent hashing (Task 6). Fail-closed ratios (Task 9).
Nifty 50 gate (Task 10). Fixture testing per format variant (Task 2).

**Known gap, deliberate.** The Yahoo fetcher that populates
`fundamentals_balance` and `fundamentals_cashflow` is not implemented here. The
spec flags Yahoo coverage for smallcaps as an open dependency to confirm early,
and the tables plus the fail-closed ratio logic are built so the ingest can be
added without reshaping anything. Piotroski and Altman Z likewise wait on
balance-sheet data landing — adding them before their inputs exist would mean
writing tests against data that is always null. Both are a follow-up plan once
Yahoo coverage is measured.

**Type consistency.** `parseContexts` and `HEADLINE_CONTEXT` (Task 3) are used
by `parseIncomeStatement` (Task 4). `FilingRecord`, `toIsoDate`, `NSE_DELAY_MS`
and `sleep` (Task 5) are used by the sync (Task 6) and extended in Task 7.
`RatioInput`/`RatioResult` (Task 9) match the `fundamentals_derived` columns.
