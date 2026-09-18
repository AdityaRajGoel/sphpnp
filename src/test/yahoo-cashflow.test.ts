import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { foreignReportingCurrency, parseTimeseriesBalance, parseTimeseriesCashflow } from "../../supabase/functions/_shared/yahoo";

/*
 * Cash flow from Yahoo's fundamentals-timeseries endpoint.
 *
 * quoteSummary's cashflowStatementHistoryQuarterly was gutted upstream the same
 * way the balance sheet was: one dated object per quarter with every figure
 * stripped, which left all 989 fundamentals_cashflow rows empty.
 *
 * The fixture is TCS's real response, captured from the VPS on 2026-09-18. Indian
 * companies file cash flow annually, so the 12-month series is the one most
 * symbols have (RELIANCE and HDFCBANK had no quarterly cash flow at all); TCS is
 * used because it carries both, dated on the same 31 March.
 */
const tcs = JSON.parse(readFileSync("src/test/fixtures/yahoo/timeseries-cashflow-tcs.json", "utf-8"));
const CRORE = 1e7;

describe("parseTimeseriesCashflow", () => {
  const rows = parseTimeseriesCashflow(tcs);
  const annual = rows.filter((r) => r.periodType === "12M");
  const quarterly = rows.filter((r) => r.periodType === "3M");

  it("keeps annual and quarterly figures for the same date apart", () => {
    const march = rows.filter((r) => r.periodEnd === "2026-03-31");
    expect(march.map((r) => r.periodType).sort()).toEqual(["12M", "3M"]);
    expect(annual).toHaveLength(4);
    expect(quarterly.length).toBeGreaterThanOrEqual(4);
  });

  it("reads the FY26 annual figures", () => {
    const fy26 = annual.find((r) => r.periodEnd === "2026-03-31")!;
    expect(Math.round(fy26.operatingCf! / CRORE)).toBe(52094);
    expect(Math.round(fy26.freeCashFlow! / CRORE)).toBe(47948);
  });

  it("stores capex as a positive spend, as the scores expect", () => {
    expect(annual.every((r) => r.capex === null || r.capex > 0)).toBe(true);
  });

  it("returns nothing for a payload without a timeseries", () => {
    expect(parseTimeseriesCashflow({})).toEqual([]);
    expect(parseTimeseriesCashflow(null)).toEqual([]);
  });
});

describe("reporting currency", () => {
  // Yahoo reports INFY's statements in US dollars. Stored as rupees they made
  // its free cash flow read Rs 373 crore instead of ~Rs 33,000 crore, and every
  // ratio against the rupee market cap wrong by ~90x.
  const inDollars = {
    timeseries: { result: [
      { meta: { type: ["annualOperatingCashFlow"] }, annualOperatingCashFlow: [
        { asOfDate: "2026-03-31", periodType: "12M", currencyCode: "USD", reportedValue: { raw: 4.04e9 } }] },
      { meta: { type: ["quarterlyTotalAssets"] }, quarterlyTotalAssets: [
        { asOfDate: "2026-03-31", periodType: "3M", currencyCode: "USD", reportedValue: { raw: 1.8e10 } }] },
    ] },
  };

  it("names a non-rupee reporting currency", () => {
    expect(foreignReportingCurrency(inDollars)).toBe("USD");
    expect(foreignReportingCurrency(tcs)).toBeNull();
  });

  it("never stores a figure that is not in rupees", () => {
    expect(parseTimeseriesCashflow(inDollars)).toEqual([]);
    expect(parseTimeseriesBalance(inDollars)).toEqual([]);
  });
});
