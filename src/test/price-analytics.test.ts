import { describe, it, expect } from "vitest";
import {
  averageTrueRange,
  betaAgainst,
  computePriceAnalytics,
  deliveryTrend,
  downsideVolatility,
  drawdown,
  logReturns,
  momentum,
  rangePosition,
  realizedVolatility,
  relativeStrengthIndex,
  valueAtRisk,
  volumeZScore,
  adjustForCorporateActions,
  findUnexplainedJump,
  parseAdjustmentRatio,
  TRADING_DAYS_PER_YEAR,
  type Bar,
} from "../../supabase/functions/_shared/price-analytics";

/*
 * These measures get printed next to a company's name, so the property under
 * test throughout is the refusal: too little data, a gap in the series, a
 * suspended session - each must produce null rather than a confident number
 * computed from nothing.
 *
 * Where a closed-form answer exists (a constant-growth series has a known
 * volatility of zero; a series that only rises has RSI 100; a stock that
 * doubles the index's move has beta 2) the test asserts the real value rather
 * than a snapshot, so a refactor that changes the formula fails here.
 */

const day = (index: number) => {
  const date = new Date(Date.UTC(2026, 0, 5) + index * 86400000);
  return date.toISOString().slice(0, 10);
};

const series = (closes: number[], extra: Partial<Bar> = {}): Bar[] =>
  closes.map((close, index) => ({ trade_date: day(index), close, ...extra }));

/** A geometric series: every daily log return is identical, so volatility is 0. */
const constantGrowth = (n: number, rate = 0.01, start = 100) =>
  series(Array.from({ length: n }, (_, i) => start * (1 + rate) ** i));

describe("logReturns", () => {
  it("skips a bar with a non-positive or missing close rather than producing Infinity", () => {
    // A suspended session stored as 0 would make log(0/prev) = -Infinity and
    // poison every measure downstream of it.
    const bars: Bar[] = [
      { trade_date: day(0), close: 100 },
      { trade_date: day(1), close: 0 },
      { trade_date: day(2), close: 110 },
    ];

    const returns = logReturns(bars);

    expect(returns.every(Number.isFinite)).toBe(true);
  });
});

describe("realizedVolatility", () => {
  it("is zero for a series that grows at a constant rate", () => {
    expect(realizedVolatility(constantGrowth(60))).toBeCloseTo(0, 10);
  });

  it("annualizes the sample deviation by the root of the trading year", () => {
    // Alternating +1%/-1% closes: 60 log returns of ±0.00995 with a mean of
    // exactly zero. The expected value carries the sample (n-1) correction
    // √(60/59) deliberately - the population form would understate a figure
    // that is always computed from a window of a longer series, and the two
    // differ by enough here (15.93 vs 15.80) for the test to tell them apart.
    const closes = Array.from({ length: 61 }, (_, i) => (i % 2 === 0 ? 100 : 101));
    const daily = Math.abs(Math.log(101 / 100));
    const bessel = Math.sqrt(60 / 59);

    const annual = realizedVolatility(series(closes));

    expect(annual).toBeCloseTo(daily * bessel * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100, 6);
  });

  it("refuses a window shorter than its stated minimum", () => {
    expect(realizedVolatility(constantGrowth(10))).toBeNull();
  });
});

describe("downsideVolatility", () => {
  it("is null when the window never fell, rather than zero", () => {
    // Zero downside volatility would read as "this never loses money", which
    // is a claim about the future; the honest answer is that there is nothing
    // to measure.
    expect(downsideVolatility(constantGrowth(60))).toBeNull();
  });

  it("is smaller than total volatility when the falls are the gentler moves", () => {
    // Rises of 4%, falls of 1%: the same series has plenty of volatility but
    // little of it is downside.
    const closes = [100];
    for (let i = 1; i < 61; i++) closes.push(i % 2 === 0 ? closes[i - 1] * 0.99 : closes[i - 1] * 1.04);
    const bars = series(closes);

    expect(downsideVolatility(bars)!).toBeLessThan(realizedVolatility(bars)!);
  });
});

