import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseStatement, flattenKeyMetrics, deriveRoe } from "../../supabase/functions/_shared/indianapi";
import { financialGrids, parseKeyStats } from "../../supabase/functions/_shared/google-finance";
import { summariseFundamentals, yoyGrowth } from "../../supabase/functions/_shared/screener-fundamentals";

/*
 * The screener's fundamentals columns, derived from what the stock syncs have
 * already stored - no request to any provider. IndianAPI's figures are used
 * where a stock has them, Google Finance's otherwise, and each summary says
 * which. A figure neither source supports is left out, never estimated.
 */

const indian = (name: string) => JSON.parse(readFileSync(`src/test/fixtures/indianapi/${name}.json`, "utf-8"));
const google = JSON.parse(readFileSync("src/test/fixtures/google-finance/mm-nse.json", "utf-8"));

describe("yoyGrowth", () => {
  it("compares the latest quarter with the same quarter a year earlier", () => {
    const grid = { periods: ["Jun 2025", "Sep 2025", "Dec 2025", "Mar 2026", "Jun 2026"], period_ends: [], rows: [{ label: "Sales", values: [100, 110, 120, 130, 125] }] };
    expect(yoyGrowth(grid, "Sales")).toBeCloseTo(25, 5);
  });

  it("is absent without a year-ago quarter, or when that quarter was not positive", () => {
    const short = { periods: ["Mar 2026", "Jun 2026"], period_ends: [], rows: [{ label: "Sales", values: [1, 2] }] };
    expect(yoyGrowth(short, "Sales")).toBeNull();
    const loss = { periods: ["a", "b", "c", "d", "e"], period_ends: [], rows: [{ label: "Net Profit", values: [-5, 1, 1, 1, 10] }] };
    expect(yoyGrowth(loss, "Net Profit")).toBeNull();
  });
});

describe("summariseFundamentals - IndianAPI", () => {
  const quarters = parseStatement(indian("reliance-quarter_results"))!;
  const annual = parseStatement(indian("reliance-yoy_results"))!;
  const balance = parseStatement(indian("reliance-balancesheet"))!;
  const ratios = parseStatement(indian("reliance-ratios"))!;
  const km = flattenKeyMetrics(indian("reliance-stock").keyMetrics);
  const summary = summariseFundamentals({
    source: "indianapi",
    quarters, balance, ratios,
    keyMetrics: km,
    roeHistory: deriveRoe(annual, balance),
  });

  it("reads growth and margin from the quarterly results", () => {
    // Sales Jun 2026 3,09,468 against Jun 2025 - the fifth column from the end.
    const sales = quarters.rows.find((r) => r.label === "Sales")!.values;
    expect(summary.sales_growth_yoy).toBeCloseTo((sales[12]! / sales[8]! - 1) * 100, 5);
    expect(summary.opm).toBe(15);
    expect(summary.latest_quarter).toBe("2026-06-30");
  });

  it("reads ROE from the derived history and ROCE from the ratios", () => {
    const roe = deriveRoe(annual, balance);
    expect(summary.roe).toBeCloseTo(roe[roe.length - 1].roe, 5);
    expect(summary.roce).toBe(10);
  });

  it("computes debt to equity from borrowings over equity capital plus reserves", () => {
    // Mar 2026: borrowings 4,02,962 over 13,532 + 8,90,498.
    expect(summary.debt_to_equity).toBeCloseTo(402962 / (13532 + 890498), 5);
  });

  it("takes valuation and payout from the key metrics", () => {
    expect(summary).toMatchObject({ pb: 1.96, dividend_yield: 0.46, source: "indianapi" });
  });
});

describe("summariseFundamentals - Google Finance", () => {
  const grids = financialGrids(google);
  const summary = summariseFundamentals({
    source: "google_finance",
    quarters: grids.gf_income_quarterly!,
    balance: grids.gf_balance_annual!,
    googleStats: parseKeyStats(google),
  });

  it("reads growth from Google's quarterly income statement", () => {
    const revenue = grids.gf_income_quarterly!.rows.find((r) => r.label === "Revenue")!.values;
    const n = revenue.length;
    expect(summary.sales_growth_yoy).toBeCloseTo((revenue[n - 1]! / revenue[n - 5]! - 1) * 100, 5);
    expect(summary.profit_growth_yoy).not.toBeNull();
  });

  it("computes operating margin from operating income over revenue", () => {
    expect(summary.opm).not.toBeNull();
    expect(summary.opm!).toBeGreaterThan(0);
    expect(summary.opm!).toBeLessThan(100);
  });

  it("takes dividend yield and EPS from the key stats", () => {
    expect(summary).toMatchObject({ dividend_yield: 1.06, eps_ttm: 164.44, source: "google_finance" });
  });
});

describe("summariseFundamentals - nothing to go on", () => {
  it("leaves every figure absent rather than zero", () => {
    const summary = summariseFundamentals({ source: "google_finance" });
    expect(Object.entries(summary).filter(([k]) => k !== "source").every(([, v]) => v === null)).toBe(true);
  });
});

describe("summariseFundamentals - a bank", () => {
  it("leaves OPM out: a bank's financing margin is not an operating margin", () => {
    const summary = summariseFundamentals({ source: "indianapi", quarters: parseStatement(indian("hdfcbank-quarter_results"))! });
    expect(summary.opm).toBeNull();
    expect(summary.sales_growth_yoy).not.toBeNull();
  });
});

describe("summariseFundamentals - screener.in", () => {
  it("reads the same grids as IndianAPI and takes valuation from screener.in's headline ratios", () => {
    const summary = summariseFundamentals({
      source: "screener_in",
      quarters: parseStatement(indian("reliance-quarter_results"))!,
      screenerRatios: { price: 1258, book_value: 668, dividend_yield: 0.47, pe: 22.8, roe: 8.91, roce: 10.3 },
    });
    expect(summary.source).toBe("screener_in");
    expect(summary.opm).toBe(15);
    expect(summary.pb).toBeCloseTo(1258 / 668, 5);
    expect(summary.eps_ttm).toBeCloseTo(1258 / 22.8, 5);
    expect(summary).toMatchObject({ dividend_yield: 0.47, roe: 8.91, roce: 10.3 });
  });
});
