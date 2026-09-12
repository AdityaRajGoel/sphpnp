/**
 * The trend, momentum and participation indicators that price-analytics.ts
 * does not cover - moving averages and their crosses, MACD, Bollinger bands,
 * Stochastic, ADX/DMI, OBV, Money Flow Index, true daily VWAP, and relative
 * strength against a benchmark.
 *
 * Same contract as the rest of this directory: every function returns null
 * rather than a number it cannot stand behind, and the minimum window for each
 * is stated where it is enforced. No I/O, no Deno APIs, so Vitest imports this
 * module directly.
 *
 * One of these is better here than in any general-purpose library. VWAP is
 * normally approximated from a typical price ((H+L+C)/3) because daily feeds
 * carry no turnover. The NSE bhavcopy DOES carry turnover, and eq_eod stores
 * it, so the day's true volume-weighted average price is available exactly
 * rather than estimated - see dailyVwap.
 */

import type { Bar } from "./price-analytics.ts";

const finite = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

const closes = (bars: Bar[]) => bars.map((bar) => bar.close).filter(finite);

/** Simple moving average of the last `period` closes. */
export function sma(bars: Bar[], period: number): number | null {
  const values = closes(bars);
  if (values.length < period || period <= 0) return null;
  return mean(values.slice(-period));
}

/**
 * Exponential moving average, seeded with the SMA of the first `period` closes
 * - the standard seeding, and the reason an EMA needs more history than its
 * period to settle.
 */
export function ema(bars: Bar[], period: number): number | null {
  const values = closes(bars);
  if (values.length < period || period <= 0) return null;
  const multiplier = 2 / (period + 1);
  let value = mean(values.slice(0, period));
  for (let i = period; i < values.length; i++) value = (values[i] - value) * multiplier + value;
  return value;
}

/** The EMA series, for indicators that need to run another average over it. */
function emaSeries(values: number[], period: number): number[] {
  if (values.length < period || period <= 0) return [];
  const multiplier = 2 / (period + 1);
  let value = mean(values.slice(0, period));
  const out = [value];
  for (let i = period; i < values.length; i++) {
    value = (values[i] - value) * multiplier + value;
    out.push(value);
  }
  return out;
}

export type MovingAverages = {
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  /** Last close as a percentage above (+) or below (-) the 200-day average. */
  distanceFrom200: number | null;
  /**
   * "golden" when the 50-day sits above the 200-day, "death" when below, null
   * when either is unavailable. The state, not the crossing event: a crossing
   * needs yesterday's reading too, and a state is what a page actually shows.
   */
  trend: "golden" | "death" | null;
};

export function movingAverages(bars: Bar[]): MovingAverages {
  const sma50 = sma(bars, 50);
  const sma200 = sma(bars, 200);
  const last = closes(bars).at(-1) ?? null;
  return {
    sma20: sma(bars, 20),
    sma50,
    sma200,
    distanceFrom200: sma200 !== null && sma200 > 0 && last !== null ? ((last - sma200) / sma200) * 100 : null,
    trend: sma50 === null || sma200 === null ? null : sma50 >= sma200 ? "golden" : "death",
  };
}

export type Macd = { macd: number; signal: number; histogram: number };

/**
 * MACD(12, 26, 9). The histogram - the gap between the line and its signal -
 * is the part that carries information about momentum turning.
 */
export function macd(bars: Bar[], fast = 12, slow = 26, signalPeriod = 9): Macd | null {
  const values = closes(bars);
  // The signal is an EMA of the MACD line, so the series has to be long enough
  // for the slow EMA to exist AND for nine of those to accumulate after it.
  if (values.length < slow + signalPeriod) return null;

  const fastSeries = emaSeries(values, fast);
  const slowSeries = emaSeries(values, slow);
  if (fastSeries.length === 0 || slowSeries.length === 0) return null;

  // Align on the right: the slow EMA starts later, so its first value
  // corresponds to a later bar than the fast EMA's first.
  const aligned = fastSeries.slice(fastSeries.length - slowSeries.length);
  const line = aligned.map((value, i) => value - slowSeries[i]);
  const signalSeries = emaSeries(line, signalPeriod);
  if (signalSeries.length === 0) return null;

  const macdValue = line[line.length - 1];
  const signal = signalSeries[signalSeries.length - 1];
  return { macd: macdValue, signal, histogram: macdValue - signal };
}

export type Bollinger = {
  upper: number;
  middle: number;
  lower: number;
  /** Where the close sits across the band: 0 at the lower, 1 at the upper. */
  percentB: number;
  /** Band width as a percentage of the middle - low values are the "squeeze". */
  bandwidth: number;
};

