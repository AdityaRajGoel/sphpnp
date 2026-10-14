import { describe, expect, it } from "vitest";
import { analysisProgress, progressStep } from "@/lib/ai-progress";
import { reportFacts } from "@/components/AIAnalysisModal";

describe("AI loading bar", () => {
  it("never reaches 100% before the report arrives, however long it takes", () => {
    expect(analysisProgress(0, false)).toBe(0);
    expect(analysisProgress(8_000, false)).toBeGreaterThan(40);
    expect(analysisProgress(8_000, false)).toBeLessThan(60);
    expect(analysisProgress(120_000, false)).toBeLessThan(96);
    expect(analysisProgress(3_000, true)).toBe(100);
  });

  it("keeps the last step active while waiting and completes every step on arrival", () => {
    expect(progressStep(analysisProgress(0, false), 6, false)).toBe(0);
    expect(progressStep(analysisProgress(600_000, false), 6, false)).toBe(5);
    expect(progressStep(100, 6, true)).toBe(6);
  });
});

describe("chat context from the report", () => {
  it("lists the verdict, levels and indicator readings, and nothing before a report exists", () => {
    expect(reportFacts(undefined)).toEqual([]);
    expect(reportFacts({
      action_verdict: "HOLD", rating_label: "Neutral", sentiment_score: 47,
      price_targets: { support: 2150, resistance: null, target_1m: 2380, target_3m: 2450 },
      key_indicators: { "SMA 200": "₹2,480 (price below)" },
    })).toEqual([
      "Report verdict: HOLD (Neutral), score 47/100",
      "Report levels: support 2150 | resistance N/A | 1M target 2380 | 3M target 2450",
      "Report indicators: SMA 200: ₹2,480 (price below)",
    ]);
  });
});
