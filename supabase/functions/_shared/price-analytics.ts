/**
 * Risk, trend and participation measures derived from the daily bars this repo
 * already collects (`eq_eod`) and the index closes beside them
 * (`index_valuation_daily`).
 *
 * WHY THIS IS HAND-WRITTEN RATHER THAN A LIBRARY. The reference
 * implementations of all of this are Python - skfolio for the risk measures,
 * nautilus_trader for the indicators - and nothing in this project runs
 * Python: the collectors are Deno edge functions and the site is a Vite SPA.
 * These are textbook formulas with no library-specific cleverness in them, so
 * they are written here against the bars we hold rather than dragging a second
 * runtime into the deployment for a page of arithmetic. The definitions are
 * stated per function so a reader can check them against the standard ones
 * rather than trusting the name.
 *
 * THE RULE THROUGHOUT: not enough data returns null, never a number. A beta
 * computed from eleven overlapping days is not a small beta, it is not a beta,
 * and the one thing this file must never do is hand a confident-looking figure
 * to a page that will print it next to a company's name. Every window has a
 * stated minimum and every function refuses below it.
 *
 * Descriptive only. Nothing here forecasts a price or scores a stock as worth
 * buying - these summarise what the bars already did.
 */

/** NSE trades ~250 days a year; 252 is the convention these measures assume. */
export const TRADING_DAYS_PER_YEAR = 252;

export type Bar = {
  trade_date: string;
  close: number;
  high?: number | null;
  low?: number | null;
  volume?: number | null;
  deliv_pct?: number | null;
};

/** Minimum observations per measure. Below these the answer is null. */
export const MIN_OBSERVATIONS = {
  /** Two closes make one return; a volatility needs a month of them to mean anything. */
  volatility: 20,
  /** A beta on less than a quarter of overlap is noise wearing a Greek letter. */
  beta: 60,
  atr: 15,
  rsi: 15,
  drawdown: 20,
  /** 52-week measures need most of a year actually present, not just spanned. */
  fiftyTwoWeek: 120,
  volumeZScore: 21,
} as const;

const finite = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

/**
 * Sample standard deviation (n-1). The population form (n) understates the
 * spread of a sample, and every window here is a sample of a longer series.
 */
