import { describe, expect, it } from "vitest";
import { summarise, type EodBar } from "@/lib/lite-stock";

const bar = (d: number, close: number, extra: Partial<EodBar> = {}): EodBar => ({ trade_date: `2026-09-${String(d).padStart(2, "0")}`, open: close, high: close + 2, low: close - 2, close, prev_close: null, volume: 1000, deliv_pct: 40, turnover_lacs: 1, ...extra });

describe("summarise", () => {
  it("takes the day's change from the bhavcopy's previous close and the range from highs and lows", () => {
    const s = summarise([bar(1, 100), bar(2, 120), bar(3, 110, { prev_close: 120, volume: 3000, deliv_pct: 70 })])!;
    expect(s.changePct).toBeCloseTo(-8.333, 2);
    expect(s.high52).toBe(122);
    expect(s.low52).toBe(98);
    expect(s.volumeVsAvg).toBeCloseTo(3);
    expect(s.avgDelivery20).toBeCloseTo(50);
  });
  it("is null without bars", () => {
    expect(summarise([])).toBeNull();
  });
});
