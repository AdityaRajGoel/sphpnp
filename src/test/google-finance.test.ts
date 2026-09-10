import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  parseScaledNumber,
  verifyGoogleFinance,
  parseKeyStats,
  financialGrids,
} from "../../supabase/functions/_shared/google-finance";

/*
 * SerpApi's Google Finance engine, captured 2026-09-10 for M&M:NSE.
 *
 * It fills the stocks IndianAPI cannot: M&M came back from IndianAPI with no
 * key metrics at all, DIVISLAB with no NSE code to verify. One search returns
 * key stats and nine quarters plus decades of annual income statement,
 * balance sheet and cash flow - amounts in rupees, which are stored in crore
 * to sit beside IndianAPI's statements on the same page.
 */

const response = JSON.parse(readFileSync("src/test/fixtures/google-finance/mm-nse.json", "utf-8"));
const last = <T,>(items: T[]): T => items[items.length - 1];

describe("parseScaledNumber", () => {
  it("reads Google's abbreviated magnitudes", () => {
    expect(parseScaledNumber("3.78T")).toBe(3.78e12);
    expect(parseScaledNumber("1.19B")).toBe(1.19e9);
    expect(parseScaledNumber("2.14M")).toBe(2.14e6);
    expect(parseScaledNumber("27K")).toBe(27000);
  });

  it("reads rupee-prefixed and plain figures", () => {
    expect(parseScaledNumber("₹3,839.90")).toBe(3839.9);
    expect(parseScaledNumber("18.97")).toBe(18.97);
  });

  it("gives null for Google's dash placeholder", () => {
    expect(parseScaledNumber("—")).toBeNull();
    expect(parseScaledNumber("")).toBeNull();
  });
});

describe("verifyGoogleFinance", () => {
  it("accepts the NSE listing of the symbol asked for", () => {
    expect(verifyGoogleFinance(response, "M&M")).toEqual({ ok: true });
  });

  it("refuses another symbol or another exchange", () => {
    expect(verifyGoogleFinance(response, "MAHINDCIE").ok).toBe(false);
    expect(verifyGoogleFinance({ summary: { stock: "M&M", exchange: "BOM" } }, "M&M").ok).toBe(false);
    expect(verifyGoogleFinance({}, "M&M").ok).toBe(false);
  });
});

describe("parseKeyStats", () => {
  const stats = parseKeyStats(response);

  it("reads the valuation figures IndianAPI had none of for this stock", () => {
    expect(stats.pe).toBe(18.97);
    expect(stats.dividend_yield_pct).toBe(1.06);
    expect(stats.eps).toBe(164.44);
    expect(stats.high_52).toBe(3839.9);
    expect(stats.low_52).toBe(2896);
  });

  it("states market cap in crore, the unit the rest of the page uses", () => {
    expect(stats.market_cap_crore).toBe(378000);
    expect(stats.shares_outstanding).toBe(1.19e9);
  });
});

describe("financialGrids", () => {
  const grids = financialGrids(response);

  it("builds quarterly and annual grids for each statement, oldest period first", () => {
    expect(Object.keys(grids).sort()).toEqual([
      "gf_balance_annual", "gf_balance_quarterly", "gf_cashflow_annual",
      "gf_cashflow_quarterly", "gf_income_annual", "gf_income_quarterly",
    ]);
    const q = grids.gf_income_quarterly!;
    expect(q.periods[0]).toBe("Jun 2024");
    expect(last(q.periods)).toBe("Jun 2026");
    expect(last(q.period_ends)).toBe("2026-06-30");
    expect(grids.gf_income_annual!.periods).toContain("FY2026");
    expect(grids.gf_income_annual!.period_ends[grids.gf_income_annual!.periods.indexOf("FY2026")]).toBe("2026-03-31");
  });

  it("converts rupee amounts to crore", () => {
    const revenue = grids.gf_income_quarterly!.rows.find((r) => r.label === "Revenue")!;
    // 5,92,03,60,00,000 rupees is 59,203.6 crore.
    expect(last(revenue.values)).toBe(59203.6);
  });

  it("keeps percentages, per-share figures and share counts in their own units", () => {
    const income = grids.gf_income_quarterly!.rows;
    expect(income.find((r) => r.label === "Net profit margin %")).toBeDefined();
    expect(income.find((r) => r.label === "Earnings per share")).toBeDefined();
    const eps = income.find((r) => r.label === "Earnings per share")!;
    expect(last(eps.values)!).toBeLessThan(1000);
  });

  it("drops lines Google has no figure for in any period", () => {
    const labels = grids.gf_income_quarterly!.rows.map((r) => r.label);
    expect(labels).not.toContain("Research and development expenses");
  });
});
