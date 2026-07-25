import { describe, it, expect } from "vitest";
import { toCandles, toVolume, type ApiChartPoint } from "@/lib/chart-data";

/** One trading day of ticks, in the shape the Supabase functions actually return. */
const point = (tMs: number, o: number, h: number, l: number, c: number, v = 1000): ApiChartPoint =>
  ({ t: tMs, o, h, l, c, v });

describe("toCandles", () => {
  it("converts millisecond timestamps to seconds", () => {
    // The edge functions emit `t: timestamps[i] * 1000`. lightweight-charts
    // expects UTCTimestamp in seconds; passing ms puts bars in the year 56000.
    const [candle] = toCandles([point(1_700_000_000_000, 1, 2, 0.5, 1.5)]);
    expect(candle.time).toBe(1_700_000_000);
  });

  it("maps OHLC fields onto the series shape", () => {
    const [candle] = toCandles([point(1_700_000_000_000, 1, 2, 0.5, 1.5)]);
    expect(candle).toEqual({ time: 1_700_000_000, open: 1, high: 2, low: 0.5, close: 1.5 });
  });

  it("sorts strictly ascending by time", () => {
    // Out-of-order points are dropped or throw inside the library.
    const candles = toCandles([
      point(1_700_003_600_000, 2, 2, 2, 2),
      point(1_700_000_000_000, 1, 1, 1, 1),
    ]);
    expect(candles.map((c) => c.time)).toEqual([1_700_000_000, 1_700_003_600]);
  });

  it("keeps only the last point when timestamps collide", () => {
    // Duplicates replace silently in setData, so resolve them deterministically.
    const candles = toCandles([
      point(1_700_000_000_000, 1, 1, 1, 1),
      point(1_700_000_000_000, 9, 9, 9, 9),
    ]);
    expect(candles).toHaveLength(1);
    expect(candles[0].close).toBe(9);
  });

  it("drops points with a non-finite close", () => {
    // Yahoo returns nulls on halted or illiquid scrips.
    const candles = toCandles([
      point(1_700_000_000_000, 1, 1, 1, Number.NaN),
      point(1_700_003_600_000, 2, 2, 2, 2),
    ]);
    expect(candles).toHaveLength(1);
    expect(candles[0].time).toBe(1_700_003_600);
  });

  it("returns an empty array for no input", () => {
    expect(toCandles([])).toEqual([]);
  });
});

describe("toVolume", () => {
  it("colours a bar by whether that candle closed up", () => {
    const [down, up] = toVolume(
      [point(1_700_000_000_000, 2, 2, 1, 1), point(1_700_003_600_000, 1, 2, 1, 2)],
      { up: "#0a0", down: "#a00" },
    );
    expect(down.color).toBe("#a00");
    expect(up.color).toBe("#0a0");
  });

  it("shares the candle time base so the panes stay aligned", () => {
    const [bar] = toVolume([point(1_700_000_000_000, 1, 2, 1, 2, 5000)], { up: "#0a0", down: "#a00" });
    expect(bar.time).toBe(1_700_000_000);
    expect(bar.value).toBe(5000);
  });
});
