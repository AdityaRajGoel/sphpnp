import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseStatement } from "../../supabase/functions/_shared/indianapi";
import { financialGrids } from "../../supabase/functions/_shared/google-finance";
import {
  quarterlyPerformance, annualPerformance, cashflowSeries, capitalStructure, shareholdingSlices, roeSeries, shortCrore, cagr,
} from "@/lib/stock-charts";
import type { StatementGrid, StatementKind } from "@/lib/statements";

/*
 * The stock page's charts read the same stored statements as its tables:
 * IndianAPI's where the stock has them, Google Finance's otherwise. A figure
 * the source did not report is a gap in the chart, never a zero bar.
 */

const grid = (statement: StatementKind, name: string): StatementGrid => ({
  ...parseStatement(JSON.parse(readFileSync(`src/test/fixtures/indianapi/${name}.json`, "utf-8")))!,
  statement, verified: true, fetched_at: "2026-09-11T00:00:00Z",
});
const indian = {
  quarter_results: grid("quarter_results", "reliance-quarter_results"),
  yoy_results: grid("yoy_results", "reliance-yoy_results"),
  balancesheet: grid("balancesheet", "reliance-balancesheet"),
  cashflow: grid("cashflow", "reliance-cashflow"),
};
const google = Object.fromEntries(
  Object.entries(financialGrids(JSON.parse(readFileSync("src/test/fixtures/google-finance/mm-nse.json", "utf-8"))))
    .map(([k, g]) => [k, { ...g!, statement: k as StatementKind, verified: true, fetched_at: "2026-09-11T00:00:00Z" }]),
) as Partial<Record<StatementKind, StatementGrid>>;

describe("quarterlyPerformance", () => {
  it("charts the last twelve quarters of sales, profit and OPM from IndianAPI", () => {
    const q = quarterlyPerformance(indian);
    expect(q).toHaveLength(12);
    expect(q[q.length - 1]).toMatchObject({ period: "Jun 2026", revenue: 309468, margin: 15 });
    expect(q[q.length - 1].netMargin).toBeCloseTo((q[q.length - 1].profit! / 309468) * 100, 5);
  });

  it("derives operating margin from Google's operating income over revenue", () => {
    const q = quarterlyPerformance(google);
    expect(q.length).toBeGreaterThan(0);
    const last = q[q.length - 1];
    expect(last.period).toBe("Jun 2026");
    expect(last.margin).not.toBeNull();
  });

  it("draws nothing without a statement", () => {
    expect(quarterlyPerformance({})).toEqual([]);
  });
});

describe("annualPerformance", () => {
  it("leaves the trailing-twelve-month column out of a yearly chart", () => {
    const a = annualPerformance(indian);
    expect(a).toHaveLength(10);
    expect(a.map((p) => p.period)).not.toContain("TTM");
    expect(a[a.length - 1].period).toBe("Mar 2026");
  });
});

describe("cashflowSeries", () => {
  it("reads the three activities and free cash flow", () => {
    const c = cashflowSeries(indian);
    expect(c[c.length - 1]).toMatchObject({ period: "Mar 2026", operating: 192113 });
    expect(c[c.length - 1].investing!).toBeLessThan(0);
    expect(cashflowSeries(google).length).toBeGreaterThan(0);
  });
});

describe("capitalStructure", () => {
  it("adds equity capital and reserves, and sets borrowings against them", () => {
    const last = capitalStructure(indian).slice(-1)[0];
    expect(last.equity).toBe(13532 + 890498);
    expect(last.debt).toBe(402962);
    expect(last.debtToEquity).toBeCloseTo(402962 / (13532 + 890498), 5);
  });

  it("sums Google's debt lines against total equity", () => {
    const last = capitalStructure(google).slice(-1)[0];
    expect(last.equity).not.toBeNull();
    expect(last.debt).not.toBeNull();
  });
});

describe("shareholdingSlices", () => {
  it("splits the latest filing by holder, largest first, empty holders dropped", () => {
    const { date, slices } = shareholdingSlices([
      { category: "Promoters", points: [{ date: "2026-03-31", pct: 50.1 }, { date: "2026-06-30", pct: 50.3 }] },
      { category: "FIIs", points: [{ date: "2026-06-30", pct: 19.2 }] },
      { category: "Government", points: [{ date: "2026-06-30", pct: 0 }] },
      { category: "Public", points: [{ date: "2026-06-30", pct: 30.5 }] },
    ]);
    expect(date).toBe("2026-06-30");
    expect(slices.map((s) => s.name)).toEqual(["Promoters", "Public", "FIIs"]);
  });

  it("has nothing to split without filings", () => {
    expect(shareholdingSlices([])).toEqual({ date: null, slices: [] });
  });
});

describe("roeSeries", () => {
  it("labels IndianAPI's derived history by fiscal year", () => {
    expect(roeSeries([{ period_end: "2026-03-31", roe: 8.9 }], {})).toEqual([{ period: "FY26", roe: 8.9 }]);
  });

  it("falls back to Google's balance-sheet ROE row", () => {
    expect(roeSeries(undefined, google).length).toBeGreaterThan(0);
  });
});

describe("shortCrore", () => {
  it("shortens crore for an axis, sign kept", () => {
    expect(shortCrore(309468)).toBe("3.1L Cr");
    expect(shortCrore(-64706)).toBe("-64.7K Cr");
    expect(shortCrore(512)).toBe("512 Cr");
  });
});

describe("cagr", () => {
  const years = (values: (number | null)[]) =>
    values.map((v, i) => ({ period: `FY${20 + i}`, revenue: v, profit: v, margin: null, netMargin: null }));

  it("compounds from the figure `years` back to the latest", () => {
    expect(cagr(years([100, 110, 121, 133.1]), "revenue", 3)).toBeCloseTo(10, 5);
  });

  it("is absent with too short a history or a loss at the start", () => {
    expect(cagr(years([100, 120]), "revenue", 3)).toBeNull();
    expect(cagr(years([-5, 10, 20, 30]), "profit", 3)).toBeNull();
  });
});

describe("quarterlyPerformance - a bank", () => {
  it("draws no margin line from a bank's financing margin", () => {
    const q = quarterlyPerformance({ quarter_results: grid("quarter_results", "hdfcbank-quarter_results") });
    expect(q.length).toBeGreaterThan(0);
    expect(q.every((p) => p.margin === null)).toBe(true);
    expect(q[q.length - 1].revenue).not.toBeNull();
  });
});