describe("valueAtRisk", () => {
  it("reports the loss tail as positive percentages, with CVaR at least VaR", () => {
    const closes = [100];
    for (let i = 1; i < 121; i++) closes.push(closes[i - 1] * (i % 7 === 0 ? 0.94 : 1.01));

    const risk = valueAtRisk(series(closes))!;

    expect(risk.var).toBeGreaterThan(0);
    // The average of the worst tail cannot be shallower than its cutoff.
    expect(risk.cvar).toBeGreaterThanOrEqual(risk.var);
  });
});

describe("drawdown", () => {
  it("measures peak-to-trough, not first-to-last", () => {
    // Peaks at 150, bottoms at 75 (a 50% fall), recovers to 117.75. Measuring
    // first close against last would report a gain of 17.75% and miss the fall
    // entirely, which is the mistake this function exists to not make.
    const closes = [
      ...Array.from({ length: 20 }, (_, i) => 100 + i * 2.5),
      ...Array.from({ length: 20 }, (_, i) => 150 - i * 3.75),
      ...Array.from({ length: 20 }, (_, i) => 75 + i * 2.25),
    ];

    const result = drawdown(series(closes))!;

    expect(result.max).toBeCloseTo(50, 6);
    expect(result.current).toBeCloseTo(((150 - 117.75) / 150) * 100, 6);
  });

  it("reports no current drawdown at a fresh high", () => {
    expect(drawdown(constantGrowth(40))!.current).toBeCloseTo(0, 10);
  });
});

describe("betaAgainst", () => {
  it("is 2 for a stock that moves twice the benchmark, with correlation 1", () => {
    const indexCloses = [100];
    for (let i = 1; i < 140; i++) indexCloses.push(indexCloses[i - 1] * (1 + (i % 3 === 0 ? -0.004 : 0.006)));
    // Doubling the log return each day is what "twice the move" means for a
    // measure built on log returns.
    const stockCloses = [100];
    for (let i = 1; i < 140; i++) {
      const indexReturn = Math.log(indexCloses[i] / indexCloses[i - 1]);
      stockCloses.push(stockCloses[i - 1] * Math.exp(2 * indexReturn));
    }

    const result = betaAgainst(series(stockCloses), series(indexCloses))!;

    expect(result.beta).toBeCloseTo(2, 6);
    expect(result.correlation).toBeCloseTo(1, 6);
  });

  it("pairs on trade_date, so a session the stock missed cannot shift the series", () => {
    // The classic artefact: drop one stock session and a by-position match
    // pairs every later stock return with the previous day's index return,
    // which quietly destroys the relationship. Built so the stock's log return
    // is exactly twice the index's on every span - including the two-day span
    // across the missing session - so correct alignment still answers exactly
    // 2, and any slippage does not.
    const indexCloses = [100];
    for (let i = 1; i < 140; i++) indexCloses.push(indexCloses[i - 1] * (1 + (i % 3 === 0 ? -0.004 : 0.006)));
    const stockCloses = [100];
    for (let i = 1; i < 140; i++) {
      stockCloses.push(stockCloses[i - 1] * Math.exp(2 * Math.log(indexCloses[i] / indexCloses[i - 1])));
    }
    const withGap = series(stockCloses).filter((_, i) => i !== 70);

    const aligned = betaAgainst(withGap, series(indexCloses))!;

    expect(aligned.observations).toBe(withGap.length - 1);
    expect(aligned.beta).toBeCloseTo(2, 6);
    expect(aligned.correlation).toBeCloseTo(1, 6);
  });

  it("refuses when the two series barely overlap", () => {
    const stock = series([100, 101, 102, 103, 104, 105]);
    const benchmark = series([200, 202, 204, 206, 208, 210]);

    expect(betaAgainst(stock, benchmark)).toBeNull();
  });
});

