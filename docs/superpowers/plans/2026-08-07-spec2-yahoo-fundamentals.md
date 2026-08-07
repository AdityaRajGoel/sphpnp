# Yahoo Balance Sheet, Cash Flow and Derived Ratios (Spec 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate `fundamentals_balance` and `fundamentals_cashflow` from Yahoo, compute `fundamentals_derived` via the already-written `computeRatios`, and surface ROE / ROCE / current ratio / free cash flow on `/stock/:symbol`.

**Architecture:** A new `sync-fundamentals-yahoo` edge function on its own hourly cron and its own cursor, deliberately separate from `sync-fundamentals`. That function was killed once by `WORKER_RESOURCE_LIMIT` and had `BATCH_SIZE` cut from 5 to 2; adding two more HTTP calls and a parse per symbol to it would push it back over. Separation also satisfies the Track E design requirement that a Yahoo outage must not stop income ingestion.

**Tech Stack:** Deno edge functions, Supabase JS, Yahoo `quoteSummary` v10 (crumb-gated), vitest for pure logic.

## Global Constraints

- **Type-check with `npx tsc -p tsconfig.app.json --noEmit --pretty false`.** Plain `npx tsc --noEmit` checks **nothing** here — the root `tsconfig.json` is `"files": []` plus project references, so it exits 0 having examined zero files. `npx vite build` does not type-check either. Note this only covers `src/`; **nothing type-checks `supabase/functions/`**, so edge-function correctness is proven by deploying and observing rows, not by a green command.
- **Never run `npm run build`** — its `postbuild` runs `scripts/submit-indexnow.js`, which pings live search engines. Use `npx vite build`.
- **No new dependencies.**
- **Never write a ratio from mismatched periods.** See the period-alignment section — this is the correctness centre of the plan.
- **Every fact row records `source` and `fetched_at`**; `fundamentals_derived` records `inputs_complete`, `missing_inputs`, `unusable_inputs`.
- **Reuse the observation log.** `SyncObservation` (`_shared/observation.ts`) opens a row before work and closes it after, counting rows written per table. The new function uses it from the first commit — the whole reason it exists is that a sync writing nothing looked identical to a sync working.

---

## The correctness centre: period alignment

`computeRatios` takes inputs from two independent sources:

| Input | Source | Table |
| --- | --- | --- |
| `profitAfterTax`, `profitBeforeTax` | NSE XBRL | `fundamentals_income` |
| `totalEquity`, `totalDebt`, `currentAssets`, `currentLiabilities` | Yahoo | `fundamentals_balance` |
| `operatingCf`, `capex` | Yahoo | `fundamentals_cashflow` |

`fundamentals_income.period_end` is the NSE registry's `toDate`. Yahoo's `balanceSheetHistoryQuarterly[].endDate` is its own quarter-end. **They are not guaranteed to be the same date** — a company's filing may state 30 September while Yahoo records 30 September of a different fiscal convention, or be off by a few days.

Pairing a Q2 profit with a Q3 equity produces a plausible-looking ROE that is simply wrong. On a SEBI-registered broker's page that is the same class of defect as the consolidated/standalone mixing trap Spec 1 exists to prevent, and the same class as the market-cap unit error the Spec 1 final review caught.

**Rule: join on exact `period_end` equality only.** If no exact match exists for a period, write no derived row for it. Do not fuzz, round to quarter-end, or take the nearest. A missing ratio is honest; a wrong one is not. Task 4's tests assert this directly.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `supabase/functions/_shared/yahoo.ts` | Crumb/cookie auth + `quoteSummary` fetch + pure parsers |
| `src/test/yahoo.test.ts` | Tests for the pure parsers |
| `supabase/functions/_shared/period.ts` | Pure period-alignment join |
| `src/test/period.test.ts` | Tests for the join, including the mismatch trap |
| `supabase/functions/sync-fundamentals-yahoo/index.ts` | The new function |
| `.github/workflows/fundamentals-yahoo-sync.yml` | Its cron |
| `supabase/config.toml` | `verify_jwt = false` for the new function |
| `src/components/stock/RatiosPanel.tsx` | Ratio display with withheld-value handling |
| `src/hooks/useStockFundamentals.ts` | Extended to read `fundamentals_derived` |

---

### Task 1: Extract the Yahoo client

