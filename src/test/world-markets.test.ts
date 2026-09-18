import { describe, it, expect } from "vitest";
import { BOARD, INDIA_ETFS, INDIA_SECTORS, WORLD_INDICES, summariseChart, summariseSeries, fxSymbol, inDollars } from "../../supabase/functions/_shared/world-markets";

const chart = (closes: (number | null)[], volumes?: (number | null)[]) => ({
  chart: {
    result: [{
      meta: { currency: "INR" },
      timestamp: closes.map((_, i) => 1_750_000_000 + i * 86_400),
      indicators: { quote: [{ close: closes, volume: volumes ?? closes.map(() => 1000) }] },
    }],
  },
});

describe("board lists", () => {
  it("cover the world markets with unique symbols", () => {
    expect(WORLD_INDICES.length).toBeGreaterThanOrEqual(35);
    expect(new Set(BOARD.map((b) => b.symbol)).size).toBe(BOARD.length);
  });

  it("drops the five exchanges Yahoo no longer serves", () => {
    // Every one failed on every run (checked on the live board, 2026-09-18).
    for (const dead of ["^OSEAX", "^SET.BK", "PSEI.PS", "^TASI.SR", "DFMGI.AE"]) {
      expect(BOARD.some((b) => b.symbol === dead)).toBe(false);
    }
  });

  it("names the NSE index behind every sector tile", () => {
    // Sectors come from index_valuation_daily (NSE's own file), not Yahoo, where
    // ten of the fifteen symbols had stopped resolving.
    expect(INDIA_SECTORS.every((s) => typeof s.nse === "string" && s.nse.length > 0)).toBe(true);
  });
});

describe("summariseChart", () => {
  const closes = Array.from({ length: 70 }, (_, i) => 100 + i);

  it("computes changes over 1, 5, 21 and 62 sessions, skipping null closes", () => {
    const row = summariseChart(WORLD_INDICES[0], chart([...closes.slice(0, 10), null, ...closes.slice(10)]))!;
    expect(row.last).toBe(169);
    expect(row.day).toBeCloseTo((169 / 168 - 1) * 100, 10);
    expect(row.week).toBeCloseTo((169 / 164 - 1) * 100, 10);
    expect(row.quarter).toBeCloseTo((169 / 107 - 1) * 100, 10);
    expect(row.spark).toHaveLength(22);
    expect(row.est_flow_cr).toBeNull();
  });

  it("estimates ETF flow as signed traded value, and reads a volume spike", () => {
    const volumes = [...closes.map(() => 1_000_000).slice(0, 69), 3_000_000];
    const row = summariseChart(INDIA_ETFS[0], chart(closes, volumes))!;
    expect(row.volume_ratio).toBeCloseTo(3, 10);
    expect(row.est_flow_cr).toBeCloseTo((3_000_000 * 169) / 1e7, 6);
  });

  it("refuses a response without two usable closes", () => {
    expect(summariseChart(WORLD_INDICES[0], chart([100]))).toBeNull();
    expect(summariseChart(WORLD_INDICES[0], { chart: { result: [] } })).toBeNull();
  });
});

describe("summariseSeries", () => {
  it("summarises stored daily closes the same way as a Yahoo chart", () => {
    const closes = Array.from({ length: 70 }, (_, i) => 100 + i);
    const points = closes.map((close, i) => ({ date: `2026-06-${String((i % 28) + 1).padStart(2, "0")}`, close, volume: 1000 }));
    const fromStore = summariseSeries(INDIA_SECTORS[0], points.map((p, i) => ({ ...p, date: new Date(Date.UTC(2026, 5, 1 + i)).toISOString().slice(0, 10) })), "INR")!;
    const fromChart = summariseChart(INDIA_SECTORS[0], chart(closes))!;
    expect(fromStore.day).toBeCloseTo(fromChart.day!, 10);
    expect(fromStore.quarter).toBeCloseTo(fromChart.quarter!, 10);
    expect(fromStore.last).toBe(169);
    expect(fromStore.currency).toBe("INR");
  });

  it("refuses fewer than two closes", () => {
    expect(summariseSeries(INDIA_SECTORS[0], [{ date: "2026-09-17", close: 100, volume: null }], "INR")).toBeNull();
  });
});

describe("returns in US dollars", () => {
  const day = (i: number) => new Date(Date.UTC(2026, 5, 1 + i)).toISOString().slice(0, 10);

  it("adds the currency's move to the index's own", () => {
    // The index rises 10% in yen while the yen weakens 10% (100 -> 110 per dollar):
    // a dollar holder is where they started.
    const index = [{ date: day(0), close: 1000, volume: null }, { date: day(1), close: 1100, volume: null }];
    const yenPerDollar = [{ date: day(0), close: 100, volume: null }, { date: day(1), close: 110, volume: null }];
    const usd = inDollars(index, yenPerDollar);
    expect(usd.map((p) => p.close)).toEqual([10, 10]);
  });

  it("uses the latest rate on or before each date, and drops dates before any rate", () => {
    const index = [0, 1, 2, 3].map((i) => ({ date: day(i), close: 100, volume: null }));
    const rates = [{ date: day(1), close: 2, volume: null }]; // no rate for day 0, none published on days 2-3
    expect(inDollars(index, rates).map((p) => [p.date, p.close])).toEqual([[day(1), 50], [day(2), 50], [day(3), 50]]);
  });

  it("maps a quote currency to the dollar rate that converts it", () => {
    expect(fxSymbol("USD")).toBeNull();
    expect(fxSymbol("JPY")).toBe("JPY=X");
    // Minor units: the ratio is what matters, so cents convert at the rand's rate.
    expect(fxSymbol("ZAc")).toBe("ZAR=X");
    expect(fxSymbol("GBp")).toBe("GBP=X");
    expect(fxSymbol("ILA")).toBe("ILS=X");
    expect(fxSymbol(null)).toBeNull();
  });
});