describe("averageTrueRange", () => {
  it("counts an opening gap, not just the day's own range", () => {
    // Every bar has a 2-point high-low range, but each one opens 10 points
    // above the previous close, putting its high 11 points above it. True
    // range is that gap-inclusive 11, not the 2 the day's own range shows.
    const bars: Bar[] = Array.from({ length: 30 }, (_, i) => ({
      trade_date: day(i),
      close: 100 + i * 10,
      high: 101 + i * 10,
      low: 99 + i * 10,
    }));

    const atr = averageTrueRange(bars)!;
    const last = bars[bars.length - 1].close;

    expect((atr / 100) * last).toBeCloseTo(11, 6);
  });

  it("is null when the bars carry no high/low", () => {
    expect(averageTrueRange(series([100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115]))).toBeNull();
  });
});

describe("relativeStrengthIndex", () => {
  it("is 100 for a series that only rises and 0 for one that only falls", () => {
    expect(relativeStrengthIndex(series(Array.from({ length: 40 }, (_, i) => 100 + i)))).toBe(100);
    expect(relativeStrengthIndex(series(Array.from({ length: 40 }, (_, i) => 100 - i)))).toBeCloseTo(0, 10);
  });

  it("sits near the midpoint for an evenly alternating series", () => {
    const rsi = relativeStrengthIndex(series(Array.from({ length: 60 }, (_, i) => (i % 2 === 0 ? 100 : 102))))!;

    expect(rsi).toBeGreaterThan(40);
    expect(rsi).toBeLessThan(60);
  });
});

describe("momentum and rangePosition", () => {
  it("reports the simple percentage change over the requested sessions", () => {
    const bars = series(Array.from({ length: 30 }, (_, i) => 100 + i));

    // 21 sessions back from 129 is 108.
    expect(momentum(bars, 21)).toBeCloseTo(((129 - 108) / 108) * 100, 10);
  });

  it("is null when the series is shorter than the window asked for", () => {
    expect(momentum(series([100, 101, 102]), 21)).toBeNull();
  });

  it("puts a close at the top of its range at 100 and at the bottom at 0", () => {
    const rising = rangePosition(series(Array.from({ length: 200 }, (_, i) => 100 + i)))!;
    const falling = rangePosition(series(Array.from({ length: 200 }, (_, i) => 300 - i)))!;

    expect(rising.position).toBeCloseTo(100, 10);
    expect(falling.position).toBeCloseTo(0, 10);
    expect(rising.high).toBe(299);
  });

  it("refuses a 52-week reading from three months of bars", () => {
    expect(rangePosition(series(Array.from({ length: 60 }, (_, i) => 100 + i)))).toBeNull();
  });
});

describe("volumeZScore", () => {
  it("scores the latest session against the window before it, not including it", () => {
    // 20 sessions at 1,000,000 then one at 5,000,000. Including the spike in
    // its own baseline would drag the mean up and shrink the score.
    const bars = Array.from({ length: 21 }, (_, i) => ({
      trade_date: day(i),
      close: 100,
      volume: i === 20 ? 5_000_000 : 1_000_000 + (i % 2) * 100_000,
    }));

    expect(volumeZScore(bars)!).toBeGreaterThan(5);
  });

  it("is null when the prior window never varied, rather than Infinity", () => {
    const bars = Array.from({ length: 25 }, (_, i) => ({ trade_date: day(i), close: 100, volume: 1_000_000 }));

    expect(volumeZScore(bars)).toBeNull();
  });
});

describe("deliveryTrend", () => {
  it("compares the recent delivery share against its own longer baseline", () => {
    const bars = Array.from({ length: 60 }, (_, i) => ({
      trade_date: day(i),
      close: 100,
      deliv_pct: i < 40 ? 40 : 60,
    }));

    const trend = deliveryTrend(bars)!;

    expect(trend.recent).toBeCloseTo(60, 6);
    expect(trend.baseline).toBeCloseTo(freqMean(bars), 6);
    expect(trend.change).toBeGreaterThan(0);
  });

  const freqMean = (bars: Bar[]) => bars.reduce((sum, bar) => sum + (bar.deliv_pct ?? 0), 0) / bars.length;

  it("is null when the exchange published no delivery figures", () => {
    expect(deliveryTrend(series(Array.from({ length: 90 }, () => 100)))).toBeNull();
  });
});