function stdev(values: number[]): number | null {
  if (values.length < 2) return null;
  const average = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Log returns, not simple ones, for every volatility and correlation measure:
 * they are additive across time, so scaling a daily figure to a yearly one by
 * √252 is arithmetic rather than an approximation. Simple returns are used
 * where the number is shown to a reader (momentum, drawdown), because "up 12%"
 * means the simple one.
 */
export function logReturns(bars: Bar[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const previous = bars[i - 1].close;
    const current = bars[i].close;
    if (!finite(previous) || !finite(current) || previous <= 0 || current <= 0) continue;
    out.push(Math.log(current / previous));
  }
  return out;
}

/** Annualized realized volatility, as a percentage. */
export function realizedVolatility(bars: Bar[]): number | null {
  const returns = logReturns(bars);
  if (returns.length < MIN_OBSERVATIONS.volatility) return null;
  const daily = stdev(returns);
  if (daily === null) return null;
  return daily * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100;
}

/**
 * Downside deviation: the same dispersion measure as volatility but counting
 * only the days that lost money. Two stocks with identical volatility are not
 * equally uncomfortable to hold if one of them got there by rising in jumps.
 */
export function downsideVolatility(bars: Bar[]): number | null {
  const returns = logReturns(bars);
  if (returns.length < MIN_OBSERVATIONS.volatility) return null;
  const losses = returns.filter((value) => value < 0);
  // A window with one down day has no dispersion of downside to measure.
  if (losses.length < 2) return null;
  // Deviation about zero, not about the mean of the losses: the reference
  // point is "did not lose", which is what makes this a downside measure
  // rather than the volatility of a subset.
  const variance = losses.reduce((sum, value) => sum + value ** 2, 0) / (losses.length - 1);
  return Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100;
}

/**
 * Historical Value at Risk and its conditional counterpart, both as positive
 * percentages ("on the worst 5% of days this fell at least X%").
 *
 * Historical rather than a normal-distribution VaR on purpose: Indian
 * mid- and small-caps hit circuit limits, and a normal curve fitted to a
 * series of ±5% days puts a reassuringly small number on a move the stock
 * makes several times a year.
 */
export function valueAtRisk(bars: Bar[], confidence = 0.95): { var: number; cvar: number } | null {
  const returns = logReturns(bars);
  if (returns.length < MIN_OBSERVATIONS.volatility) return null;
  const sorted = [...returns].sort((a, b) => a - b);
  const index = Math.max(0, Math.floor((1 - confidence) * sorted.length) - 1);
  const cutoff = sorted[index];
  const tail = sorted.slice(0, index + 1);
  return {
    var: -cutoff * 100,
    cvar: -mean(tail) * 100,
  };
}

/**
 * Deepest peak-to-trough fall in the window, and how far below the running
 * peak the last close sits. Both positive percentages.
 */
export function drawdown(bars: Bar[]): { max: number; current: number } | null {
  const closes = bars.map((bar) => bar.close).filter(finite);
  if (closes.length < MIN_OBSERVATIONS.drawdown) return null;
  let peak = closes[0];
  let worst = 0;
  for (const close of closes) {
    if (close > peak) peak = close;
    const fall = peak > 0 ? (peak - close) / peak : 0;
    if (fall > worst) worst = fall;
  }
  const last = closes[closes.length - 1];
  return { max: worst * 100, current: peak > 0 ? ((peak - last) / peak) * 100 : 0 };
}

/**
 * Beta and correlation against a benchmark, computed on the dates the two
 * series actually share.
 *
 * The alignment is the whole job. A stock suspended for three sessions, or an
 * index series with a gap, will otherwise pair Monday's stock return with
 * Wednesday's index return and produce a beta that is pure artefact - so the
 * two are joined on trade_date and the unmatched dates are dropped rather than
 * index-matched.
 */
export function betaAgainst(bars: Bar[], benchmark: Bar[]): { beta: number; correlation: number; observations: number } | null {
  const benchmarkByDate = new Map(benchmark.map((bar) => [bar.trade_date, bar.close]));
  const paired: Bar[][] = [[], []];
  for (const bar of bars) {
    const close = benchmarkByDate.get(bar.trade_date);
    if (!finite(close) || !finite(bar.close)) continue;
    paired[0].push(bar);
    paired[1].push({ trade_date: bar.trade_date, close });
  }

  const stockReturns = logReturns(paired[0]);
  const indexReturns = logReturns(paired[1]);
  const n = Math.min(stockReturns.length, indexReturns.length);
  if (n < MIN_OBSERVATIONS.beta) return null;

  const stock = stockReturns.slice(-n);
  const index = indexReturns.slice(-n);
  const stockMean = mean(stock);
  const indexMean = mean(index);
  let covariance = 0;
  let indexVariance = 0;
  let stockVariance = 0;
  for (let i = 0; i < n; i++) {
    covariance += (stock[i] - stockMean) * (index[i] - indexMean);
    indexVariance += (index[i] - indexMean) ** 2;
    stockVariance += (stock[i] - stockMean) ** 2;
  }
  if (indexVariance <= 0 || stockVariance <= 0) return null;
  return {
    beta: covariance / indexVariance,
    correlation: covariance / Math.sqrt(indexVariance * stockVariance),
    observations: n,
  };
}

/**
 * Average True Range over `period` sessions, Wilder's smoothing, as a
 * percentage of the last close so it can be compared across price levels.
 *
 * True range rather than high-low: a stock that gapped down at the open moved
 * further than its own day's range says, and the gap is exactly the part a
 * holder felt.
 */
export function averageTrueRange(bars: Bar[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  const ranges: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const { high, low, close } = bars[i];
    const previousClose = bars[i - 1].close;
    if (!finite(high) || !finite(low) || !finite(previousClose)) continue;
    ranges.push(Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose)));
  }
  if (ranges.length < period) return null;

  let atr = mean(ranges.slice(0, period));
  for (let i = period; i < ranges.length; i++) atr = (atr * (period - 1) + ranges[i]) / period;

  const last = bars[bars.length - 1].close;
  if (!finite(last) || last <= 0) return null;
  return (atr / last) * 100;
}