export function bollingerBands(bars: Bar[], period = 20, deviations = 2): Bollinger | null {
  const values = closes(bars);
  if (values.length < period) return null;
  const window = values.slice(-period);
  const middle = mean(window);
  const variance = window.reduce((sum, value) => sum + (value - middle) ** 2, 0) / (period - 1);
  const deviation = Math.sqrt(variance);
  if (!(deviation > 0) || !(middle > 0)) return null;

  const upper = middle + deviations * deviation;
  const lower = middle - deviations * deviation;
  const last = values[values.length - 1];
  return {
    upper,
    middle,
    lower,
    percentB: (last - lower) / (upper - lower),
    bandwidth: ((upper - lower) / middle) * 100,
  };
}

export type Stochastic = { k: number; d: number };

/**
 * Stochastic oscillator, %K smoothed into %D. Where RSI measures the size of
 * gains against losses, this measures where the close sits inside the recent
 * range - the two disagree exactly when a stock drifts up on shrinking moves.
 */
export function stochastic(bars: Bar[], period = 14, smoothing = 3): Stochastic | null {
  if (bars.length < period + smoothing) return null;
  const raw: number[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    const window = bars.slice(i - period + 1, i + 1);
    const highs = window.map((bar) => bar.high).filter(finite);
    const lows = window.map((bar) => bar.low).filter(finite);
    const close = bars[i].close;
    if (highs.length < period || lows.length < period || !finite(close)) return null;
    const high = Math.max(...highs);
    const low = Math.min(...lows);
    // A window with no range has no position within it to report.
    if (high <= low) continue;
    raw.push(((close - low) / (high - low)) * 100);
  }
  if (raw.length < smoothing) return null;
  const k = raw[raw.length - 1];
  return { k, d: mean(raw.slice(-smoothing)) };
}

export type DirectionalMovement = {
  /** Trend strength regardless of direction. Above 25 is conventionally "trending". */
  adx: number;
  /** Upward directional pressure. */
  plusDi: number;
  /** Downward directional pressure. */
  minusDi: number;
};

/**
 * Wilder's ADX and the +DI/-DI pair it is built from.
 *
 * ADX says how strongly a stock is trending without saying which way; the DI
 * pair says which way. Reported together because either alone is routinely
 * misread - a high ADX on a falling stock is a strong DOWNtrend, not strength.
 */
export function adx(bars: Bar[], period = 14): DirectionalMovement | null {
  if (bars.length < period * 2 + 1) return null;

  const trueRanges: number[] = [];
  const plusMoves: number[] = [];
  const minusMoves: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const { high, low } = bars[i];
    const previous = bars[i - 1];
    if (!finite(high) || !finite(low) || !finite(previous.high) || !finite(previous.low) || !finite(previous.close)) {
      return null;
    }
    trueRanges.push(Math.max(high - low, Math.abs(high - previous.close), Math.abs(low - previous.close)));
    const up = high - previous.high;
    const down = previous.low - low;
    // Only the larger of the two counts, and only when it is positive: a day
    // that extended both ways is directionally ambiguous, not doubly strong.
    plusMoves.push(up > down && up > 0 ? up : 0);
    minusMoves.push(down > up && down > 0 ? down : 0);
  }
  if (trueRanges.length < period * 2) return null;

  // Wilder smoothing: seed with the sum of the first `period`, then decay.
  const wilder = (values: number[]) => {
    let smoothed = values.slice(0, period).reduce((sum, value) => sum + value, 0);
    const out = [smoothed];
    for (let i = period; i < values.length; i++) {
      smoothed = smoothed - smoothed / period + values[i];
      out.push(smoothed);
    }
    return out;
  };

  const trSeries = wilder(trueRanges);
  const plusSeries = wilder(plusMoves);
  const minusSeries = wilder(minusMoves);

  const dxSeries: number[] = [];
  for (let i = 0; i < trSeries.length; i++) {
    if (!(trSeries[i] > 0)) continue;
    const plusDi = (plusSeries[i] / trSeries[i]) * 100;
    const minusDi = (minusSeries[i] / trSeries[i]) * 100;
    const sum = plusDi + minusDi;
    if (!(sum > 0)) continue;
    dxSeries.push((Math.abs(plusDi - minusDi) / sum) * 100);
  }
  if (dxSeries.length < period) return null;

  let adxValue = mean(dxSeries.slice(0, period));
  for (let i = period; i < dxSeries.length; i++) adxValue = (adxValue * (period - 1) + dxSeries[i]) / period;

  const lastTr = trSeries[trSeries.length - 1];
  if (!(lastTr > 0)) return null;
  return {
    adx: adxValue,
    plusDi: (plusSeries[plusSeries.length - 1] / lastTr) * 100,
    minusDi: (minusSeries[minusSeries.length - 1] / lastTr) * 100,
  };
}