describe("computePriceAnalytics", () => {
  it("fills what the window supports and nulls the rest", () => {
    // A quarter of bars: volatility and RSI are computable, a 52-week range
    // and a one-year return are not, and must not be faked from what exists.
    const bars = Array.from({ length: 70 }, (_, i) => ({
      trade_date: day(i),
      close: 100 + Math.sin(i / 3) * 5 + i * 0.2,
      high: 101 + Math.sin(i / 3) * 5 + i * 0.2,
      low: 99 + Math.sin(i / 3) * 5 + i * 0.2,
      volume: 1_000_000 + i * 1000,
    }));

    const analytics = computePriceAnalytics(bars)!;

    expect(analytics.observations).toBe(70);
    expect(analytics.as_of).toBe(day(69));
    expect(analytics.volatility_1y).not.toBeNull();
    expect(analytics.rsi_14).not.toBeNull();
    expect(analytics.return_1m).not.toBeNull();
    expect(analytics.week52_position).toBeNull();
    expect(analytics.return_1y).toBeNull();
    // No benchmark passed: beta is absent, not 1.
    expect(analytics.beta_1y).toBeNull();
  });

  it("returns null for a symbol with no bars at all", () => {
    expect(computePriceAnalytics([])).toBeNull();
  });
});


/*
 * Corporate actions. The case that forced this: ADANIPOWER split its ₹10 face
 * value into ₹2 on 2025-09-22, inside the window eq_eod covers. The stored
 * bars run 709.40 -> 170.25 across that date and the feed's own `prev_close`
 * on the ex-date is 709.40, unrestated - so an unadjusted series carries a
 * -76% session nobody lived through.
 */
describe("parseAdjustmentRatio", () => {
  it("reads a face-value split as old face value over new", () => {
    expect(
      parseAdjustmentRatio({ ex_date: "2025-09-22", action_type: "split", description: "Face Value Split (Sub-Division) - From Rs 10/- Per Share To Rs 2/- Per Share" }),
    ).toBeCloseTo(5, 10);
    expect(parseAdjustmentRatio({ ex_date: "2010-03-29", description: "Fv Split Rs.10 To Rs.5" })).toBeCloseTo(2, 10);
  });

  it("reads NSE bonus notation as new-shares-per-held, not a replacement ratio", () => {
    // "Bonus 1:3" is one new share for every three held: the count rises by a
    // third (ratio 4/3). Reading it as "three become one" would adjust the
    // history the wrong way by a factor of four.
    expect(parseAdjustmentRatio({ ex_date: "2023-09-12", description: "Bonus 1:3" })).toBeCloseTo(4 / 3, 10);
    expect(parseAdjustmentRatio({ ex_date: "2025-05-23", description: "Bonus 2:1" })).toBeCloseTo(3, 10);
  });

  it("returns null for an action that does not move the share count", () => {
    expect(parseAdjustmentRatio({ ex_date: "2026-01-01", description: "Annual General Meeting" })).toBeNull();
    expect(parseAdjustmentRatio({ ex_date: "2026-01-01", description: "Dividend - Rs 5 Per Share" })).toBeNull();
    expect(parseAdjustmentRatio({ ex_date: "2026-01-01", description: "" })).toBeNull();
  });
});

