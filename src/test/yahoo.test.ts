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
    {
      endDate: { raw: 1719187200 },              // 2024-06-30, only short-term debt
      shortLongTermDebt: { raw: 75000000000 },
    },
    {
      endDate: { raw: 1710806400 },              // 2024-03-31, only long-term debt
      longTermDebt: { raw: 300000000000 },
    },
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

  it("returns only short-term debt when long-term is absent", () => {
    expect(parseBalanceSheet(balanceJson)[2].totalDebt).toBe(75000000000);
  });

  it("returns only long-term debt when short-term is absent", () => {
    expect(parseBalanceSheet(balanceJson)[3].totalDebt).toBe(300000000000);
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