**Files:**
- Create: `supabase/functions/_shared/yahoo.ts`
- Test: `src/test/yahoo.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `getYahooCrumb(): Promise<{ crumb: string; cookie: string } | null>`
  - `fetchQuoteSummary(symbol: string, modules: string): Promise<unknown | null>`
  - `type BalanceRow = { periodEnd: string; totalAssets: number | null; totalDebt: number | null; totalEquity: number | null; cashAndEquivalents: number | null; currentAssets: number | null; currentLiabilities: number | null }`
  - `type CashflowRow = { periodEnd: string; operatingCf: number | null; investingCf: number | null; financingCf: number | null; capex: number | null; freeCashFlow: number | null }`
  - `parseBalanceSheet(json: unknown): BalanceRow[]`
  - `parseCashflow(json: unknown): CashflowRow[]`
  - `toYahooSymbol(nseSymbol: string): string`

- [ ] **Step 1: Write the failing test**

The crumb flow and network calls are not tested — they are I/O. The parsers are pure and carry the tests.

```ts
// src/test/yahoo.test.ts
import { describe, it, expect } from "vitest";
import {
  parseBalanceSheet, parseCashflow, toYahooSymbol,
} from "../../supabase/functions/_shared/yahoo";

// Yahoo wraps every figure as { raw, fmt, longFmt } and omits the key entirely
// when it has no value - it does not send null. Both shapes appear here.
const balanceJson = {
  quoteSummary: { result: [{ balanceSheetHistoryQuarterly: { balanceSheetStatements: [
    {
      endDate: { raw: 1735603200 },              // 2024-12-31
      totalAssets: { raw: 1750000000000 },
      totalLiab: { raw: 900000000000 },
      totalStockholderEquity: { raw: 850000000000 },
      cash: { raw: 120000000000 },
      totalCurrentAssets: { raw: 400000000000 },
      totalCurrentLiabilities: { raw: 300000000000 },
      shortLongTermDebt: { raw: 100000000000 },
      longTermDebt: { raw: 250000000000 },
    },
    { endDate: { raw: 1727654400 } },            // 2024-09-30, everything absent
  ] } }] },
};

const cashflowJson = {
  quoteSummary: { result: [{ cashflowStatementHistoryQuarterly: { cashflowStatements: [
    {
      endDate: { raw: 1735603200 },
      totalCashFromOperatingActivities: { raw: 90000000000 },
      totalCashflowsFromInvestingActivities: { raw: -40000000000 },
      totalCashFromFinancingActivities: { raw: -20000000000 },
      capitalExpenditures: { raw: -30000000000 },
    },
  ] } }] },
};

describe("toYahooSymbol", () => {
  it("appends .NS to a bare NSE symbol", () => {
    expect(toYahooSymbol("RELIANCE")).toBe("RELIANCE.NS");
  });
  it("leaves an already-suffixed symbol alone", () => {
    expect(toYahooSymbol("RELIANCE.NS")).toBe("RELIANCE.NS");
  });
  it("does not mangle an ampersand symbol", () => {
    expect(toYahooSymbol("M&M")).toBe("M&M.NS");
  });
});

describe("parseBalanceSheet", () => {
  it("maps a full statement to an ISO period end", () => {
    const rows = parseBalanceSheet(balanceJson);
    expect(rows[0].periodEnd).toBe("2024-12-31");
    expect(rows[0].totalEquity).toBe(850000000000);
    expect(rows[0].currentAssets).toBe(400000000000);
  });

  // Yahoo has no single "total debt" field - it must be summed, and a present
  // short-term with an absent long-term must not silently become the total.
  it("sums short and long term debt", () => {
    expect(parseBalanceSheet(balanceJson)[0].totalDebt).toBe(350000000000);
  });

  it("returns null - never 0 - for an absent figure", () => {
    const r = parseBalanceSheet(balanceJson)[1];
    expect(r.totalEquity).toBeNull();
    expect(r.totalDebt).toBeNull();
    expect(r.currentAssets).toBeNull();
  });

  it("returns an empty array for a malformed payload", () => {
    expect(parseBalanceSheet({})).toEqual([]);
    expect(parseBalanceSheet(null)).toEqual([]);
    expect(parseBalanceSheet({ quoteSummary: { result: [] } })).toEqual([]);
  });
});

