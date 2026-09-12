import { describe, it, expect } from "vitest";
import {
  adx,
  bollingerBands,
  dailyVwap,
  ema,
  macd,
  moneyFlowIndex,
  movingAverages,
  obvTrend,
  relativeStrength,
  sma,
  stochastic,
} from "../../supabase/functions/_shared/technical-indicators";
import type { Bar } from "../../supabase/functions/_shared/price-analytics";

const day = (index: number) => new Date(Date.UTC(2026, 0, 5) + index * 86400000).toISOString().slice(0, 10);

const series = (values: number[], extra: (i: number) => Partial<Bar> = () => ({})): Bar[] =>
  values.map((close, i) => ({ trade_date: day(i), close, ...extra(i) }));

/** Bars with a fixed range around each close, for the indicators that need high/low. */
const ranged = (values: number[], spread = 2): Bar[] =>
  values.map((close, i) => ({
    trade_date: day(i),
    close,
    high: close + spread,
    low: close - spread,
    volume: 1_000_000,
  }));

describe("moving averages", () => {
  it("averages exactly the last N closes", () => {
    const bars = series(Array.from({ length: 30 }, (_, i) => i + 1));

    // The last 20 of 1..30 are 11..30, whose mean is 20.5.
    expect(sma(bars, 20)).toBeCloseTo(20.5, 10);
  });

  it("holds an EMA flat on a flat series", () => {
    expect(ema(series(Array.from({ length: 60 }, () => 100)), 20)).toBeCloseTo(100, 10);
  });

  it("matches the SMA exactly on a constant-slope series", () => {
    // Not a coincidence and worth pinning: for a straight-line input both
    // averages settle at the same lag of (period-1)/2 bars, so they are equal.
    // The EMA's advantage is in responding to a CHANGE of slope, not to slope.
    const bars = series(Array.from({ length: 60 }, (_, i) => 100 + i));

    expect(ema(bars, 20)!).toBeCloseTo(sma(bars, 20)!, 8);
  });

  it("pulls ahead of the SMA when the slope changes", () => {
    // Flat for forty sessions, then a sharp run: the EMA weights the run more
    // heavily. If this flips, the seeding or the multiplier is wrong.
    const bars = series([...Array.from({ length: 40 }, () => 100), ...Array.from({ length: 20 }, (_, i) => 100 + (i + 1) * 5)]);

    expect(ema(bars, 20)!).toBeGreaterThan(sma(bars, 20)!);
  });

  it("reads a rising series as a golden cross and a falling one as a death cross", () => {
    const rising = series(Array.from({ length: 220 }, (_, i) => 100 + i));
    const falling = series(Array.from({ length: 220 }, (_, i) => 400 - i));

    expect(movingAverages(rising).trend).toBe("golden");
    expect(movingAverages(falling).trend).toBe("death");
    expect(movingAverages(rising).distanceFrom200!).toBeGreaterThan(0);
  });

  it("reports no trend when there is not enough history for a 200-day average", () => {
    // 150 sessions cannot produce a 200-day average, and a "golden cross" from
    // a 50-day compared against nothing would be an invention.
    const short = movingAverages(series(Array.from({ length: 150 }, (_, i) => 100 + i)));

    expect(short.sma200).toBeNull();
    expect(short.trend).toBeNull();
    expect(short.distanceFrom200).toBeNull();
  });
});

describe("macd", () => {
  it("is zero on a flat series", () => {
    const flat = macd(series(Array.from({ length: 80 }, () => 100)))!;

    expect(flat.macd).toBeCloseTo(0, 8);
    expect(flat.histogram).toBeCloseTo(0, 8);
  });

  it("is positive on a rising series", () => {
    const result = macd(series(Array.from({ length: 120 }, (_, i) => 100 + i * 2)))!;

    expect(result.macd).toBeGreaterThan(0);
    expect(result.macd - result.signal).toBeCloseTo(result.histogram, 10);
  });

  it("leaves a zero histogram on a steady climb and a positive one on an accelerating climb", () => {
    // The distinction the histogram exists to draw, and the one most readings
    // of it get wrong. A constant-slope rise gives a CONSTANT MACD line, which
    // its own signal EMA matches exactly - histogram zero, however fast the
    // price is rising. Only accelerating momentum lifts it off zero.
    const steady = macd(series(Array.from({ length: 120 }, (_, i) => 100 + i * 2)))!;
    const accelerating = macd(series(Array.from({ length: 120 }, (_, i) => 100 + (i * i) / 50)))!;

    expect(steady.histogram).toBeCloseTo(0, 6);
    expect(accelerating.histogram).toBeGreaterThan(0);
  });

  it("refuses a series too short for the slow EMA plus its signal", () => {
    expect(macd(series(Array.from({ length: 30 }, (_, i) => 100 + i)))).toBeNull();
  });
});

