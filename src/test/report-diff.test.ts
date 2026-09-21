import { describe, it, expect } from "vitest";
import { reportChanges } from "../../supabase/functions/_shared/report-diff";

const sd = (verdict: string, score: number, tech: number, target3m: number) => ({
  action_verdict: verdict, sentiment_score: score, confidence: 60,
  score_breakdown: { technical: tech, fundamental: 50 }, price_targets: { target_3m: target3m },
});

describe("reportChanges", () => {
  it("returns nothing on a stock's first report", () => {
    expect(reportChanges(null, { sd: sd("HOLD", 50, 50, 100), price: 100 })).toBeNull();
  });

  it("names the verdict change and each score that moved by 3 or more", () => {
    const out = reportChanges(
      { sd: sd("HOLD", 55, 48, 1000), price: 950, createdAt: "2026-09-18T04:00:00Z" },
      { sd: sd("BUY", 64, 49, 1100), price: 1000 },
    )!;
    expect(out.since).toBe("2026-09-18T04:00:00Z");
    expect(out.items).toEqual([
      "Verdict moved from HOLD to BUY",
      "Composite score rose from 55 to 64",
      "3-month target raised from ₹1000 to ₹1100",
      "Price up 5.3% since then (₹950 → ₹1000)",
    ]);
  });

  it("says so when nothing material moved", () => {
    const same = sd("HOLD", 50, 50, 100);
    expect(reportChanges({ sd: same, price: 100, createdAt: "x" }, { sd: same, price: 100 })!.items).toEqual(["No material change in the verdict, scores or targets"]);
  });
});