describe("parseCashflow", () => {
  it("maps operating, investing and financing flows", () => {
    const r = parseCashflow(cashflowJson)[0];
    expect(r.periodEnd).toBe("2024-12-31");
    expect(r.operatingCf).toBe(90000000000);
    expect(r.investingCf).toBe(-40000000000);
  });

  // Yahoo reports capex as a negative outflow. computeRatios subtracts capex
  // from operating cash flow, so it must receive the magnitude - passing the
  // signed value would ADD the spend and overstate free cash flow.
  it("normalises capex to a positive magnitude", () => {
    expect(parseCashflow(cashflowJson)[0].capex).toBe(30000000000);
  });

  it("derives free cash flow as operating minus capex", () => {
    expect(parseCashflow(cashflowJson)[0].freeCashFlow).toBe(60000000000);
  });

  it("returns an empty array for a malformed payload", () => {
    expect(parseCashflow({})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/yahoo.test.ts`
Expected: FAIL — `Failed to resolve import ".../_shared/yahoo"`

- [ ] **Step 3: Write the implementation**

```ts
// supabase/functions/_shared/yahoo.ts
/**
 * Yahoo Finance access for the fundamentals sync.
 *
 * The crumb flow is lifted from ai-stock-analysis, which has been using it in
 * production successfully - quoteSummary is crumb-gated and returns 429 without
 * a cookie+crumb pair. Extracted here so both callers share one implementation
 * rather than drifting.
 */

const YAHOO_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const CRUMB_TTL_MS = 30 * 60 * 1000;
let crumbCache: { crumb: string; cookie: string; ts: number } | null = null;

export async function getYahooCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  try {
    if (crumbCache && Date.now() - crumbCache.ts < CRUMB_TTL_MS) {
      return { crumb: crumbCache.crumb, cookie: crumbCache.cookie };
    }
    const cookieRes = await fetch("https://fc.yahoo.com/", { headers: { "User-Agent": YAHOO_UA } });
    const cookie = (cookieRes.headers.get("set-cookie") || "").split(";")[0];
    if (!cookie) return null;
    const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": YAHOO_UA, Cookie: cookie },
    });
    const crumb = (await crumbRes.text()).trim();
    // A login wall returns HTML; a valid crumb is a short opaque token.
    if (!crumb || crumb.includes("<") || crumb.length > 40) return null;
    crumbCache = { crumb, cookie, ts: Date.now() };
    return { crumb, cookie };
  } catch {
    return null;
  }
}

/** NSE ticker to Yahoo ticker. Ampersands are left intact; encoding is the caller's job. */
export function toYahooSymbol(nseSymbol: string): string {
  return nseSymbol.includes(".") ? nseSymbol : `${nseSymbol}.NS`;
}

export async function fetchQuoteSummary(
  symbol: string,
  modules: string,
): Promise<unknown | null> {
  const cc = await getYahooCrumb();
  const url =
    `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}` +
    `?modules=${encodeURIComponent(modules)}${cc ? `&crumb=${encodeURIComponent(cc.crumb)}` : ""}`;
  const res = await fetch(url, {
    headers: { "User-Agent": YAHOO_UA, ...(cc ? { Cookie: cc.cookie } : {}) },
  });
  if (!res.ok) return null;
  return await res.json();
}

export type BalanceRow = {
  periodEnd: string;
  totalAssets: number | null;
  totalDebt: number | null;
  totalEquity: number | null;
  cashAndEquivalents: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
};

export type CashflowRow = {
  periodEnd: string;
  operatingCf: number | null;
  investingCf: number | null;
  financingCf: number | null;
  capex: number | null;
  freeCashFlow: number | null;
};

/** Yahoo wraps every figure as { raw, fmt } and OMITS the key when absent. */
const num = (x: unknown): number | null => {
  const raw = (x as { raw?: unknown } | undefined)?.raw;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
};

/** Epoch seconds to an ISO date, UTC. Yahoo dates are day-granular. */
const toIso = (x: unknown): string | null => {
  const raw = num(x);
  if (raw === null) return null;
  const d = new Date(raw * 1000);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

const statements = (json: unknown, module: string, key: string): Array<Record<string, unknown>> => {
  const result = (json as { quoteSummary?: { result?: unknown[] } })?.quoteSummary?.result;
  if (!Array.isArray(result) || result.length === 0) return [];
  const mod = (result[0] as Record<string, unknown>)[module] as Record<string, unknown> | undefined;
  const list = mod?.[key];
  return Array.isArray(list) ? (list as Array<Record<string, unknown>>) : [];
};

export function parseBalanceSheet(json: unknown): BalanceRow[] {
  return statements(json, "balanceSheetHistoryQuarterly", "balanceSheetStatements")
    .flatMap((s) => {
      const periodEnd = toIso(s.endDate);
      if (!periodEnd) return [];
      // Yahoo has no single total-debt field. Sum the two, but only when at
      // least one is present - otherwise a fully absent debt figure would
      // become 0 and read as "this company has no debt".
      const shortTerm = num(s.shortLongTermDebt);
      const longTerm = num(s.longTermDebt);
      const totalDebt =
        shortTerm === null && longTerm === null ? null : (shortTerm ?? 0) + (longTerm ?? 0);
      return [{
        periodEnd,
        totalAssets: num(s.totalAssets),
        totalDebt,
        totalEquity: num(s.totalStockholderEquity),
        cashAndEquivalents: num(s.cash),
        currentAssets: num(s.totalCurrentAssets),
        currentLiabilities: num(s.totalCurrentLiabilities),
      }];
    });
}

export function parseCashflow(json: unknown): CashflowRow[] {
  return statements(json, "cashflowStatementHistoryQuarterly", "cashflowStatements")
    .flatMap((s) => {
      const periodEnd = toIso(s.endDate);
      if (!periodEnd) return [];
      const operatingCf = num(s.totalCashFromOperatingActivities);
      // Yahoo reports capex as a negative outflow. computeRatios subtracts it,
      // so it must be a magnitude - passing -30000 would ADD the spend.
      const rawCapex = num(s.capitalExpenditures);
      const capex = rawCapex === null ? null : Math.abs(rawCapex);
      const freeCashFlow =
        operatingCf === null || capex === null ? null : operatingCf - capex;
      return [{
        periodEnd,
        operatingCf,
        investingCf: num(s.totalCashflowsFromInvestingActivities),
        financingCf: num(s.totalCashFromFinancingActivities),
        capex,
        freeCashFlow,
      }];
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/yahoo.test.ts`
Expected: PASS, 12 tests

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/yahoo.ts src/test/yahoo.test.ts
git commit -m "feat(fundamentals): add the Yahoo balance sheet and cash flow client"
```

---

### Task 2: The period-alignment join

**Files:**
- Create: `supabase/functions/_shared/period.ts`
- Test: `src/test/period.test.ts`

**Interfaces:**
- Consumes: `RatioInput` from `_shared/ratios.ts`.
- Produces: `alignPeriods(income, balance, cashflow): Array<{ periodEnd: string; input: RatioInput }>`

- [ ] **Step 1: Write the failing test**

```ts
// src/test/period.test.ts
import { describe, it, expect } from "vitest";
import { alignPeriods } from "../../supabase/functions/_shared/period";

const inc = (period_end: string, pat = 100, pbt = 130) =>
  ({ period_end, profit_after_tax: pat, profit_before_tax: pbt });
const bal = (period_end: string, eq = 500) =>
  ({ period_end, total_equity: eq, total_debt: 200, current_assets: 300, current_liabilities: 150 });
const cf = (period_end: string, op = 90) =>
  ({ period_end, operating_cf: op, capex: 30 });

describe("alignPeriods", () => {
  it("pairs rows that share an exact period_end", () => {
    const out = alignPeriods([inc("2024-12-31")], [bal("2024-12-31")], [cf("2024-12-31")]);
    expect(out).toHaveLength(1);
    expect(out[0].periodEnd).toBe("2024-12-31");
    expect(out[0].input.profitAfterTax).toBe(100);
    expect(out[0].input.totalEquity).toBe(500);
    expect(out[0].input.operatingCf).toBe(90);
  });

  // THE TRAP. NSE's filing toDate and Yahoo's quarter endDate can differ by a
  // few days. Pairing a Q2 profit with a Q3 equity yields a plausible, wrong
  // ROE - the same class of defect as mixing consolidated with standalone.
  it("never pairs periods that differ, even by one day", () => {
    const out = alignPeriods([inc("2024-12-31")], [bal("2024-12-30")], [cf("2024-12-31")]);
    expect(out).toHaveLength(0);
  });

  it("emits nothing when the balance sheet is missing for a period", () => {
    expect(alignPeriods([inc("2024-12-31")], [], [cf("2024-12-31")])).toHaveLength(0);
  });

  it("emits nothing when cash flow is missing for a period", () => {
    expect(alignPeriods([inc("2024-12-31")], [bal("2024-12-31")], [])).toHaveLength(0);
  });

  it("aligns only the periods present in all three, ignoring the rest", () => {
    const out = alignPeriods(
      [inc("2024-12-31"), inc("2024-09-30"), inc("2024-06-30")],
      [bal("2024-12-31"), bal("2024-09-30")],
      [cf("2024-12-31")],
    );
    expect(out.map((x) => x.periodEnd)).toEqual(["2024-12-31"]);
  });

  it("passes nulls through rather than substituting zero", () => {
    const out = alignPeriods(
      [{ period_end: "2024-12-31", profit_after_tax: null, profit_before_tax: null }],
      [{ period_end: "2024-12-31", total_equity: null, total_debt: null, current_assets: null, current_liabilities: null }],
      [{ period_end: "2024-12-31", operating_cf: null, capex: null }],
    );
    expect(out[0].input.profitAfterTax).toBeNull();
    expect(out[0].input.totalEquity).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/period.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// supabase/functions/_shared/period.ts
import type { RatioInput } from "./ratios.ts";

type IncomeLike = {
  period_end: string;
  profit_after_tax: number | null;
  profit_before_tax: number | null;
};
type BalanceLike = {
  period_end: string;
  total_equity: number | null;
  total_debt: number | null;
  current_assets: number | null;
  current_liabilities: number | null;
};
type CashflowLike = {
  period_end: string;
  operating_cf: number | null;
  capex: number | null;
};

/**
 * Build ratio inputs by joining the three sources on EXACT period_end.
 *
 * The income statement comes from NSE XBRL; the balance sheet and cash flow
 * come from Yahoo. Their period ends are independently produced and are not
 * guaranteed to agree. Pairing a quarter's profit with a different quarter's
 * equity produces an ROE that looks entirely reasonable and is wrong, which on
 * a SEBI-registered broker's page is worse than showing nothing.
 *
 * So: exact equality only. No rounding to quarter end, no nearest-match, no
 * tolerance window. A period that does not line up across all three sources
 * yields no derived row, and the page renders the ratio as unavailable.
 */
export function alignPeriods(
  income: IncomeLike[],
  balance: BalanceLike[],
  cashflow: CashflowLike[],
): Array<{ periodEnd: string; input: RatioInput }> {
  const balByPeriod = new Map(balance.map((b) => [b.period_end, b]));
  const cfByPeriod = new Map(cashflow.map((c) => [c.period_end, c]));

  return income.flatMap((i) => {
    const b = balByPeriod.get(i.period_end);
    const c = cfByPeriod.get(i.period_end);
    if (!b || !c) return [];
    return [{
      periodEnd: i.period_end,
      input: {
        profitAfterTax: i.profit_after_tax,
        profitBeforeTax: i.profit_before_tax,
        totalEquity: b.total_equity,
        totalDebt: b.total_debt,
        currentAssets: b.current_assets,
        currentLiabilities: b.current_liabilities,
        operatingCf: c.operating_cf,
        capex: c.capex,
      },
    }];
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/period.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/period.ts src/test/period.test.ts
git commit -m "feat(fundamentals): join ratio inputs on exact period end only"
```

---

### Task 3: The sync function

**Files:**
- Create: `supabase/functions/sync-fundamentals-yahoo/index.ts`
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes: `_shared/yahoo.ts`, `_shared/period.ts`, `_shared/ratios.ts`, `_shared/observation.ts`.
- Produces: an edge function guarded by `SYNC_SECRET`, returning
  `{ ok, symbols, balanceRows, cashflowRows, derivedRows, yahooFailed }`.

- [ ] **Step 1: Write the function**

Model it on `sync-fundamentals/index.ts` — read that file first and match its structure: the `SYNC_SECRET` guard, the `screener_stocks` universe read, the `sync_cursors` cursor (use job name `fundamentals-yahoo`, distinct from `fundamentals`), per-symbol cursor advance, and `SyncObservation` opened before the loop and closed after.

Requirements specific to this function:

- `BATCH_SIZE = 5`. Yahoo returns balance sheet and cash flow in **one** `quoteSummary` call per symbol, so a symbol costs one HTTP round trip and two small parses — far cheaper than the XBRL sync's per-filing document fetch and regex parse. Start at 5 and lower it only if `WORKER_RESOURCE_LIMIT` appears in the run log.
- Request both modules together: `balanceSheetHistoryQuarterly,cashflowStatementHistoryQuarterly`.
- A Yahoo failure for one symbol must not abort the batch. Count it via `observation.recordFailure("yahoo", 1)` and continue, mirroring how the XBRL sync treats a registry failure.
- Upsert balance rows on `(symbol, period_end)`, cash flow rows on `(symbol, period_end)`.
- **Check `.error` on every write.** postgrest-js resolves with an error object rather than throwing, so a bare try/catch catches nothing. That exact pattern silently killed the `corporate_actions` writes for two commits and a deploy.
- **Select one reporting basis before aligning — this is mandatory.** `fundamentals_income` is unique on `(symbol, period_end, is_consolidated)`, so a symbol routinely holds **two** rows per period: consolidated and standalone. Measured on live data: 95 of 204 rows are duplicate `symbol + period_end` pairs. `fundamentals_derived` is unique on `(symbol, period_end)` — one row only.

  Passing raw income rows into `alignPeriods` therefore produces two derived rows per period that collide on the unique key, and whichever lands last wins arbitrarily. The deeper problem is that **Yahoo reports consolidated figures**, so a standalone profit paired with Yahoo's consolidated equity is exactly the cross-basis mismatch this plan exists to prevent — arriving through a different door than the period-alignment guard.

  Filter per symbol before calling `alignPeriods`: prefer `is_consolidated = true` rows; fall back to standalone only when the symbol has no consolidated rows at all. Never mix the two bases within one symbol. Record the basis used in the observation `detail` so a wrong pairing is diagnosable later. There is no shared basis selector available to edge functions — `selectBasis` lives in `src/lib/fundamentals.ts`, which is frontend code — so implement the filter inline and keep it small.

- After writing both, read this symbol's `fundamentals_income` rows, apply the basis filter above, call `alignPeriods`, call `computeRatios` per aligned period, and upsert `fundamentals_derived` on `(symbol, period_end)` with `roe`, `roce`, `current_ratio`, `free_cash_flow`, `inputs_complete`, `missing_inputs`, `unusable_inputs`.
- Record every write through `observation.recordWrite(table, n)`.
- Return 500 when every symbol in the batch failed Yahoo — total blockage is an outage, not a partial, exactly as `blockedOut` works in the XBRL sync.

- [ ] **Step 2: Declare `verify_jwt`**

Add to `supabase/config.toml`, alongside the existing entries:

```toml
[functions.sync-fundamentals-yahoo]
verify_jwt = false
```

This is not optional. Two functions were already running in production with verification off but undeclared, and the first deploy from a clean checkout would have applied the default `true` and had the gateway reject the workflow's calls before the function ran.

- [ ] **Step 3: Deploy and verify against real data**

```bash
npx supabase functions deploy sync-fundamentals-yahoo --project-ref zbkjbbujsdlpujotgltm
```

Then invoke it once and confirm rows land:

```bash
curl -sS -X POST "https://zbkjbbujsdlpujotgltm.supabase.co/functions/v1/sync-fundamentals-yahoo" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" -H "x-sync-secret: $MARKET_SYNC_SECRET"
```

Nothing type-checks `supabase/functions/`, so this deploy-and-observe step **is** the verification. Confirm non-zero counts in `fundamentals_balance`, `fundamentals_cashflow`, and `fundamentals_derived`, and a closed `sync_observations` row with per-table write counts.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/sync-fundamentals-yahoo/index.ts supabase/config.toml
git commit -m "feat(fundamentals): sync Yahoo balance sheet, cash flow and derived ratios"
```

---

### Task 4: The workflow

**Files:**
- Create: `.github/workflows/fundamentals-yahoo-sync.yml`

- [ ] **Step 1: Write the workflow**

Copy `.github/workflows/fundamentals-sync.yml` and adapt. Keep: `permissions: {}`, `workflow_dispatch: {}`, the `SUPABASE_ANON_KEY` + `MARKET_SYNC_SECRET` secrets, the response-body echo, and the `[ "$code" = "200" ] || exit 1` gate.

Change: the cron to `"37 * * * *"` so it does not collide with the XBRL sync at `:17`, the endpoint to `sync-fundamentals-yahoo`, and the warning annotation to read `yahooFailed` instead of `registryFailed`.

**GitHub Actions `schedule` fires only from the default branch.** The XBRL sync silently never ran for its entire life because its workflow lived only on a feature branch. This one must reach `main` before it will ever fire.

- [ ] **Step 2: Verify it runs**

Push to `main`, then dispatch it manually and confirm a green run whose body shows non-zero `derivedRows`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/fundamentals-yahoo-sync.yml
git commit -m "ci(fundamentals): schedule the Yahoo sync at :37"
```

---

### Task 5: Surface the ratios

**Files:**
- Create: `src/components/stock/RatiosPanel.tsx`
- Modify: `src/hooks/useStockFundamentals.ts`
- Modify: `src/pages/StockPage.tsx`

**Interfaces:**
- Produces: `type DerivedRow = { period_end: string; roe: number | null; roce: number | null; current_ratio: number | null; free_cash_flow: number | null; inputs_complete: boolean; missing_inputs: string[]; unusable_inputs: string[] }`, added to `StockFundamentalsState` as `derived: DerivedRow[]`.

- [ ] **Step 1: Extend the hook**

Add `fundamentals_derived` to the existing `Promise.all` — it is independent of the other queries and must not become a fourth sequential round trip. Order by `period_end` descending, limit 12. Check `.error` as the others do.

- [ ] **Step 2: Write the panel**

Spec 1 deliberately omitted these rows because nothing populated them, and a permanent "Not available" on every stock is noise rather than honesty. Now that they exist, they render — and the withheld-value treatment finally earns its keep, because `missing_inputs` and `unusable_inputs` carry real reasons.

Follow `IncomeStatementTable.tsx` exactly for structure, motion (`revealSection`, `revealItem`), and the `toCell` treatment. Render ROE and ROCE as percentages, current ratio to two decimals, free cash flow through `formatINR`.

Distinguish the two withheld cases, because they mean different things:
- a name in `missing_inputs` → "not reported"
- a name in `unusable_inputs` → the denominator was present but zero or negative, so the ratio is undefined rather than unknown

- [ ] **Step 3: Mount it**

In `StockPage.tsx`, render `<RatiosPanel derived={s.derived} />` inside the `ready` branch, after `IncomeStatementTable`. Do not add a new `data-stock-state` value — the prerender assertion asserts on the existing four and adding a fifth would silently weaken it.

- [ ] **Step 4: Verify**

```bash
npx tsc -p tsconfig.app.json --noEmit --pretty false   # must exit 0
npx vitest run                                          # must stay green
npx vite build                                          # must succeed
```

Then run the prerender and confirm a covered symbol's HTML contains a rendered ratio:

```bash
node scripts/prerender.js
grep -c 'Return on equity' dist/stock/ALKEM.html
```

- [ ] **Step 5: Commit**

```bash
git add src/components/stock/RatiosPanel.tsx src/hooks/useStockFundamentals.ts src/pages/StockPage.tsx
git commit -m "feat(stock-page): surface ROE, ROCE, current ratio and free cash flow"
```

---

## Self-Review

**Spec coverage:** Yahoo as the balance/cashflow source → Task 1. Derived ratios computed, never fetched → Task 3. `source`/`fetched_at` provenance → Task 3 (column defaults already `'yahoo'`). `inputs_complete` + `missing_inputs` withheld-ratio contract → Tasks 3 and 5. "Yahoo unavailable: income statement still ingests" → satisfied structurally by the separate function. Derived-ratio tests asserting `inputs_complete = false` when an input is withheld → already covered by the existing 12 `ratios.test.ts` tests, which is why Task 3 adds none.

**Deliberate omissions:** No test for the crumb flow or the network calls — they are I/O against a third party, and the pure parsers carry the value. No shareholding-pattern ingestion; that table stays empty and is out of scope.

**Type consistency:** `BalanceRow`/`CashflowRow` (Task 1) feed the writers in Task 3. `alignPeriods` (Task 2) returns `RatioInput` exactly as `computeRatios` consumes it. `DerivedRow` (Task 5) mirrors the `fundamentals_derived` columns.

**Sequencing:** Task 5 needs Task 3 to have written at least one derived row, or the panel renders entirely withheld. Tasks 1 and 2 are independent of each other and can run in parallel.