/** Wilder's RSI. 0-100; above 70 is conventionally "overbought", below 30 "oversold". */
export function relativeStrengthIndex(bars: Bar[], period = 14): number | null {
  const closes = bars.map((bar) => bar.close).filter(finite);
  if (closes.length < period + 1) return null;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }
  let averageGain = gains / period;
  let averageLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    averageGain = (averageGain * (period - 1) + Math.max(change, 0)) / period;
    averageLoss = (averageLoss * (period - 1) + Math.max(-change, 0)) / period;
  }

  // A window that never fell has no ratio to take; it is the defined maximum.
  if (averageLoss === 0) return averageGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + averageGain / averageLoss);
}

/**
 * Simple percentage change over a number of trading sessions - the form a
 * reader means by "up 12% over three months".
 */
export function momentum(bars: Bar[], sessions: number): number | null {
  const closes = bars.map((bar) => bar.close).filter(finite);
  if (closes.length < sessions + 1) return null;
  const then = closes[closes.length - 1 - sessions];
  const now = closes[closes.length - 1];
  if (then <= 0) return null;
  return ((now - then) / then) * 100;
}

/**
 * Where the last close sits in the window's range, 0 (at the low) to 100 (at
 * the high) - the figure "near its 52-week high" is actually about.
 */
export function rangePosition(bars: Bar[]): { high: number; low: number; position: number } | null {
  const closes = bars.map((bar) => bar.close).filter(finite);
  if (closes.length < MIN_OBSERVATIONS.fiftyTwoWeek) return null;
  const high = Math.max(...closes);
  const low = Math.min(...closes);
  if (high <= low) return null;
  const last = closes[closes.length - 1];
  return { high, low, position: ((last - low) / (high - low)) * 100 };
}

/**
 * How unusual the latest session's volume is, in standard deviations above the
 * preceding 20 sessions. The comparison window deliberately EXCLUDES the day
 * being scored - including it drags the mean toward the spike and flattens
 * exactly the signal being looked for.
 */
export function volumeZScore(bars: Bar[], window = 20): number | null {
  const volumes = bars.map((bar) => bar.volume).filter(finite);
  if (volumes.length < window + 1) return null;
  const latest = volumes[volumes.length - 1];
  const prior = volumes.slice(-window - 1, -1);
  const average = mean(prior);
  const deviation = stdev(prior);
  if (deviation === null || deviation <= 0) return null;
  return (latest - average) / deviation;
}

/**
 * Delivery percentage now versus its own recent past.
 *
 * This one has no counterpart in any of the foreign libraries, and it is the
 * most India-specific number here: the exchanges publish what share of traded
 * quantity actually settled as delivery, which separates a rise carried by
 * intraday churn from one where holders are taking stock off the market.
 */
export function deliveryTrend(bars: Bar[], recent = 20, baseline = 60): { recent: number; baseline: number; change: number } | null {
  const values = bars.map((bar) => bar.deliv_pct).filter(finite);
  if (values.length < baseline) return null;
  const recentMean = mean(values.slice(-recent));
  const baselineMean = mean(values.slice(-baseline));
  if (!finite(recentMean) || !finite(baselineMean)) return null;
  return { recent: recentMean, baseline: baselineMean, change: recentMean - baselineMean };
}

