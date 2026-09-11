import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseScreenerPage, screenerNumber, monthEnd } from "../../supabase/functions/_shared/screener-in";
import { parseStatement } from "../../supabase/functions/_shared/indianapi";

/*
 * screener.in company pages, captured 2026-09-11. IndianAPI serves
 * screener.in's figures, so a page must read into exactly the grids
 * IndianAPI returns for the same company - same labels, same crore figures,
 * same periods - and cover every listed company where IndianAPI's plan stops
 * at about eighty a day.
 */

const page = (name: string) => parseScreenerPage(readFileSync(`src/test/fixtures/screener-in/${name}.html`, "utf-8"));
const reliance = page("reliance");
const indian = (name: string) => parseStatement(JSON.parse(readFileSync(`src/test/fixtures/indianapi/${name}.json`, "utf-8")))!;

describe("screenerNumber", () => {
  it("reads grouped figures, percentages and negatives", () => {
    expect(screenerNumber(" 2,07,559 ")).toBe(207559);
    expect(screenerNumber("18%")).toBe(18);
    expect(screenerNumber("-1,234.5")).toBe(-1234.5);
    expect(screenerNumber("")).toBeNull();
    expect(screenerNumber("Raw PDF")).toBeNull();
  });
});

describe("monthEnd", () => {
  it("dates a month label to its last day", () => {
    expect(monthEnd("Jun 2026")).toBe("2026-06-30");
    expect(monthEnd("Feb 2024")).toBe("2024-02-29");
    expect(monthEnd("TTM")).toBeNull();
  });
});

describe("parseScreenerPage - statements", () => {
  it("reads the quarterly results exactly as IndianAPI serves them", () => {
    const q = reliance.statements.quarter_results!;
    const api = indian("reliance-quarter_results");
    expect(q.periods).toEqual(api.periods);
    expect(q.period_ends).toEqual(api.period_ends);
    expect(q.rows.map((r) => r.label)).toEqual(api.rows.map((r) => r.label));
    expect(q.rows.find((r) => r.label === "Sales")!.values).toEqual(api.rows.find((r) => r.label === "Sales")!.values);
    expect(q.rows.find((r) => r.label === "OPM %")!.values.slice(-1)).toEqual([15]);
  });

  it("keeps the trailing-twelve-month column of the annual results undated", () => {
    const y = reliance.statements.yoy_results!;
    expect(y.periods[y.periods.length - 1]).toBe("TTM");
    expect(y.period_ends[y.period_ends.length - 1]).toBeNull();
    expect(y.rows.map((r) => r.label)).toContain("Dividend Payout %");
  });

  it("reads the balance sheet, cash flow and ratios", () => {
    const bs = reliance.statements.balancesheet!;
    const last = (label: string) => { const r = bs.rows.find((x) => x.label === label)!; return r.values[r.values.length - 1]; };
    expect(last("Equity Capital")).toBe(13532);
    expect(last("Borrowings")).toBe(402962);
    expect(reliance.statements.cashflow!.rows.map((r) => r.label)).toContain("Cash from Operating Activity");
    expect(reliance.statements.ratios!.rows.map((r) => r.label)).toContain("ROCE %");
  });

  it("reads a bank's layout - revenue and financing margin", () => {
    const labels = page("hdfcbank").statements.quarter_results!.rows.map((r) => r.label);
    expect(labels).toContain("Revenue");
    expect(labels).toContain("Financing Margin %");
  });
});

describe("parseScreenerPage - company facts", () => {
  it("identifies the company by its NSE symbol and BSE code, on a consolidated basis", () => {
    expect(reliance).toMatchObject({ nse_symbol: "RELIANCE", bse_code: "500325", basis: "consolidated" });
    expect(reliance.name).toMatch(/Reliance Industries/);
    expect(reliance.about).toMatch(/Dhirubhai Ambani/);
  });

  it("reads the headline ratios", () => {
    expect(reliance.top_ratios).toMatchObject({ market_cap: 1703002, price: 1258, high_52: 1612, low_52: 1250, pe: 22.8, book_value: 668, dividend_yield: 0.47, roce: 10.3, roe: 8.91, face_value: 10 });
  });

  it("reads compounded growth by horizon", () => {
    const sales = reliance.growth.find((g) => g.title === "Compounded Sales Growth")!;
    expect(sales.values).toContainEqual({ period: "3 Years", pct: 6 });
    expect(reliance.growth.map((g) => g.title)).toEqual(["Compounded Sales Growth", "Compounded Profit Growth", "Stock Price CAGR", "Return on Equity"]);
  });

  it("reads twelve quarters of shareholding, named as IndianAPI names holders, without the shareholder count", () => {
    const cats = reliance.shareholding.map((s) => s.category);
    expect(cats).toEqual(["Promoter", "FII", "DII", "Government", "Public"]);
    const promoter = reliance.shareholding[0].points;
    expect(promoter[promoter.length - 1]).toEqual({ date: "2026-06-30", pct: 50.48 });
    expect(promoter).toHaveLength(12);
  });

  it("reads the pros and cons", () => {
    expect(reliance.cons).toContain("Company has a low return on equity of 8.77% over last 3 years.");
  });

  it("reads annual reports, credit ratings and concalls as links", () => {
    const { annual_reports, credit_ratings, concalls } = reliance.documents;
    expect(annual_reports[0]).toMatchObject({ title: "Annual Report 2026", note: "from bse" });
    expect(annual_reports[0].url).toMatch(/^https:\/\/www\.bseindia\.com\//);
    expect(credit_ratings[0]).toMatchObject({ title: "Rating update" });
    expect(concalls[0]).toMatchObject({ period: "Jul 2026" });
    expect(concalls[0].transcript).toMatch(/^https:\/\//);
  });
});

describe("parseScreenerPage - malformed entities", () => {
  it("does not throw on a code point no character has", () => {
    expect(() => parseScreenerPage('<h1>Bad &#99999999; name</h1>')).not.toThrow();
  });
});
