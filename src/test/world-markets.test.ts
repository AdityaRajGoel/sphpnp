import { describe, it, expect } from "vitest";
import { BOARD, INDIA_ETFS, WORLD_INDICES, summariseChart } from "../../supabase/functions/_shared/world-markets";

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
  it("cover 40 world markets with unique symbols", () => {
    expect(WORLD_INDICES.length).toBeGreaterThanOrEqual(40);
    expect(new Set(BOARD.map((b) => b.symbol)).size).toBe(BOARD.length);
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
