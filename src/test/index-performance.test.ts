import { describe, expect, it } from "vitest";
import { alignRupees, annualised, monthTicks, trailingReturns, yearRange, GOLD_10G_PER_OZ, SILVER_KG_PER_OZ } from "@/lib/index-performance";

const day = (iso: string, close: number | null) => ({ trade_date: iso, close });

describe("trailingReturns", () => {
  const closes = [day("2024-12-31", 100), day("2025-06-30", 120), day("2025-12-24", 150), day("2025-12-31", 165), day("2026-01-01", null)];

  it("measures each period from the last close on or before its cutoff, skipping null closes", () => {
    const r = Object.fromEntries(trailingReturns(closes).map((p) => [p.key, p.pct]));
    expect(r["1W"]).toBeCloseTo(10); // 24 Dec 150 -> 165
    expect(r["1Y"]).toBeCloseTo(65); // 31 Dec 2024 100 -> 165
  });

  it("returns null for a period the history does not reach, never a shorter period's figure", () => {
    expect(trailingReturns(closes).find((p) => p.key === "2Y")?.pct).toBeNull();
  });

  it("returns nothing for an empty series", () => {
    expect(trailingReturns([]).every((p) => p.pct === null)).toBe(true);
  });
});

describe("yearRange", () => {
  it("finds the high and low of the last 365 days only, with their dates and the gap from the high", () => {
    const r = yearRange([day("2024-12-01", 500), day("2025-03-01", 90), day("2025-09-01", 140), day("2025-12-31", 126)]);
    expect(r).toMatchObject({ high: 140, highDate: "2025-09-01", low: 90, lowDate: "2025-03-01", last: 126 });
    expect(r?.fromHigh).toBeCloseTo(-10);
  });

  it("is null without a close", () => {
    expect(yearRange([day("2025-01-01", null)])).toBeNull();
  });
});

describe("alignRupees", () => {
  it("converts at the latest USD/INR on or before each date, and drops dates before the first rate", () => {
    const metal = [{ trade_date: "2025-01-01", close: 2000 }, { trade_date: "2025-01-03", close: 2100 }];
    const inr = [{ trade_date: "2025-01-02", close: 80 }];
    expect(alignRupees(metal, inr, GOLD_10G_PER_OZ)).toEqual([{ trade_date: "2025-01-03", close: 2100 * 80 * GOLD_10G_PER_OZ }]);
  });

  it("uses troy-ounce factors: 10 g of gold and 1 kg of silver", () => {
    expect(GOLD_10G_PER_OZ * 31.1034768).toBeCloseTo(10);
    expect(SILVER_KG_PER_OZ * 31.1034768).toBeCloseTo(1000);
  });
});

describe("monthTicks", () => {
  // Recharts spaced ticks by pixel gap, so one month could be labelled twice ("Jan 26", "Jan 26").
  it("ticks the first trading day of each month, once", () => {
    expect(monthTicks(["2026-01-02", "2026-01-20", "2026-02-02", "2026-02-27", "2026-03-02"])).toEqual(["2026-01-02", "2026-02-02", "2026-03-02"]);
  });

  it("thins to at most `max` ticks, keeping every k-th month", () => {
    const dates = Array.from({ length: 24 }, (_, i) => `${2025 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-01`);
    const ticks = monthTicks(dates, 8); // explicit max
    expect(ticks.length).toBeLessThanOrEqual(8);
    expect(ticks[0]).toBe("2025-01-01");
  });
});

describe("annualised", () => {
  it("compounds the change over the years the history spans", () => {
    const closes = [day("2016-09-30", 100), day("2021-10-01", 150), day("2026-10-02", 400)];
    expect(annualised(closes, 10)).toBeCloseTo((4 ** (1 / 10) - 1) * 100, 1);
    expect(annualised(closes, 5)).toBeCloseTo(((400 / 150) ** (1 / 5) - 1) * 100, 1);
  });

  it("is null when the history is shorter than the period", () => {
    expect(annualised([day("2025-10-02", 100), day("2026-10-02", 110)], 5)).toBeNull();
  });
});

describe("monthTicks over several years", () => {
  it("ticks the first trading day of each year rather than odd months", () => {
    const dates: string[] = [];
    // Starts in October, as a five-year window ending this month does.
    for (let y = 2021; y <= 2026; y++) for (let m = 1; m <= 12; m++) if (y > 2021 || m >= 10) dates.push(`${y}-${String(m).padStart(2, "0")}-03`);
    const ticks = monthTicks(dates, 6);
    expect(ticks.every((d) => d.slice(5, 7) === "01")).toBe(true);
    expect(ticks.length).toBeLessThanOrEqual(6);
  });
});

describe("annualised at the start of the stored history", () => {
  it("counts a history that begins a day after the anchor, over the span it covers", () => {
    const closes = [{ trade_date: "2016-10-03", close: 100 }, { trade_date: "2026-10-02", close: 200 }];
    const r = annualised(closes, 10)!;
    expect(r).toBeGreaterThan(7.1);
    expect(r).toBeLessThan(7.25);
    expect(annualised([{ trade_date: "2016-11-01", close: 100 }, { trade_date: "2026-10-02", close: 200 }], 10)).toBeNull();
  });
});