/* ---------------------------------------------------------------------------
 * Corporate-action adjustment.
 *
 * THIS IS NOT OPTIONAL DECORATION - without it these measures are wrong, and
 * confidently so. ADANIPOWER split its ₹10 face value into ₹2 on 2025-09-22,
 * inside the window `eq_eod` covers. The stored bars go 709.40 -> 170.25 across
 * that date, and `prev_close` on the ex-date is 709.40: the exchange's own
 * previous-close field in this feed is NOT restated, it is a copy of the prior
 * session's close. Computed raw, that session contributes a -76% "return" that
 * no holder experienced, which inflates a year of volatility, invents a
 * 76% drawdown and drags beta toward nonsense.
 *
 * So bars before an ex-date are back-adjusted: prices divided by the ratio,
 * volumes multiplied by it (five times as many shares at a fifth of the
 * price). Dividends are deliberately NOT adjusted for - a price-return series
 * is what every figure here is labelled as, and silently turning it into a
 * total-return series would make "return_1y" mean something other than what
 * the stock's price did.
 * ------------------------------------------------------------------------- */

export type CorporateAction = { ex_date: string; action_type?: string | null; description?: string | null };

/**
 * Post-action shares per pre-action share, or null when the description is not
 * one this understands.
 *
 * Returning null rather than guessing 1 is the point: an unparsed action must
 * leave a visible jump for the guard below to catch, not be quietly treated as
 * "no adjustment needed".
 */
