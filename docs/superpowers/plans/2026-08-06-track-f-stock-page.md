# Stock Fundamentals Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/stock/:symbol`, a prerendered per-symbol page rendering the quarterly income statement, XBRL-native ratios, and corporate-action history for the ~159 symbols in `screener_stocks`.

**Architecture:** The page fetches from Supabase on mount exactly like every other page in this app; puppeteer captures the hydrated DOM at build time. One data path, no build-time injection. Route lists for prerender and sitemap are derived from `screener_stocks` at build time by one shared module, and both fail closed on an empty fetch.

**Tech Stack:** React 18 + Vite + TypeScript, Tailwind + shadcn/ui, `motion` v12 via `src/lib/motion.ts` tokens, Supabase JS client, vitest, puppeteer (prerender).

## Global Constraints

- **No new dependencies.** Everything needed is installed: `cmdk`, `vaul`, `motion`, `lucide-react`, shadcn primitives.
- **Motion only via `src/lib/motion.ts`.** Use `revealSection`, `revealItem`, `DURATION`, `EASE_OUT`. Never hardcode a duration or cubic-bezier — the July motion sweep exists to prevent exactly that.
- **No chart on this page.** Importing anything that pulls `chart-vendor` (113.9 kB gzip) is out of scope.
- **Never render `null` as `0` or a bare dash.** A null financial figure renders "Not available" with a reason.
- **Never mix consolidated and standalone rows in one table.**
- **Fundamentals tables are absent from `src/integrations/supabase/types.ts`.** Use the established cast: `supabase.from("fundamentals_income" as never) as ReturnType<typeof supabase.from>`. See `src/components/admin/MarketDataManager.tsx:146` for the precedent.
- **Data may be sparse.** The backfill runs ~2 symbols/hour; most symbols have no rows yet. "Not yet synced" is a first-class state, not an error.
- **Never run `npm run build`** — its `postbuild` pings live search engines via `scripts/submit-indexnow.js`. Use `npx vite build`.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/fundamentals.ts` | Pure: basis selection, null→display mapping, Indian number formatting |
| `src/test/fundamentals.test.ts` | Tests for the above |
| `src/hooks/useStockFundamentals.ts` | Data access: one symbol's screener row, income rows, corporate actions, latest filing |
| `src/components/stock/IncomeStatementTable.tsx` | Quarterly table, quarters as columns |
| `src/components/stock/CorporateActionsList.tsx` | Ex-date ordered action history |
| `src/components/stock/StockProvenance.tsx` | Filing link, filing date, audited flag |
| `src/components/stock/SymbolSwitcher.tsx` | ⌘K palette over the covered universe |
| `src/pages/StockPage.tsx` | Composition, SEO, 404, loading/empty/error states |
| `scripts/lib/stock-routes.mjs` | Shared build-time route derivation, fails closed |
| `scripts/prerender.js` | Modified: consume derived routes, assert content, fix sendFile |
| `scripts/generate-sitemap.js` | Modified: consume derived routes |
| `src/App.tsx` | Modified: lazy route registration |

---

### Task 1: Pure fundamentals logic

**Files:**
- Create: `src/lib/fundamentals.ts`
- Test: `src/test/fundamentals.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type IncomeRow = { symbol: string; period_end: string; is_consolidated: boolean; revenue: number | null; other_income: number | null; total_income: number | null; total_expenses: number | null; profit_before_tax: number | null; profit_after_tax: number | null; basic_eps: number | null; diluted_eps: number | null; debt_equity_ratio: number | null; debt_service_coverage_ratio: number | null }`
  - `selectBasis(rows: IncomeRow[]): { basis: "consolidated" | "standalone" | null; rows: IncomeRow[]; bothAvailable: boolean }`
  - `formatINR(value: number | null): string`
  - `formatRatio(value: number | null): string`
  - `type Cell = { kind: "value"; text: string } | { kind: "missing"; reason: string }`
  - `toCell(value: number | null, format: (n: number) => string): Cell`

- [ ] **Step 1: Write the failing test**

```ts
// src/test/fundamentals.test.ts
import { describe, it, expect } from "vitest";
import {
  selectBasis, formatINR, formatRatio, toCell, type IncomeRow,
} from "../lib/fundamentals";

const row = (over: Partial<IncomeRow> = {}): IncomeRow => ({
  symbol: "RELIANCE", period_end: "2024-12-31", is_consolidated: true,
  revenue: 1282600000000, other_income: null, total_income: null,
  total_expenses: null, profit_before_tax: null, profit_after_tax: null,
  basic_eps: 6.44, diluted_eps: 6.44, debt_equity_ratio: 0.41,
  debt_service_coverage_ratio: null, ...over,
});

