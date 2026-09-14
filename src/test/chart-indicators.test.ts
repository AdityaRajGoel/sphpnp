import { describe, it, expect } from "vitest";
import { atr, CUSTOM_INDICATORS, donchian, emaSeries, ichimoku, keltner, registerCustomIndicators, rollingVwap, supertrend, type Bar } from "@/lib/chart-indicators";

const flat = (n: number, close = 100, spread = 2): Bar[] => Array.from({ length: n }, () => ({ open: close, high: close + spread / 2, low: close - spread / 2, close, volume: 1000 }));
const rising = (n: number): Bar[] => Array.from({ length: n }, (_, i) => ({ open: 100 + i, high: 101 + i, low: 99 + i, close: 100.5 + i, volume: 1000 }));
const falling = (n: number): Bar[] => Array.from({ length: n }, (_, i) => ({ open: 200 - i, high: 201 - i, low: 199 - i, close: 199.5 - i, volume: 1000 }));

describe("atr", () => {
  it("is null until the window is full, then equals a constant range", () => {
    const out = atr(flat(20), 14);
    expect(out.slice(0, 14).every((v) => v === null)).toBe(true);
    expect(out[14]).toBeCloseTo(2, 10);
    expect(out[19]).toBeCloseTo(2, 10);
  });
});

describe("supertrend", () => {
  it("sits below price in a steady rise and above it in a steady fall", () => {
    const up = supertrend(rising(40)).slice(-1)[0]!;
    expect(up.up).toBe(true);
    expect(up.value!).toBeLessThan(rising(40).slice(-1)[0]!.close);
    const down = supertrend(falling(40)).slice(-1)[0]!;
    expect(down.up).toBe(false);
    expect(down.value!).toBeGreaterThan(falling(40).slice(-1)[0]!.close);
  });

  it("flips when price breaks through the band", () => {
    const series = [...rising(30), ...Array.from({ length: 10 }, (_, i) => ({ open: 120 - i * 5, high: 121 - i * 5, low: 110 - i * 5, close: 111 - i * 5, volume: 1000 }))];
    const out = supertrend(series);
    expect(out[29].up).toBe(true);
    expect(out.slice(-1)[0]!.up).toBe(false);
  });
});

describe("channels", () => {
  it("Donchian spans the window's extremes", () => {
    const d = donchian(rising(25), 20).slice(-1)[0]!;
    expect(d.upper).toBe(125);
    expect(d.lower).toBe(104);
    expect(d.middle).toBe(114.5);
  });

  it("Keltner is symmetric around its EMA", () => {
    const k = keltner(flat(40)).slice(-1)[0]!;
    expect(k.middle).toBeCloseTo(100, 10);
    expect(k.upper! - k.middle!).toBeCloseTo(k.middle! - k.lower!, 10);
  });

  it("EMA seeds with a simple mean", () => {
    expect(emaSeries([1, 2, 3, 4], 3)).toEqual([null, null, 2, 3]);
  });
});

describe("ichimoku", () => {
  it("withholds span B until 52 bars exist", () => {
    const out = ichimoku(rising(60));
    expect(out[50].spanB).toBeNull();
    expect(out[51].spanB).not.toBeNull();
    expect(out[59].spanA).toBeCloseTo((out[59].tenkan! + out[59].kijun!) / 2, 10);
  });
});

describe("rollingVwap", () => {
  it("weights typical price by volume, and refuses a window with none", () => {
    expect(rollingVwap(flat(5), 5)[4]).toBeCloseTo(100, 10);
    expect(rollingVwap(flat(5).map((b) => ({ ...b, volume: 0 })), 5)[4]).toBeNull();
  });
});

describe("chart templates", () => {
  it("produce one result per bar, keyed by their figures", () => {
    const bars = rising(60);
    for (const t of CUSTOM_INDICATORS) {
      const result = t.calc(bars, { calcParams: t.calcParams });
      expect(result).toHaveLength(bars.length);
      const keys = new Set(t.figures.map((f) => f.key));
      expect(Object.keys(result.slice(-1)[0]!).every((k) => keys.has(k))).toBe(true);
    }
  });

  it("register once, skipping names the library already has", () => {
    const registered: string[] = [];
    const kline = { registerIndicator: (t: never) => registered.push((t as { name: string }).name), getSupportedIndicators: () => ["ATR"] };
    registerCustomIndicators(kline);
    registerCustomIndicators(kline);
    expect(registered).not.toContain("ATR");
    expect(registered.filter((n) => n === "SUPERTREND")).toHaveLength(1);
  });
});
