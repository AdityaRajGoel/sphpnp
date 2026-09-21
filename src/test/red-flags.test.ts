import { describe, it, expect } from "vitest";
import { redFlags, type RedFlagInputs } from "../../supabase/functions/_shared/red-flags";

const NOW = Date.parse("2026-09-21T06:00:00Z");
const none: RedFlagInputs = { pledges: [], holdings: [], trades: [], surveillance: [], score: null, filings: [] };
const ids = (i: Partial<RedFlagInputs>) => redFlags({ ...none, ...i }, NOW).map((f) => `${f.id}:${f.severity}`);

describe("redFlags", () => {
  it("raises nothing for a company with nothing on record", () => {
    expect(redFlags(none, NOW)).toEqual([]);
  });

  it("flags a pledge that rose, and any pledge over 25% as high", () => {
    expect(ids({ pledges: [{ shp_date: "2026-06-30", pledged_pct_of_promoter: 5 }, { shp_date: "2026-03-31", pledged_pct_of_promoter: 2 }] })).toEqual(["pledge:medium"]);
    expect(ids({ pledges: [{ shp_date: "2026-06-30", pledged_pct_of_promoter: 30 }] })).toEqual(["pledge:high"]);
    expect(ids({ pledges: [{ shp_date: "2026-06-30", pledged_pct_of_promoter: 5 }, { shp_date: "2026-03-31", pledged_pct_of_promoter: 5 }] })).toEqual([]);
  });

  it("counts only promoter open-market selling inside 90 days", () => {
    const sale = (value: number, mode = "Market Sale", traded_to = "2026-09-01", category = "Promoter Group") => ({ category, transaction: "sell", mode, value, traded_to });
    expect(ids({ trades: [sale(2e7)] })).toEqual(["promoter-selling:medium"]);
    expect(ids({ trades: [sale(2e7, "Inter-se-Transfer")] })).toEqual([]);
    expect(ids({ trades: [sale(2e7, "Market Sale", "2026-05-01")] })).toEqual([]);
    expect(ids({ trades: [sale(2e7, "Market Sale", "2026-09-01", "Employees")] })).toEqual([]);
  });

  it("flags a promoter holding down two points or more", () => {
    expect(ids({ holdings: [{ quarter_end: "2026-06-30", promoter_pct: 48 }, { quarter_end: "2025-06-30", promoter_pct: 50.5 }] })).toEqual(["holding-drop:medium"]);
  });

  it("puts surveillance first and ignores an old critical filing", () => {
    expect(ids({
      surveillance: [{ flag: "asm_long", stage: "Stage 1", as_of: "2026-09-19" }],
      score: { period_end: "2026-03-31", piotroski_score: 2, piotroski_testable: 8 },
      filings: [
        { subject: "Resignation of Statutory Auditor", critical: false, published_at: "2026-09-10T10:00:00Z" },
        { subject: "Shareholder Meeting / Postal Ballot-Outcome of AGM", critical: true, published_at: "2026-09-11T10:00:00Z" },
        { subject: "Announcement under Regulation 30 (LODR)-Credit Rating", critical: true, published_at: "2026-09-12T10:00:00Z" },
        { subject: "Resignation of Statutory Auditor", critical: true, published_at: "2026-07-01T10:00:00Z" },
        { subject: "Notice In Accordance With NCLT Order Regarding Merger Of A Subsidiary", critical: false, published_at: "2026-09-13T10:00:00Z" },
      ],
    })).toEqual(["surveillance-asm_long:high", "piotroski:medium", "filing-2026-09-10T10:00:00Z:medium"]);
  });
});
