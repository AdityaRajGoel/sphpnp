import { describe, expect, it } from "vitest";
import { correlation, maxDrawdown, seasonality, volatility } from "@/lib/commodity-research";

const day = (iso: string, close: number) => ({ trade_date: iso, close });

describe("volatility", () => {
  it("annualises the spread of daily log returns over the last year", () => {
    // Alternating +1% / -1% days: a daily standard deviation of about 1%.
    const closes = Array.from({ length: 300 }, (_, i) => day(new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10), i % 2 ? 101 : 100));
    expect(volatility(closes)).toBeGreaterThan(14);
    expect(volatility(closes)).toBeLessThan(17);
  });

  it("is null with too few closes", () => {
    expect(volatility([day("2026-01-01", 1)])).toBeNull();
  });
});

describe("maxDrawdown", () => {
  it("finds the deepest fall from a running peak, with its dates", () => {
    const r = maxDrawdown([day("2026-01-01", 100), day("2026-02-01", 150), day("2026-03-01", 90), day("2026-04-01", 160)]);
    expect(r).toMatchObject({ pct: -40, peakDate: "2026-02-01", troughDate: "2026-03-01" });
  });
});

describe("seasonality", () => {
  it("averages each calendar month's return across years and counts the up years", () => {
    const closes = [day("2024-12-31", 100), day("2025-01-31", 110), day("2025-12-31", 100), day("2026-01-31", 95), day("2026-02-27", 96)];
    const jan = seasonality(closes).find((m) => m.month === 0)!;
    expect(jan.years).toBe(2);
    expect(jan.up).toBe(1);
    expect(jan.avg).toBeCloseTo((10 + -5) / 2);
  });
});

describe("correlation", () => {
  it("is +1 for series that move together and -1 for opposite moves, matched by date", () => {
    const a = [day("2026-01-01", 100), day("2026-01-02", 110), day("2026-01-03", 99), day("2026-01-04", 120)];
    const same = a.map((p) => ({ ...p, close: p.close * 2 }));
    const opposite = [day("2026-01-01", 100), day("2026-01-02", 90), day("2026-01-03", 99), day("2026-01-04", 80)];
    expect(correlation(a, same)).toBeCloseTo(1);
    expect(correlation(a, opposite)!).toBeLessThan(-0.9);
  });
});