describe("selectBasis", () => {
  it("prefers consolidated when both bases exist", () => {
    const r = selectBasis([
      row({ period_end: "2024-12-31", is_consolidated: true, revenue: 100 }),
      row({ period_end: "2024-12-31", is_consolidated: false, revenue: 90 }),
    ]);
    expect(r.basis).toBe("consolidated");
    expect(r.rows.map((x) => x.revenue)).toEqual([100]);
    expect(r.bothAvailable).toBe(true);
  });

  // The mixing trap: a naive query orders by period_end and interleaves both
  // bases into what reads as a revenue trend and is not one.
  it("never interleaves the two bases", () => {
    const r = selectBasis([
      row({ period_end: "2024-12-31", is_consolidated: true, revenue: 100 }),
      row({ period_end: "2024-09-30", is_consolidated: false, revenue: 90 }),
      row({ period_end: "2024-06-30", is_consolidated: true, revenue: 80 }),
    ]);
    expect(r.rows.every((x) => x.is_consolidated)).toBe(true);
  });

  it("falls back to standalone when no consolidated row exists", () => {
    const r = selectBasis([row({ is_consolidated: false })]);
    expect(r.basis).toBe("standalone");
    expect(r.bothAvailable).toBe(false);
  });

  it("returns a null basis for no rows", () => {
    expect(selectBasis([]).basis).toBeNull();
  });

  it("orders rows newest first", () => {
    const r = selectBasis([
      row({ period_end: "2024-06-30" }), row({ period_end: "2024-12-31" }),
    ]);
    expect(r.rows.map((x) => x.period_end)).toEqual(["2024-12-31", "2024-06-30"]);
  });
});

describe("formatINR", () => {
  it("renders crore for values at or above one crore", () => {
    expect(formatINR(1282600000000)).toBe("₹1,28,260.00 Cr");
  });
  it("renders lakh below a crore", () => {
    expect(formatINR(2500000)).toBe("₹25.00 L");
  });
  it("keeps the sign on negatives", () => {
    expect(formatINR(-50000000)).toBe("-₹5.00 Cr");
  });
  it("returns an em dash for null so callers must use toCell", () => {
    expect(formatINR(null)).toBe("—");
  });
});

describe("toCell", () => {
  it("marks null as missing with a reason, never as zero", () => {
    const c = toCell(null, (n) => String(n));
    expect(c.kind).toBe("missing");
    if (c.kind === "missing") expect(c.reason).toMatch(/not reported/i);
  });
  it("passes a real zero through as a value", () => {
    const c = toCell(0, (n) => String(n));
    expect(c).toEqual({ kind: "value", text: "0" });
  });
});

