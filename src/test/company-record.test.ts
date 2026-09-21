import { describe, it, expect } from "vitest";
import { formatCompanyRecord, type CompanyRecord } from "../../supabase/functions/_shared/company-record";

const empty: CompanyRecord = { shareholding: [], insider: [], pledge: null, deals: [], delivery: [], filings: [], score: null };

describe("formatCompanyRecord", () => {
  it("returns nothing when we hold no disclosures, so the prompt gains no empty heading", () => {
    expect(formatCompanyRecord(empty)).toBe("");
  });

  it("reports the promoter holding change against the oldest quarter held", () => {
    const out = formatCompanyRecord({
      ...empty,
      shareholding: [
        { quarter_end: "2026-06-30", promoter_pct: 50.1 },
        { quarter_end: "2026-03-31", promoter_pct: 51 },
        { quarter_end: "2025-12-31", promoter_pct: 52.6 },
      ],
    });
    expect(out).toContain("50.10% (quarter ended 2026-06-30); -2.50 pts since 2025-12-31");
  });

  it("counts open-market trades only and splits out the promoter group, in crore", () => {
    const out = formatCompanyRecord({
      ...empty,
      insider: [
        { person: "A", category: "Promoter Group", transaction: "sell", mode: "Market Sale", value: 25e7, traded_to: "2026-09-01" },
        { person: "E", category: "Employees", transaction: "buy", mode: "ESOP", value: 9e7, traded_to: "2026-09-01" },
        { person: "B", category: "Employees", transaction: "buy", mode: "Market Purchase", value: 1e7, traded_to: "2026-09-02" },
        { person: "C", category: null, transaction: "sell", mode: "Market Sale", value: null, traded_to: null },
      ],
    });
    expect(out).toContain("bought ₹1.00 Cr, sold ₹25 Cr - of which promoter group bought ₹0.00 Cr, sold ₹25 Cr");
  });

  it("needs ten delivery sessions before comparing recent with prior", () => {
    const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ trade_date: `d${i}`, deliv_pct: i < 5 ? 60 : 40 }));
    expect(formatCompanyRecord({ ...empty, delivery: rows(9) })).toBe("");
    expect(formatCompanyRecord({ ...empty, delivery: rows(20) })).toContain("avg 60.0% vs 40.0% over the 15 sessions before");
  });

  it("shows FCF yield as a percent and skips missing score parts", () => {
    const out = formatCompanyRecord({
      ...empty,
      score: {
        period_end: "2026-03-31", piotroski_score: 6, piotroski_testable: 8, net_debt_to_equity: null,
        cash_conversion: 1.2, fcf_yield: 0.034, revenue_cagr_3y: 12.5, profit_cagr_3y: null,
      },
    });
    expect(out).toContain("Piotroski 6/8 testable · 3Y revenue CAGR 12.5% · operating cash/profit 1.20x · FCF yield 3.4%");
    expect(out).not.toContain("net debt");
  });
});