describe("adjustForCorporateActions", () => {
  // The real ADANIPOWER bars, verbatim from eq_eod.
  const adaniBars: Bar[] = [
    { trade_date: "2025-09-18", close: 631.35, high: 635.3, low: 626, volume: 1000 },
    { trade_date: "2025-09-19", close: 709.4, high: 723, low: 665.35, volume: 2000 },
    { trade_date: "2025-09-22", close: 170.25, high: 170.25, low: 147.3, volume: 15000 },
    { trade_date: "2025-09-23", close: 162.35, high: 182.7, low: 160.25, volume: 12000 },
  ];
  const split = { ex_date: "2025-09-22", action_type: "split", description: "Face Value Split (Sub-Division) - From Rs 10/- Per Share To Rs 2/- Per Share" };

  it("divides the prices before the ex-date and multiplies the volumes", () => {
    const { bars, applied } = adjustForCorporateActions(adaniBars, [split]);

    expect(applied).toBe(1);
    expect(bars[1].close).toBeCloseTo(709.4 / 5, 10);
    expect(bars[1].high).toBeCloseTo(723 / 5, 10);
    // Five times as many shares at a fifth of the price.
    expect(bars[1].volume).toBe(2000 * 5);
    // The ex-date bar and everything after it are already in new-share terms.
    expect(bars[2].close).toBe(170.25);
  });

  it("turns the phantom -76% session into a real one", () => {
    expect(findUnexplainedJump(adaniBars)).toBe("2025-09-22");

    const { bars } = adjustForCorporateActions(adaniBars, [split]);

    expect(findUnexplainedJump(bars)).toBeNull();
    // 141.88 -> 170.25 is a large but real day, and it survives as one.
    expect((bars[2].close / bars[1].close - 1) * 100).toBeCloseTo(20, 0);
  });

  it("ignores an action outside the window it was given", () => {
    const { applied } = adjustForCorporateActions(adaniBars, [{ ...split, ex_date: "2024-01-01" }]);

    // Already reflected in every bar we hold; applying it again would halve a
    // history that was never unadjusted.
    expect(applied).toBe(0);
  });

  it("counts an unreadable price-moving action rather than passing it over", () => {
    const { applied, unparsed } = adjustForCorporateActions(adaniBars, [
      { ex_date: "2025-09-22", action_type: "bonus", description: "Bonus issue, ratio to be announced" },
      { ex_date: "2025-09-19", action_type: "dividend", description: "Dividend - Rs 3 Per Share" },
    ]);

    expect(applied).toBe(0);
    // The bonus is counted, the dividend is not - one is a gap in what we can
    // adjust for, the other needs no adjustment in a price-return series.
    expect(unparsed).toBe(1);
  });
});

describe("computePriceAnalytics with corporate actions", () => {
  const withSplit = (n: number): Bar[] => {
    // A quiet series that halves overnight at the midpoint: a 1-into-2 split.
    const bars: Bar[] = [];
    for (let i = 0; i < n; i++) {
      const raw = 200 + i * 0.4;
      bars.push({ trade_date: day(i), close: i < n / 2 ? raw : raw / 2, high: null, low: null, volume: 1_000_000 });
    }
    return bars;
  };

  it("refuses the whole row when an unadjusted split is still in the series", () => {
    // Not a partly-filled row: every price measure reads the whole window, so
    // one phantom session contaminates all of them at once and the page has no
    // way to know which numbers to distrust.
    expect(computePriceAnalytics(withSplit(80))).toBeNull();
  });

  it("computes normally once the split is supplied", () => {
    const bars = withSplit(80);
    const action = { ex_date: day(40), action_type: "split", description: "Face Value Split From Rs 10/- To Rs 5/-" };

    const analytics = computePriceAnalytics(bars, [], [action])!;

    expect(analytics).not.toBeNull();
    expect(analytics.actions_applied).toBe(1);
    // A steadily drifting series, so the volatility is small and the drawdown
    // is nil - which is only true because the split was taken out.
    expect(analytics.volatility_1y!).toBeLessThan(5);
    expect(analytics.max_drawdown_1y!).toBeLessThan(1);
  });

  it("refuses when an action inside the window could not be read", () => {
    const bars = withSplit(80);
    const vague = { ex_date: day(40), action_type: "bonus", description: "Bonus issue" };

    expect(computePriceAnalytics(bars, [], [vague])).toBeNull();
  });
});
