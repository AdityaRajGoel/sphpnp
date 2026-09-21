import { describe, it, expect } from "vitest";
import { fiscalQuarter, resultsSummary, type IncomeRow } from "../../supabase/functions/_shared/results-summary";

const row = (period_end: string, source: string, is_consolidated: boolean, revenue: number, profit_after_tax: number | null): IncomeRow =>
  ({ period_end, source, is_consolidated, revenue, profit_after_tax });

describe("fiscalQuarter", () => {
  it("maps quarter ends to the Indian fiscal year", () => {
    expect(["2026-06-30", "2026-09-30", "2026-12-31", "2027-03-31"].map(fiscalQuarter)).toEqual(["Q1 FY27", "Q2 FY27", "Q3 FY27", "Q4 FY27"]);
  });
});

describe("resultsSummary", () => {
  it("prefers the NSE filing, consolidated, and compares with the same quarter a year back", () => {
    const s = resultsSummary([
      row("2026-06-30", "yahoo", true, 3094.68e9, 209.46e9),
      row("2026-06-30", "nse_xbrl", false, 1660e9, 132e9),
      row("2026-06-30", "nse_xbrl", true, 3118.5e9, 231.96e9),
      row("2025-06-30", "nse_xbrl", true, 2800e9, 200e9),
    ])!;
    expect(s.basis).toBe("consolidated");
    expect(s.text).toBe("Q1 FY27: revenue ₹3,11,850 Cr (+11.4% YoY), net profit ₹23,196 Cr (+16.0% YoY), net margin 7.4%");
  });

  it("does not compare across sources or bases", () => {
    const s = resultsSummary([
      row("2026-06-30", "nse_xbrl", true, 100e9, 10e9),
      row("2025-06-30", "yahoo", true, 50e9, 5e9),
      row("2025-06-30", "nse_xbrl", false, 50e9, 5e9),
    ])!;
    expect(s.revenue_yoy).toBeNull();
    expect(s.text).toBe("Q1 FY27: revenue ₹10,000 Cr, net profit ₹1,000 Cr, net margin 10.0%");
  });

  it("returns null without a revenue figure", () => {
    expect(resultsSummary([row("2026-06-30", "nse_xbrl", true, 0, 1)])).toBeNull();
  });
});
