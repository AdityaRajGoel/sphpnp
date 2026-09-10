import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  parsePeriodLabel,
  parseStatement,
  flattenKeyMetrics,
  parseTechnicals,
  parseShareholding,
  verifyIdentity,
  crossCheckRevenue,
  deriveRoe,
} from "../../supabase/functions/_shared/indianapi";

/*
 * IndianAPI responses, captured 2026-09-10 from the live API.
 *
 * The stock pages showed NSE filings frozen at Dec 2024 for 118 of 246 stocks
 * and nothing at all for 89; banks parsed as empty rows. IndianAPI returns the
 * statements in Screener.in's own layout, current to Jun 2026, so the rules
 * under test are: every figure lands under the right period, a missing figure
 * stays missing rather than becoming zero, and nothing is stored under a
 * symbol unless the response is provably about that company.
 */

const last = <T,>(items: T[]): T => items[items.length - 1];

const fixture = (name: string) =>
  JSON.parse(readFileSync(`src/test/fixtures/indianapi/${name}.json`, "utf-8"));

describe("parsePeriodLabel", () => {
  it("turns a month label into that month's last day", () => {
    expect(parsePeriodLabel("Jun 2026")).toBe("2026-06-30");
    expect(parsePeriodLabel("Mar 2024")).toBe("2024-03-31");
    expect(parsePeriodLabel("Feb 2024")).toBe("2024-02-29");
    expect(parsePeriodLabel("Dec 2025")).toBe("2025-12-31");
  });

  it("gives no date for TTM or anything unreadable", () => {
    expect(parsePeriodLabel("TTM")).toBeNull();
    expect(parsePeriodLabel("")).toBeNull();
    expect(parsePeriodLabel("Q1 FY27")).toBeNull();
  });
});

describe("parseStatement", () => {
  it("reads quarterly results in period order with every row aligned", () => {
    const s = parseStatement(fixture("reliance-quarter_results"))!;
    expect(s.periods).toHaveLength(13);
    expect(s.periods[0]).toBe("Jun 2023");
    expect(last(s.periods)).toBe("Jun 2026");
    expect(last(s.period_ends)).toBe("2026-06-30");
    const sales = s.rows.find((r) => r.label === "Sales")!;
    expect(sales.values).toHaveLength(13);
    expect(last(sales.values)).toBe(309468);
    expect(s.rows.map((r) => r.label)).toContain("EPS in Rs");
  });

  it("keeps TTM as the last column with no period end", () => {
    const s = parseStatement(fixture("reliance-yoy_results"))!;
    expect(last(s.periods)).toBe("TTM");
    expect(last(s.period_ends)).toBeNull();
    expect(s.periods[s.periods.length - 2]).toBe("Mar 2026");
  });

  it("reads a bank's layout, which has Revenue and Financing Profit instead of Sales", () => {
    const s = parseStatement(fixture("hdfcbank-quarter_results"))!;
    expect(s.rows[0].label).toBe("Revenue");
    expect(s.rows.map((r) => r.label)).toContain("Financing Profit");
    expect(last(s.rows[0].values)).toBe(90575);
  });

  it("keeps a missing figure as null rather than zero", () => {
    const s = parseStatement({ Sales: { "Mar 2025": 10, "Mar 2026": null }, Expenses: { "Mar 2025": "", "Mar 2026": "7" } })!;
    expect(s.rows).toEqual([
      { label: "Sales", values: [10, null] },
      { label: "Expenses", values: [null, 7] },
    ]);
  });

  it("aligns rows that do not all carry every period", () => {
    const s = parseStatement({ A: { "Mar 2025": 1, "Mar 2026": 2 }, B: { "Mar 2026": 3 } })!;
    expect(s.periods).toEqual(["Mar 2025", "Mar 2026"]);
    expect(s.rows[1].values).toEqual([null, 3]);
  });

  it("rejects anything that is not a statement", () => {
    expect(parseStatement(null)).toBeNull();
    expect(parseStatement({ error: "Stock not found" })).toBeNull();
    expect(parseStatement([])).toBeNull();
    expect(parseStatement({})).toBeNull();
  });
});

describe("flattenKeyMetrics", () => {
  const km = flattenKeyMetrics(fixture("reliance-stock").keyMetrics);

  it("reads numbers out of the grouped string values", () => {
    expect(km.valuation.pPerEBasicExcludingExtraordinaryItemsTTM).toBe(23.43);
    expect(km.financialstrength.currentRatioMostRecentFiscalYear).toBe(1.1);
    expect(km.priceandVolume.marketCap).toBe(1751516.49);
  });

  it("repairs the stray punctuation in some upstream keys", () => {
    // Upstream sends "inventoryTurnoverTrailing12Month)" with a trailing paren.
    expect("inventoryTurnoverTrailing12Month" in km.mgmtEffectiveness).toBe(true);
  });

  it("keeps an absent metric null", () => {
    expect(km.mgmtEffectiveness.returnOnInvestmentTrailing12Month).toBeNull();
  });
});