/**
 * On-Balance Volume, reported as its own percentage change over `window`
 * sessions rather than as a raw running total - the absolute figure is an
 * arbitrary accumulation whose only meaning is its direction.
 */
export function obvTrend(bars: Bar[], window = 20): number | null {
  if (bars.length < window + 2) return null;
  let obv = 0;
  const series: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const volume = bars[i].volume;
    if (!finite(volume) || !finite(bars[i].close) || !finite(bars[i - 1].close)) return null;
    if (bars[i].close > bars[i - 1].close) obv += volume;
    else if (bars[i].close < bars[i - 1].close) obv -= volume;
    series.push(obv);
  }
  if (series.length < window + 1) return null;
  const then = series[series.length - 1 - window];
  const now = series[series.length - 1];
  // A near-zero base makes a percentage meaningless, not infinite.
  if (Math.abs(then) < 1) return null;
  return ((now - then) / Math.abs(then)) * 100;
}

/**
 * Money Flow Index - RSI weighted by the money that changed hands, so a move
 * on heavy volume counts for more than the same move on none.
 */
export function moneyFlowIndex(bars: Bar[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  const typical: number[] = [];
  const flows: number[] = [];
  for (const bar of bars) {
    if (!finite(bar.high) || !finite(bar.low) || !finite(bar.close) || !finite(bar.volume)) return null;
    const price = (bar.high + bar.low + bar.close) / 3;
    typical.push(price);
    flows.push(price * bar.volume);
  }

  let positive = 0;
  let negative = 0;
  for (let i = typical.length - period; i < typical.length; i++) {
    if (i <= 0) continue;
    if (typical[i] > typical[i - 1]) positive += flows[i];
    else if (typical[i] < typical[i - 1]) negative += flows[i];
  }
  if (negative === 0) return positive === 0 ? null : 100;
  return 100 - 100 / (1 + positive / negative);
}

/**
 * The day's true volume-weighted average price, from the bhavcopy's own
 * turnover figure.
 *
 * Everywhere else this is approximated as (high + low + close) / 3 because a
 * daily bar carries no turnover. NSE publishes it, eq_eod stores it as
 * turnover_lacs, and turnover / volume is the exact figure the approximation
 * is reaching for. Returned with the close's distance from it, which is the
 * usable part: a close above the day's VWAP means the buyers who moved size
 * were paying up.
 */
export function dailyVwap(bar: Pick<Bar, "close"> & { turnover_lacs?: number | null; volume?: number | null }): { vwap: number; closeVsVwap: number } | null {
  const turnover = bar.turnover_lacs;
  const volume = bar.volume;
  if (!finite(turnover) || !finite(volume) || volume <= 0 || turnover <= 0 || !finite(bar.close)) return null;
  // turnover_lacs is in lakhs of rupees; a lakh is 100,000.
  const vwap = (turnover * 100_000) / volume;
  if (!(vwap > 0)) return null;
  return { vwap, closeVsVwap: ((bar.close - vwap) / vwap) * 100 };
}

/**
 * Relative strength against a benchmark over `sessions`: how many percentage
 * points the stock beat (or lagged) the index by.
 *
 * Date-aligned like beta, for the same reason - a suspended session otherwise
 * compares two different spans and the answer is an artefact.
 */
export function relativeStrength(bars: Bar[], benchmark: Bar[], sessions = 63): number | null {
  const benchmarkByDate = new Map(benchmark.map((bar) => [bar.trade_date, bar.close]));
  const paired = bars.filter((bar) => finite(bar.close) && finite(benchmarkByDate.get(bar.trade_date)));
  if (paired.length < sessions + 1) return null;

  const stockThen = paired[paired.length - 1 - sessions].close;
  const stockNow = paired[paired.length - 1].close;
  const indexThen = benchmarkByDate.get(paired[paired.length - 1 - sessions].trade_date)!;
  const indexNow = benchmarkByDate.get(paired[paired.length - 1].trade_date)!;
  if (!(stockThen > 0) || !(indexThen > 0)) return null;

  const stockReturn = ((stockNow - stockThen) / stockThen) * 100;
  const indexReturn = ((indexNow - indexThen) / indexThen) * 100;
  return stockReturn - indexReturn;
}