export function parseAdjustmentRatio(action: CorporateAction): number | null {
  const text = (action.description ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;

  // "Bonus 1:3" - NSE writes bonus:held, so 1:3 is one new share for every
  // three held and the count rises by a third, NOT to a third.
  const bonus = /bonus\s*(\d+)\s*:\s*(\d+)/i.exec(text);
  if (bonus) {
    const issued = Number(bonus[1]);
    const held = Number(bonus[2]);
    if (issued > 0 && held > 0) return (issued + held) / held;
  }

  // "Face Value Split (Sub-Division) - From Rs 10/- Per Share To Rs 2/- Per
  // Share", and the terser "Fv Split Rs.10 To Rs.5". Both give the ratio as
  // old face value over new. "From" is optional because the second form omits
  // it, but a currency token before the first figure is not: without it the
  // "10" in "Sub-Division 10" style noise would be read as a face value.
  if (/split|sub-?division/i.test(text)) {
    const values = /(?:from\s*)?(?:rs\.?|re\.?|₹)\s*([\d.]+)[^\d]*?to\s*(?:rs\.?|re\.?|₹)?\s*([\d.]+)/i.exec(text);
    if (values) {
      const from = Number(values[1]);
      const to = Number(values[2]);
      if (from > 0 && to > 0 && from !== to) return from / to;
    }
  }

  return null;
}

/**
 * Back-adjusts `bars` (oldest-first) for every action that falls inside them.
 *
 * Returns the adjusted bars plus what could not be applied, so a caller can
 * tell "no actions" apart from "an action we could not read" - the second is a
 * reason to distrust the series, the first is not.
 */
export function adjustForCorporateActions(
  bars: Bar[],
  actions: CorporateAction[],
): { bars: Bar[]; applied: number; unparsed: number } {
  if (bars.length === 0) return { bars, applied: 0, unparsed: 0 };
  const first = bars[0].trade_date;
  const last = bars[bars.length - 1].trade_date;
  // Only actions inside the window matter: one before the first bar already
  // applies to every price we hold, and one after the last has not happened.
  const inWindow = actions.filter((action) => action.ex_date > first && action.ex_date <= last);

  let applied = 0;
  let unparsed = 0;
  let adjusted = bars;
  for (const action of inWindow) {
    const ratio = parseAdjustmentRatio(action);
    if (ratio === null || !Number.isFinite(ratio) || ratio <= 0) {
      // A dividend or an AGM needs no price adjustment and is not a failure;
      // anything else unparsed is.
      if (!/dividend|meeting|agm/i.test(`${action.action_type ?? ""} ${action.description ?? ""}`)) unparsed++;
      continue;
    }
    applied++;
    adjusted = adjusted.map((bar) =>
      bar.trade_date < action.ex_date
        ? {
            ...bar,
            close: bar.close / ratio,
            high: finite(bar.high) ? bar.high / ratio : bar.high,
            low: finite(bar.low) ? bar.low / ratio : bar.low,
            volume: finite(bar.volume) ? bar.volume * ratio : bar.volume,
          }
        : bar,
    );
  }
  return { bars: adjusted, applied, unparsed };
}

/**
 * A single-session move this large is, in practice, an unadjusted corporate
 * action rather than a real move: NSE's widest price band is 20%, and even a
 * band-free F&O name does not halve in a session without one.
 */
export const JUMP_THRESHOLD_PCT = 35;

/** The date of the first residual jump, or null when the series is clean. */
export function findUnexplainedJump(bars: Bar[], thresholdPct = JUMP_THRESHOLD_PCT): string | null {
  for (let i = 1; i < bars.length; i++) {
    const previous = bars[i - 1].close;
    const current = bars[i].close;
    if (!finite(previous) || !finite(current) || previous <= 0 || current <= 0) continue;
    if (Math.abs((current - previous) / previous) * 100 >= thresholdPct) return bars[i].trade_date;
  }
  return null;
}

export type PriceAnalytics = {
  as_of: string;
  observations: number;
  /** How many corporate actions were back-applied to this series. */
  actions_applied: number;
  volatility_1y: number | null;
  downside_volatility_1y: number | null;
  var_95: number | null;
  cvar_95: number | null;
  max_drawdown_1y: number | null;
  drawdown_from_peak: number | null;
  beta_1y: number | null;
  correlation_1y: number | null;
  atr_pct_14: number | null;
  rsi_14: number | null;
  return_1m: number | null;
  return_3m: number | null;
  return_6m: number | null;
  return_1y: number | null;
  week52_high: number | null;
  week52_low: number | null;
  week52_position: number | null;
  volume_zscore: number | null;
  delivery_recent: number | null;
  delivery_change: number | null;
};

/** Sessions per period, on the 252-day convention. */
const SESSIONS = { month: 21, quarter: 63, half: 126, year: 252 } as const;

/**
 * Every measure for one symbol from one ordered series of bars.
 *
 * `bars` must be oldest-first and already filtered to a single exchange and
 * series - the same symbol trades on both NSE and BSE with different closes,
 * and interleaving them produces a volatility that is mostly the spread
 * between two venues.
 *
 * Returns null - not a partly-filled object - when the series still contains a
 * move too large to be a real one after adjustment. Every price measure here
 * reads the whole window, so one phantom session contaminates all of them at
 * once, and a row of plausible-looking numbers built on it is worse than no
 * row: the page has no way to know it should not print them.
 */
export function computePriceAnalytics(
  rawBars: Bar[],
  benchmark: Bar[] = [],
  actions: CorporateAction[] = [],
): PriceAnalytics | null {
  if (rawBars.length === 0) return null;
  const { bars, applied, unparsed } = adjustForCorporateActions(rawBars, actions);
  if (unparsed > 0) return null;
  if (findUnexplainedJump(bars) !== null) return null;

  const dd = drawdown(bars);
  const beta = benchmark.length > 0 ? betaAgainst(bars, benchmark) : null;
  const range = rangePosition(bars);
  const risk = valueAtRisk(bars);
  const delivery = deliveryTrend(bars);

  return {
    as_of: bars[bars.length - 1].trade_date,
    observations: bars.length,
    actions_applied: applied,
    volatility_1y: realizedVolatility(bars),
    downside_volatility_1y: downsideVolatility(bars),
    var_95: risk?.var ?? null,
    cvar_95: risk?.cvar ?? null,
    max_drawdown_1y: dd?.max ?? null,
    drawdown_from_peak: dd?.current ?? null,
    beta_1y: beta?.beta ?? null,
    correlation_1y: beta?.correlation ?? null,
    atr_pct_14: averageTrueRange(bars),
    rsi_14: relativeStrengthIndex(bars),
    return_1m: momentum(bars, SESSIONS.month),
    return_3m: momentum(bars, SESSIONS.quarter),
    return_6m: momentum(bars, SESSIONS.half),
    return_1y: momentum(bars, SESSIONS.year),
    week52_high: range?.high ?? null,
    week52_low: range?.low ?? null,
    week52_position: range?.position ?? null,
    volume_zscore: volumeZScore(bars),
    delivery_recent: delivery?.recent ?? null,
    delivery_change: delivery?.change ?? null,
  };
}