describe("parseTechnicals", () => {
  it("reads the moving averages by window", () => {
    const t = parseTechnicals(fixture("reliance-stock").stockTechnicalData);
    expect(t.map((x) => x.days)).toEqual([5, 10, 20, 50, 100, 300]);
    expect(t[0]).toEqual({ days: 5, nse: 1304.72, bse: 1305.71 });
  });
});

describe("parseShareholding", () => {
  it("reads each holder category as a dated series", () => {
    const sh = parseShareholding(fixture("reliance-stock").shareholding);
    const promoter = sh.find((c) => c.category === "Promoter")!;
    expect(last(promoter.points)).toEqual({ date: "2026-06-30", pct: 50.48 });
  });
});

describe("verifyIdentity", () => {
  const stock = fixture("reliance-stock");

  it("accepts a response whose NSE code is the symbol asked for", () => {
    expect(verifyIdentity(stock, "RELIANCE")).toEqual({ ok: true });
    expect(verifyIdentity(stock, "reliance")).toEqual({ ok: true });
  });

  it("refuses a response about some other company", () => {
    // /stock?name= is a search. A symbol like M&M can resolve to a different
    // company, and saving its financials under this symbol would be worse
    // than showing nothing.
    const result = verifyIdentity(stock, "RELINFRA");
    expect(result).toEqual({ ok: false, reason: expect.stringMatching(/RELIANCE/) });
  });

  it("refuses a response with no NSE code at all", () => {
    expect(verifyIdentity({ companyProfile: {} }, "RELIANCE").ok).toBe(false);
    expect(verifyIdentity(null, "RELIANCE").ok).toBe(false);
  });
});

describe("crossCheckRevenue", () => {
  const stock = fixture("reliance-stock");
  const quarters = parseStatement(fixture("reliance-quarter_results"))!;

  it("agrees when both endpoints describe the same company", () => {
    // /stock's Jun 2026 revenue is 3,11,850 Cr; the statement's Sales 3,09,468 Cr.
    expect(crossCheckRevenue(stock, quarters)).toMatchObject({ ok: true, verified: true });
  });

  it("fails when the statement is a different company's", () => {
    const other = parseStatement(fixture("hdfcbank-quarter_results"))!;
    expect(crossCheckRevenue(stock, other)).toMatchObject({ ok: false });
  });

  it("accepts a company whose revenue is reported gross of excise when its profit agrees", () => {
    // GODFRYPHLP: /stock's TotalRevenue included excise duty (3,819.56 Cr against
    // Screener's Sales of 1,206 Cr) and the revenue check alone rejected a
    // correct match. EPS is per share, so it still identifies the company.
    const excise = parseStatement({
      Sales: { "Jun 2026": 309468 / 3, "Mar 2026": 294059 / 3 },
      "EPS in Rs": { "Jun 2026": 15.48, "Mar 2026": 12.54 },
    })!;
    expect(crossCheckRevenue(stock, excise)).toMatchObject({ ok: true, verified: true });
  });

  it("fails when EPS agrees in one quarter but not another", () => {
    // HDFC Bank's EPS happens to sit within 5% of Reliance's in Mar 2026 (13.22
    // against 12.54) but is 19% off in Jun 2026 - one coincidence is not a match.
    const wrong = parseStatement({
      Sales: { "Jun 2026": 90575, "Mar 2026": 87182 },
      "EPS in Rs": { "Jun 2026": 12.5, "Mar 2026": 12.9 },
    })!;
    expect(crossCheckRevenue(stock, wrong)).toMatchObject({ ok: false });
  });

  it("passes but reports unverified when the two share no quarter", () => {
    const disjoint = parseStatement({ Sales: { "Mar 2010": 5 } })!;
    expect(crossCheckRevenue(stock, disjoint)).toEqual({ ok: true, verified: false });
  });
});

describe("deriveRoe", () => {
  it("is net profit over average shareholders' equity, per fiscal year", () => {
    const roe = deriveRoe(
      parseStatement(fixture("reliance-yoy_results"))!,
      parseStatement(fixture("reliance-balancesheet"))!,
    );
    const fy26 = roe.find((r) => r.period_end === "2026-03-31")!;
    // Equity = Equity Capital + Reserves: 8,43,200 (FY25) and 9,04,030 (FY26).
    const netProfit = parseStatement(fixture("reliance-yoy_results"))!.rows
      .find((r) => r.label === "Net Profit")!.values[
        parseStatement(fixture("reliance-yoy_results"))!.periods.indexOf("Mar 2026")];
    expect(fy26.roe).toBeCloseTo((netProfit! / ((843200 + 904030) / 2)) * 100, 2);
  });

  it("gives no ROE for a year whose opening equity is unknown", () => {
    const roe = deriveRoe(
      parseStatement({ "Net Profit": { "Mar 2026": 10 } })!,
      parseStatement({ "Equity Capital": { "Mar 2026": 1 }, Reserves: { "Mar 2026": 99 } })!,
    );
    expect(roe).toEqual([]);
  });
});