describe("formatRatio", () => {
  it("renders two decimals", () => expect(formatRatio(0.41)).toBe("0.41"));
  it("renders an em dash for null", () => expect(formatRatio(null)).toBe("—"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/fundamentals.test.ts`
Expected: FAIL — `Failed to resolve import "../lib/fundamentals"`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/fundamentals.ts
export type IncomeRow = {
  symbol: string;
  period_end: string;
  is_consolidated: boolean;
  revenue: number | null;
  other_income: number | null;
  total_income: number | null;
  total_expenses: number | null;
  profit_before_tax: number | null;
  profit_after_tax: number | null;
  basic_eps: number | null;
  diluted_eps: number | null;
  debt_equity_ratio: number | null;
  debt_service_coverage_ratio: number | null;
};

export type Basis = "consolidated" | "standalone";

/**
 * Pick one reporting basis and stay on it.
 *
 * Indian companies file both bases for the same quarter, so ordering by
 * period_end alone interleaves them: consolidated revenue in one column and
 * standalone in the next, rendered as a trend, with nothing on screen saying
 * so. Consolidated wins when present because it describes the whole group.
 */
export function selectBasis(rows: IncomeRow[]): {
  basis: Basis | null;
  rows: IncomeRow[];
  bothAvailable: boolean;
} {
  const consolidated = rows.filter((r) => r.is_consolidated);
  const standalone = rows.filter((r) => !r.is_consolidated);
  const bothAvailable = consolidated.length > 0 && standalone.length > 0;
  const chosen = consolidated.length > 0 ? consolidated : standalone;
  const basis: Basis | null =
    chosen.length === 0 ? null : consolidated.length > 0 ? "consolidated" : "standalone";
  const sorted = [...chosen].sort((a, b) => b.period_end.localeCompare(a.period_end));
  return { basis, rows: sorted, bothAvailable };
}

const CRORE = 10_000_000;
const LAKH = 100_000;

/** Indian grouping: 1,28,260 rather than 128,260. */
const group = (n: number): string =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatINR(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= CRORE) return `${sign}₹${group(abs / CRORE)} Cr`;
  if (abs >= LAKH) return `${sign}₹${group(abs / LAKH)} L`;
  return `${sign}₹${group(abs)}`;
}

export function formatRatio(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

export type Cell =
  | { kind: "value"; text: string }
  | { kind: "missing"; reason: string };

/**
 * Null means the XBRL fact was absent from the filing. That is information, so
 * it is stated rather than hidden - and a real 0 is a value, not a gap.
 */
export function toCell(value: number | null, format: (n: number) => string): Cell {
  if (value === null || !Number.isFinite(value)) {
    return { kind: "missing", reason: "not reported in this filing" };
  }
  return { kind: "value", text: format(value) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/fundamentals.test.ts`
Expected: PASS, 13 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/fundamentals.ts src/test/fundamentals.test.ts
git commit -m "feat(stock-page): add basis selection and money formatting"
```

---

### Task 2: Data hook

**Files:**
- Create: `src/hooks/useStockFundamentals.ts`

**Interfaces:**
- Consumes: `IncomeRow`, `selectBasis`, `Basis` from Task 1.
- Produces:
  - `type CorporateAction = { ex_date: string; record_date: string | null; action_type: string; value: number | null; description: string }`
  - `type StockHeader = { symbol: string; name: string; sector: string | null; price: number | null; change_pct: number | null; market_cap: number | null; updated_at: string | null }`
  - `type FilingMeta = { filing_date: string | null; xbrl_url: string | null; is_audited: boolean }`
  - `type StockFundamentalsState = { loading: boolean; notFound: boolean; error: string | null; header: StockHeader | null; basis: Basis | null; bothAvailable: boolean; income: IncomeRow[]; actions: CorporateAction[]; filing: FilingMeta | null; synced: boolean }`
  - `useStockFundamentals(symbol: string | undefined): StockFundamentalsState`

- [ ] **Step 1: Write the hook**

There is no test for this task — it is I/O wiring over Supabase, and the logic
worth testing (basis selection, formatting) is pure and already covered in
Task 1. The page states it drives are verified in Task 8's prerender assertion.

```ts
// src/hooks/useStockFundamentals.ts
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { selectBasis, type Basis, type IncomeRow } from "@/lib/fundamentals";

export type CorporateAction = {
  ex_date: string;
  record_date: string | null;
  action_type: string;
  value: number | null;
  description: string;
};

export type StockHeader = {
  symbol: string;
  name: string;
  sector: string | null;
  price: number | null;
  change_pct: number | null;
  market_cap: number | null;
  updated_at: string | null;
};

export type FilingMeta = {
  filing_date: string | null;
  xbrl_url: string | null;
  is_audited: boolean;
};

export type StockFundamentalsState = {
  loading: boolean;
  /** Symbol is not in the tracked universe - the page must 404. */
  notFound: boolean;
  error: string | null;
  header: StockHeader | null;
  basis: Basis | null;
  bothAvailable: boolean;
  income: IncomeRow[];
  actions: CorporateAction[];
  filing: FilingMeta | null;
  /** False when the symbol is tracked but the cursor has not reached it yet. */
  synced: boolean;
};

// The fundamentals tables post-date the generated Database types, so they are
// addressed through the same cast MarketDataManager.tsx already uses.
const table = (name: string) =>
  supabase.from(name as never) as ReturnType<typeof supabase.from>;

const EMPTY: StockFundamentalsState = {
  loading: true, notFound: false, error: null, header: null, basis: null,
  bothAvailable: false, income: [], actions: [], filing: null, synced: false,
};

export function useStockFundamentals(symbol: string | undefined): StockFundamentalsState {
  const [state, setState] = useState<StockFundamentalsState>(EMPTY);

  useEffect(() => {
    if (!symbol) {
      setState({ ...EMPTY, loading: false, notFound: true });
      return;
    }
    let cancelled = false;
    const upper = symbol.toUpperCase();

    (async () => {
      setState(EMPTY);
      try {
        // The universe row decides 404 vs render, so it is awaited first.
        const { data: headerRow, error: headerErr } = await table("screener_stocks")
          .select("symbol,name,sector,price,change_pct,market_cap,updated_at")
          .eq("symbol", upper)
          .maybeSingle();
        if (cancelled) return;
        if (headerErr) throw new Error(headerErr.message);
        if (!headerRow) {
          setState({ ...EMPTY, loading: false, notFound: true });
          return;
        }

        // Independent of each other - fetched in parallel, no waterfall.
        const [incomeRes, actionsRes, filingRes] = await Promise.all([
          table("fundamentals_income").select("*").eq("symbol", upper),
          table("fundamentals_corporate_actions")
            .select("ex_date,record_date,action_type,value,description")
            .eq("symbol", upper)
            .order("ex_date", { ascending: false })
            .limit(50),
          table("fundamentals_filings")
            .select("filing_date,xbrl_url,is_audited")
            .eq("symbol", upper)
            .order("to_date", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        if (cancelled) return;

        const firstError = incomeRes.error || actionsRes.error || filingRes.error;
        if (firstError) throw new Error(firstError.message);

        const rows = (incomeRes.data ?? []) as unknown as IncomeRow[];
        const picked = selectBasis(rows);
        const h = headerRow as unknown as Record<string, unknown>;

        setState({
          loading: false,
          notFound: false,
          error: null,
          header: {
            symbol: upper,
            name: String(h.name ?? upper),
            sector: (h.sector as string) ?? null,
            price: h.price === null ? null : Number(h.price),
            change_pct: h.change_pct === null ? null : Number(h.change_pct),
            market_cap: h.market_cap === null ? null : Number(h.market_cap),
            updated_at: (h.updated_at as string) ?? null,
          },
          basis: picked.basis,
          bothAvailable: picked.bothAvailable,
          income: picked.rows,
          actions: (actionsRes.data ?? []) as unknown as CorporateAction[],
          filing: (filingRes.data as unknown as FilingMeta) ?? null,
          // Tracked but unreached by the cursor is an ordinary state, not a fault.
          synced: rows.length > 0,
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          ...EMPTY, loading: false, error: (err as Error).message,
        });
      }
    })();

    return () => { cancelled = true; };
  }, [symbol]);

  return state;
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0, no errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useStockFundamentals.ts
git commit -m "feat(stock-page): add the fundamentals data hook"
```

---

### Task 3: Income statement table

**Files:**
- Create: `src/components/stock/IncomeStatementTable.tsx`

**Interfaces:**
- Consumes: `IncomeRow`, `Basis`, `formatINR`, `formatRatio`, `toCell` (Task 1).
- Produces: default export `IncomeStatementTable({ rows, basis }: { rows: IncomeRow[]; basis: Basis })`

- [ ] **Step 1: Write the component**

```tsx
// src/components/stock/IncomeStatementTable.tsx
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { revealItem, revealSection } from "@/lib/motion";
import {
  formatINR, formatRatio, toCell, type Basis, type IncomeRow,
} from "@/lib/fundamentals";

type Line = {
  label: string;
  pick: (r: IncomeRow) => number | null;
  format: (n: number) => string;
};

// Ratios sit in the same table because they arrive on the same XBRL row.
// ROE/ROCE/current ratio are deliberately absent - nothing ingests them yet,
// so a permanent "Not available" on every stock would be noise, not honesty.
const LINES: Line[] = [
  { label: "Revenue", pick: (r) => r.revenue, format: formatINR },
  { label: "Other income", pick: (r) => r.other_income, format: formatINR },
  { label: "Total income", pick: (r) => r.total_income, format: formatINR },
  { label: "Total expenses", pick: (r) => r.total_expenses, format: formatINR },
  { label: "Profit before tax", pick: (r) => r.profit_before_tax, format: formatINR },
  { label: "Profit after tax", pick: (r) => r.profit_after_tax, format: formatINR },
  { label: "Basic EPS", pick: (r) => r.basic_eps, format: (n) => `₹${n.toFixed(2)}` },
  { label: "Diluted EPS", pick: (r) => r.diluted_eps, format: (n) => `₹${n.toFixed(2)}` },
  { label: "Debt to equity", pick: (r) => r.debt_equity_ratio, format: formatRatio },
  {
    label: "Debt service coverage",
    pick: (r) => r.debt_service_coverage_ratio,
    format: formatRatio,
  },
];

const quarterLabel = (periodEnd: string): string => {
  const d = new Date(periodEnd);
  if (Number.isNaN(d.getTime())) return periodEnd;
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};

export default function IncomeStatementTable({
  rows, basis,
}: { rows: IncomeRow[]; basis: Basis }) {
  return (
    <motion.section {...revealSection} aria-labelledby="income-heading">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <h2 id="income-heading" className="text-2xl font-bold">
          Quarterly results
        </h2>
        <Badge variant="secondary">
          {basis === "consolidated" ? "Consolidated" : "Standalone"}
        </Badge>
      </div>

      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <caption className="sr-only">
            Quarterly income statement on a {basis} basis, most recent first
          </caption>
          <thead>
            <tr className="border-b">
              <th scope="col" className="text-left p-3 font-medium">Metric</th>
              {rows.map((r) => (
                <th
                  key={`${r.period_end}-${String(r.is_consolidated)}`}
                  scope="col"
                  className="text-right p-3 font-medium whitespace-nowrap"
                >
                  {quarterLabel(r.period_end)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LINES.map((line, i) => (
              <motion.tr
                key={line.label}
                {...revealItem(i)}
                className="border-b last:border-0 hover:bg-muted/30 transition-colors"
              >
                <th scope="row" className="text-left p-3 font-normal text-muted-foreground">
                  {line.label}
                </th>
                {rows.map((r) => {
                  const cell = toCell(line.pick(r), line.format);
                  return (
                    <td
                      key={`${line.label}-${r.period_end}`}
                      className="text-right p-3 tabular-nums whitespace-nowrap"
                    >
                      {cell.kind === "value" ? (
                        cell.text
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          Not available
                          <span className="sr-only"> — {cell.reason}</span>
                        </span>
                      )}
                    </td>
                  );
                })}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </Card>
    </motion.section>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add src/components/stock/IncomeStatementTable.tsx
git commit -m "feat(stock-page): add the quarterly income statement table"
```

---

### Task 4: Corporate actions and provenance

**Files:**
- Create: `src/components/stock/CorporateActionsList.tsx`
- Create: `src/components/stock/StockProvenance.tsx`

**Interfaces:**
- Consumes: `CorporateAction`, `FilingMeta` (Task 2); `revealItem`, `revealSection`.
- Produces: default exports `CorporateActionsList({ actions })` and `StockProvenance({ filing })`.

- [ ] **Step 1: Write both components**

```tsx
// src/components/stock/CorporateActionsList.tsx
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { revealItem, revealSection } from "@/lib/motion";
import type { CorporateAction } from "@/hooks/useStockFundamentals";

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export default function CorporateActionsList({ actions }: { actions: CorporateAction[] }) {
  return (
    <motion.section {...revealSection} aria-labelledby="actions-heading">
      <h2 id="actions-heading" className="text-2xl font-bold mb-4">
        Corporate actions
      </h2>

      {actions.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          No dividends, splits or bonuses recorded for this company yet.
        </Card>
      ) : (
        <ul className="space-y-2">
          {actions.map((a, i) => (
            <motion.li key={`${a.ex_date}-${a.action_type}-${i}`} {...revealItem(i)}>
              <Card className="p-4 flex items-start justify-between gap-4 hover:bg-muted/30 transition-colors">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="capitalize">{a.action_type}</Badge>
                    {a.value !== null && (
                      <span className="font-semibold tabular-nums">₹{a.value}</span>
                    )}
                  </div>
                  {/* Raw announcement text is kept verbatim - the parser stores
                      the original because its own classification can be wrong. */}
                  <p className="text-sm text-muted-foreground break-words">{a.description}</p>
                </div>
                <div className="text-right text-sm whitespace-nowrap">
                  <div className="font-medium">{formatDate(a.ex_date)}</div>
                  <div className="text-xs text-muted-foreground">ex-date</div>
                </div>
              </Card>
            </motion.li>
          ))}
        </ul>
      )}
    </motion.section>
  );
}
```

```tsx
// src/components/stock/StockProvenance.tsx
import type { FilingMeta } from "@/hooks/useStockFundamentals";

export default function StockProvenance({ filing }: { filing: FilingMeta | null }) {
  if (!filing) return null;
  const filed = filing.filing_date ? new Date(filing.filing_date) : null;
  const filedText =
    filed && !Number.isNaN(filed.getTime())
      ? filed.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : null;

  return (
    <p className="text-xs text-muted-foreground border-t pt-4">
      Sourced from the company's NSE XBRL filing
      {filedText ? ` dated ${filedText}` : ""}
      {filing.is_audited ? " (audited)" : " (unaudited)"}.
      {filing.xbrl_url && (
        <>
          {" "}
          <a
            href={filing.xbrl_url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground transition-colors"
          >
            View the source filing
          </a>
          .
        </>
      )}{" "}
      Figures are as filed and are not investment advice.
    </p>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add src/components/stock/CorporateActionsList.tsx src/components/stock/StockProvenance.tsx
git commit -m "feat(stock-page): add corporate actions and provenance"
```

---

### Task 5: Symbol switcher

**Files:**
- Create: `src/components/stock/SymbolSwitcher.tsx`

**Interfaces:**
- Consumes: existing `src/components/ui/command.tsx`, `supabase`.
- Produces: default export `SymbolSwitcher()` — self-contained, no props.

- [ ] **Step 1: Write the component**

```tsx
// src/components/stock/SymbolSwitcher.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";

type Entry = { symbol: string; name: string };

export default function SymbolSwitcher() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Loaded once on first open, not on mount - the universe is ~159 rows but
  // there is no reason to pay for it on a page view that never opens the palette.
  useEffect(() => {
    if (!open || entries.length > 0) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("screener_stocks")
        .select("symbol,name")
        .order("symbol");
      if (!cancelled && data) setEntries(data as Entry[]);
    })();
    return () => { cancelled = true; };
  }, [open, entries.length]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground border rounded-md px-2 py-1 hover:bg-muted transition-colors"
      >
        Switch stock <kbd className="ml-1 font-mono">⌘K</kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search a stock by symbol or name..." />
        <CommandList>
          <CommandEmpty>No matching stock.</CommandEmpty>
          <CommandGroup heading="Tracked stocks">
            {entries.map((e) => (
              <CommandItem
                key={e.symbol}
                value={`${e.symbol} ${e.name}`}
                onSelect={() => {
                  setOpen(false);
                  navigate(`/stock/${e.symbol}`);
                }}
              >
                <span className="font-medium mr-2">{e.symbol}</span>
                <span className="text-muted-foreground truncate">{e.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add src/components/stock/SymbolSwitcher.tsx
git commit -m "feat(stock-page): add the cmd-K symbol switcher"
```

---

### Task 6: The page

**Files:**
- Create: `src/pages/StockPage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1-5.
- Produces: default export `StockPage()`, routed at `/stock/:symbol`.

- [ ] **Step 1: Write the page**

```tsx
// src/pages/StockPage.tsx
import { useParams } from "react-router-dom";
import { motion } from "motion/react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import PageTransition from "@/components/PageTransition";
import ScrollProgress from "@/components/ScrollProgress";
import WhatsAppButton from "@/components/WhatsAppButton";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import NotFound from "@/pages/NotFound";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { revealSection } from "@/lib/motion";
import { formatINR } from "@/lib/fundamentals";
import { useStockFundamentals } from "@/hooks/useStockFundamentals";
import IncomeStatementTable from "@/components/stock/IncomeStatementTable";
import CorporateActionsList from "@/components/stock/CorporateActionsList";
import StockProvenance from "@/components/stock/StockProvenance";
import SymbolSwitcher from "@/components/stock/SymbolSwitcher";

export default function StockPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const s = useStockFundamentals(symbol);

  // An unknown ticker must be a real 404, not an empty shell - /stock/:symbol
  // is an open namespace and would otherwise become a soft-404 farm.
  if (s.notFound) return <NotFound />;

  const title = s.header
    ? `${s.header.name} (${s.header.symbol}) financials`
    : `${symbol?.toUpperCase() ?? "Stock"} financials`;

  return (
    <PageTransition>
      <ScrollProgress />
      <SEOHead
        title={`${title} | Shri Parasram Holdings Panipat`}
        description={
          s.header
            ? `Quarterly results, EPS and corporate actions for ${s.header.name} (${s.header.symbol}), sourced from NSE XBRL filings.`
            : `Quarterly financial results and corporate actions.`
        }
      />
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <VisibleBreadcrumbs />

        {s.loading ? (
          <div className="space-y-4" aria-busy="true" data-stock-state="loading">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : s.error ? (
          <Card className="p-6" data-stock-state="error">
            <h1 className="text-xl font-bold mb-2">Could not load financials</h1>
            <p className="text-sm text-muted-foreground">{s.error}</p>
          </Card>
        ) : (
          <div className="space-y-10" data-stock-state="ready">
            <motion.header {...revealSection}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                    {s.header?.name}
                  </h1>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary">{s.header?.symbol}</Badge>
                    {s.header?.sector && (
                      <span className="text-sm text-muted-foreground">{s.header.sector}</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {s.header?.price !== null && s.header?.price !== undefined && (
                    <div className="text-2xl font-bold tabular-nums">
                      ₹{s.header.price.toFixed(2)}
                    </div>
                  )}
                  {s.header?.updated_at && (
                    <div className="text-xs text-muted-foreground">
                      price as of{" "}
                      {new Date(s.header.updated_at).toLocaleString("en-IN")}
                    </div>
                  )}
                  <div className="mt-2"><SymbolSwitcher /></div>
                </div>
              </div>
              {s.header?.market_cap ? (
                <p className="text-sm text-muted-foreground mt-3">
                  Market cap {formatINR(s.header.market_cap)}
                </p>
              ) : null}
            </motion.header>

            {/* Tracked but unreached by the sync cursor. Ordinary, not broken -
                the backfill covers ~2 symbols an hour. */}
            {!s.synced ? (
              <Card className="p-6" data-stock-state="unsynced">
                <h2 className="font-semibold mb-1">Financials not yet synced</h2>
                <p className="text-sm text-muted-foreground">
                  This company is tracked, but its filings have not been processed
                  yet. Results appear here once the next sync reaches it.
                </p>
              </Card>
            ) : (
              <>
                <IncomeStatementTable rows={s.income} basis={s.basis!} />
                {s.bothAvailable && (
                  <p className="text-xs text-muted-foreground">
                    This company files both consolidated and standalone results.
                    Consolidated figures are shown; the two are never combined.
                  </p>
                )}
              </>
            )}

            <CorporateActionsList actions={s.actions} />
            <StockProvenance filing={s.filing} />
          </div>
        )}
      </main>
      <WhatsAppButton />
      <Footer />
    </PageTransition>
  );
}
```

- [ ] **Step 2: Register the route**

In `src/App.tsx`, add the lazy import alongside the others (near line 65):

```tsx
const StockPage = lazy(() => import("./pages/StockPage"));
```

And the route alongside the others (near line 181, next to `/learn/:slug`):

```tsx
<Route path="/stock/:symbol" element={<StockPage />} />
```

- [ ] **Step 3: Verify build and types**

Run: `npx tsc --noEmit --pretty false && npx vite build`
Expected: exit 0, build succeeds

- [ ] **Step 4: Verify no chart chunk leaked onto the page**

Run: `npx vite build 2>&1 | grep -i StockPage`
Expected: a `StockPage-*.js` chunk well under 20 kB gzip, and **no** `chart-vendor` in its import graph.

- [ ] **Step 5: Commit**

```bash
git add src/pages/StockPage.tsx src/App.tsx
git commit -m "feat(stock-page): add the /stock/:symbol page and route"
```

---

### Task 7: Build-time route derivation

**Files:**
- Create: `scripts/lib/stock-routes.mjs`
- Modify: `scripts/generate-sitemap.js`

**Interfaces:**
- Produces: `export async function fetchStockRoutes(): Promise<string[]>` — returns `['/stock/RELIANCE', ...]`, **throws** on empty or failed fetch.

- [ ] **Step 1: Write the module**

```js
// scripts/lib/stock-routes.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Stock routes come from the live universe rather than a checked-in list, so
 * the sitemap and the prerendered set can never drift from what the app serves.
 *
 * The key is read from the client module, where it already lives as a hardcoded
 * fallback and is shipped in the browser bundle - so this adds no exposure.
 */
function readSupabaseConfig() {
  const src = fs.readFileSync(
    path.resolve(__dirname, '../../src/integrations/supabase/client.ts'),
    'utf-8',
  );
  const url = src.match(/FALLBACK_SUPABASE_URL = '([^']+)'/)?.[1];
  const key = src.match(/FALLBACK_SUPABASE_PUBLISHABLE_KEY =\s*'([^']+)'/)?.[1];
  if (!url || !key) {
    throw new Error('Could not read Supabase config from client.ts');
  }
  return {
    url: process.env.VITE_SUPABASE_URL || url,
    key: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || key,
  };
}

export async function fetchStockRoutes() {
  const { url, key } = readSupabaseConfig();
  const res = await fetch(
    `${url}/rest/v1/screener_stocks?select=symbol&order=symbol`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) {
    throw new Error(`screener_stocks fetch failed: HTTP ${res.status}`);
  }
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    // Fails closed, exactly as prerender.js already does when learnContent.ts
    // yields no slugs. Shipping a site with every stock page missing is worse
    // than not shipping.
    throw new Error('screener_stocks returned no symbols - refusing to build an incomplete site');
  }
  return rows
    .map((r) => String(r.symbol || '').trim().toUpperCase())
    .filter(Boolean)
    .map((s) => `/stock/${encodeURIComponent(s)}`);
}
```

- [ ] **Step 2: Verify it returns the real universe**

Run: `node -e "import('./scripts/lib/stock-routes.mjs').then(async m=>{const r=await m.fetchStockRoutes();console.log(r.length,'routes; first:',r[0])})"`
Expected: a count matching `screener_stocks` (~159) and a route like `/stock/ADANIENT`

- [ ] **Step 3: Wire it into the sitemap**

In `scripts/generate-sitemap.js`, add the import at the top:

```js
import { fetchStockRoutes } from './lib/stock-routes.mjs';
```

Then, immediately before the `const urls = [` array is used to build the XML, append the stock routes. The file builds `urls` synchronously, so wrap the write in an async IIFE and spread the routes in:

```js
const stockRoutes = await fetchStockRoutes();
urls.push(...stockRoutes.map((route) => ({ loc: route, changefreq: 'weekly', priority: '0.6' })));
```

Match the exact shape of the existing entries in the `urls` array — read the file and copy the property names used there rather than assuming `loc`/`changefreq`/`priority`.

- [ ] **Step 4: Verify the sitemap contains stock URLs**

Run: `node scripts/generate-sitemap.js && grep -c '/stock/' public/sitemap.xml`
Expected: a count matching the universe size

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/stock-routes.mjs scripts/generate-sitemap.js public/sitemap.xml
git commit -m "feat(stock-page): derive stock routes from the live universe"
```

---

### Task 8: Prerender the pages, with a content assertion

**Files:**
- Modify: `scripts/prerender.js`

**Interfaces:**
- Consumes: `fetchStockRoutes` (Task 7); `data-stock-state` attributes (Task 6).

- [ ] **Step 1: Fix the SPA fallback bug**

In `scripts/prerender.js:82`, replace:

```js
res.sendFile(path.join(DIST_DIR, 'index.html'));
```

with:

```js
// `send`'s dotfile guard rejects the whole path when any segment starts with a
// dot, so path.join() 404s every route from a checkout under e.g. .claude/.
// Rooting the call scopes that check to the filename.
res.sendFile('index.html', { root: DIST_DIR });
```

- [ ] **Step 2: Add stock routes and the content assertion**

Add the import at the top of `scripts/prerender.js`:

```js
import { fetchStockRoutes } from './lib/stock-routes.mjs';
```

Inside the async block, before the render loop, extend the route list:

```js
const stockRoutes = await fetchStockRoutes();
console.log(`Derived ${stockRoutes.length} stock routes from screener_stocks.`);
```

Change the loop header to include them:

```js
for (const route of [...routes, ...stockRoutes, ERROR_ROUTE]) {
```

Then, immediately after `const html = await page.content();`, add:

```js
// The catch above swallows a goto timeout and proceeds, so without this a slow
// response silently ships a loading skeleton to crawlers. Measured: at high
// concurrency this produced 126 well-formed skeleton files with timeouts=0 and
// nothing in the log to distinguish it from a clean run.
if (route.startsWith('/stock/')) {
  const ready = html.includes('data-stock-state="ready"');
  const unsynced = html.includes('data-stock-state="unsynced"');
  if (!ready && !unsynced) {
    throw new Error(
      `Prerender captured no data for ${route} - got a loading or error state. ` +
      `Refusing to ship a skeleton page.`,
    );
  }
}
```

- [ ] **Step 3: Run the full prerender**

Run: `npx vite build && node scripts/prerender.js`
Expected: succeeds; roughly 39 + universe-size routes rendered; total under ~5 minutes

- [ ] **Step 4: Verify a real page was captured**

Run: `ls dist/stock | head -3 && grep -c 'data-stock-state' dist/stock/RELIANCE.html`
Expected: files present, and at least one `data-stock-state` match

- [ ] **Step 5: Verify the assertion actually fires**

Temporarily change the assertion to also reject `unsynced`, re-run `node scripts/prerender.js`, and confirm the build fails with the "Refusing to ship a skeleton page" message. Then revert that temporary change.

This step exists because an assertion that has never fired is not known to work.

- [ ] **Step 6: Commit**

```bash
git add scripts/prerender.js
git commit -m "feat(stock-page): prerender stock routes and assert captured content"
```

---

## Self-Review

**Spec coverage:** Route and 404 → Task 6. Basis selection → Task 1. Sections 1-5 → Tasks 3, 4, 6. Missing values → Task 1 (`toCell`) and Task 3. Staleness → Task 6 header and Task 4 provenance. Data delivery and prerendering → Tasks 7, 8. Performance (no chart) → Task 6 Step 4. Motion and ⌘K → Tasks 3, 5. Error handling table → Task 2 (`notFound`, `synced`, `error`) and Task 6. Testing → Task 1; route-derivation fail-closed → Task 7 Step 2; prerender assertion → Task 8 Step 5.

**Known gap, deliberate:** the spec's testing section lists a corporate-action grouping test. Grouping was dropped during planning — `CorporateActionsList` renders a flat ex-date-ordered list, which the spec's own section 4 describes. No test is owed for behaviour that does not exist.

**Type consistency:** `IncomeRow`, `Basis`, `Cell` defined in Task 1 and consumed unchanged in Tasks 2-3. `CorporateAction` and `FilingMeta` defined in Task 2, consumed in Task 4. `fetchStockRoutes` defined in Task 7, consumed in Tasks 7 and 8. `data-stock-state` values `loading|error|ready|unsynced` emitted in Task 6 and asserted in Task 8.

**Sequencing note:** Tasks 7 and 8 require the sync to have covered at least one symbol, or every prerendered page renders `unsynced` — which the assertion accepts, so the build still passes honestly.