describe("bollingerBands", () => {
  it("places the close at the top of the band when it has run up", () => {
    const bands = bollingerBands(series(Array.from({ length: 40 }, (_, i) => 100 + i)))!;

    expect(bands.percentB).toBeGreaterThan(0.9);
    expect(bands.upper).toBeGreaterThan(bands.middle);
    expect(bands.lower).toBeLessThan(bands.middle);
  });

  it("refuses a flat window rather than dividing by a zero band", () => {
    // Every close identical means no deviation, so %B would be 0/0.
    expect(bollingerBands(series(Array.from({ length: 40 }, () => 100)))).toBeNull();
  });
});

describe("stochastic", () => {
  it("reads near 100 at the top of the range and near 0 at the bottom", () => {
    expect(stochastic(ranged(Array.from({ length: 40 }, (_, i) => 100 + i)))!.k).toBeGreaterThan(85);
    expect(stochastic(ranged(Array.from({ length: 40 }, (_, i) => 200 - i)))!.k).toBeLessThan(15);
  });

  it("is null when the bars carry no high/low", () => {
    expect(stochastic(series(Array.from({ length: 40 }, (_, i) => 100 + i)))).toBeNull();
  });
});

describe("adx", () => {
  it("reports a strong uptrend with +DI above -DI", () => {
    const result = adx(ranged(Array.from({ length: 80 }, (_, i) => 100 + i * 2)))!;

    expect(result.adx).toBeGreaterThan(25);
    expect(result.plusDi).toBeGreaterThan(result.minusDi);
  });

  it("keeps a strong DOWNtrend's ADX high while -DI leads", () => {
    // The misreading this pair exists to prevent: a high ADX is strength of
    // trend, not strength of price.
    const result = adx(ranged(Array.from({ length: 80 }, (_, i) => 300 - i * 2)))!;

    expect(result.adx).toBeGreaterThan(25);
    expect(result.minusDi).toBeGreaterThan(result.plusDi);
  });

  it("refuses a series shorter than two smoothing periods", () => {
    expect(adx(ranged(Array.from({ length: 20 }, (_, i) => 100 + i)))).toBeNull();
  });
});

describe("obvTrend", () => {
  it("is positive when the up days carry the volume", () => {
    const bars = Array.from({ length: 40 }, (_, i) => ({
      trade_date: day(i),
      close: 100 + i,
      volume: 1_000_000,
    }));

    expect(obvTrend(bars)!).toBeGreaterThan(0);
  });

  it("is null when a bar has no volume", () => {
    const bars = Array.from({ length: 40 }, (_, i) => ({ trade_date: day(i), close: 100 + i, volume: null }));

    expect(obvTrend(bars)).toBeNull();
  });
});

describe("moneyFlowIndex", () => {
  it("is 100 when every session in the window rose", () => {
    expect(moneyFlowIndex(ranged(Array.from({ length: 40 }, (_, i) => 100 + i)))).toBe(100);
  });

  it("sits below 50 when the falls carried more money than the rises", () => {
    const bars = ranged(Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? 100 : 98))).map((bar, i) => ({
      ...bar,
      // Heavy volume on the down sessions only.
      volume: bar.close < 100 ? 5_000_000 : 500_000,
    }));

    expect(moneyFlowIndex(bars)!).toBeLessThan(50);
  });
});

describe("dailyVwap", () => {
  it("computes the exact VWAP from the bhavcopy's turnover, in lakhs", () => {
    // ₹1,234.56 lakh of turnover on 100,000 shares is ₹1,234.56 a share.
    const result = dailyVwap({ close: 1250, turnover_lacs: 1234.56, volume: 100_000 })!;

    expect(result.vwap).toBeCloseTo(1234.56, 6);
    // A close above VWAP: the size that traded was paying up.
    expect(result.closeVsVwap).toBeCloseTo(((1250 - 1234.56) / 1234.56) * 100, 8);
  });

  it("is null when the exchange published no turnover", () => {
    expect(dailyVwap({ close: 1250, turnover_lacs: null, volume: 100_000 })).toBeNull();
    expect(dailyVwap({ close: 1250, turnover_lacs: 500, volume: 0 })).toBeNull();
  });
});

describe("relativeStrength", () => {
  it("reports how many points the stock beat the index by", () => {
    // Stock +20%, index +10% over the window: 10 points of relative strength.
    const stock = series(Array.from({ length: 100 }, (_, i) => (i < 37 ? 100 : 100 * (1 + (0.2 * (i - 36)) / 63))));
    const index = series(Array.from({ length: 100 }, (_, i) => (i < 37 ? 200 : 200 * (1 + (0.1 * (i - 36)) / 63))));

    expect(relativeStrength(stock, index)!).toBeCloseTo(10, 6);
  });

  it("pairs on trade_date, ignoring a session the stock did not trade", () => {
    const index = series(Array.from({ length: 100 }, (_, i) => 200 + i));
    const stock = series(Array.from({ length: 100 }, (_, i) => 100 + i)).filter((_, i) => i !== 50);

    // Still answerable: 99 paired sessions is more than the 63 asked for.
    expect(relativeStrength(stock, index)).not.toBeNull();
  });

  it("refuses when the overlap is shorter than the window", () => {
    const stock = series(Array.from({ length: 30 }, (_, i) => 100 + i));
    const index = series(Array.from({ length: 30 }, (_, i) => 200 + i));

    expect(relativeStrength(stock, index)).toBeNull();
  });
});
