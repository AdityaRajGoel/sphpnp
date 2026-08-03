/**
 * Adapters from our Supabase chart payloads to lightweight-charts series data.
 *
 * These live apart from the chart component because the interesting failures
 * here are data failures, not rendering ones, and data is cheap to test. The
 * unit mismatch below in particular is invisible on screen: the chart renders
 * perfectly, just with every bar placed tens of thousands of years in the
 * future, so the viewport looks empty and nothing throws.
 */
import type { CandlestickData, HistogramData, UTCTimestamp } from "lightweight-charts";

/**
 * A point exactly as `fetch-screener-data` and `fetch-stock-chart` emit it.
 * Note `t` is milliseconds - both functions do `t: timestamps[i] * 1000`.
 */
export interface ApiChartPoint {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface CandleColors {
  up: string;
  down: string;
}

/** Milliseconds to the seconds lightweight-charts means by `UTCTimestamp`. */
const toSeconds = (ms: number): UTCTimestamp => Math.floor(ms / 1000) as UTCTimestamp;

const isUsable = (p: ApiChartPoint): boolean =>
  Number.isFinite(p.t) && Number.isFinite(p.o) && Number.isFinite(p.h) &&
  Number.isFinite(p.l) && Number.isFinite(p.c);

/**
 * Sort ascending and collapse duplicate timestamps, keeping the last value
 * seen. The library requires strictly ascending unique times: duplicates are
 * replaced silently and out-of-order points are dropped or throw, so both
 * cases would otherwise turn into a chart that is quietly missing bars.
 */
function normalise(points: readonly ApiChartPoint[]): ApiChartPoint[] {
  const byTime = new Map<number, ApiChartPoint>();
  for (const p of points) {
    if (isUsable(p)) byTime.set(toSeconds(p.t), p);
  }
  return [...byTime.entries()].sort(([a], [b]) => a - b).map(([, p]) => p);
}

/** OHLC bars for a CandlestickSeries. */
export function toCandles(points: readonly ApiChartPoint[]): CandlestickData<UTCTimestamp>[] {
  return normalise(points).map((p) => ({
    time: toSeconds(p.t),
    open: p.o,
    high: p.h,
    low: p.l,
    close: p.c,
  }));
}

/**
 * Volume bars for a HistogramSeries, tinted by that bar's direction.
 *
 * The colour rides on the data point rather than a second series: per-point
 * `color` is how the library expects bars to be individually tinted, and
 * splitting up-volume and down-volume across two series would break the
 * shared time base the panes rely on.
 */
export function toVolume(
  points: readonly ApiChartPoint[],
  colors: CandleColors,
): HistogramData<UTCTimestamp>[] {
  return normalise(points).map((p) => ({
    time: toSeconds(p.t),
    value: p.v,
    color: p.c >= p.o ? colors.up : colors.down,
  }));
}

/** One minute, in ms. Used only to space synthesised timestamps. */
const MINUTE_MS = 60_000;

/**
 * Zip the parallel arrays LiveChart keeps (closes, volumes, timestamps) into
 * chart points.
 *
 * Only closes are available on that path, so OHLC collapse onto the close.
 * That is honest for an area/line rendering and never reaches a candlestick.
 *
 * Iteration stops at the shortest array: the feed can return fewer timestamps
 * than closes, and reading past the end yields undefined times that become NaN
 * and are dropped silently by the library rather than raising.
 */
export function zipSeries(
  closes: readonly number[],
  volumes: readonly number[],
  timestamps: readonly number[],
): ApiChartPoint[] {
  if (closes.length === 0) return [];

  // With no timestamps at all, space the points evenly. The values are only a
  // carrier for ordering here; what matters is that they ascend strictly.
  const haveTimes = timestamps.length > 0;
  const count = haveTimes ? Math.min(closes.length, timestamps.length) : closes.length;
  const base = Date.now() - count * MINUTE_MS;

  const out: ApiChartPoint[] = [];
  for (let i = 0; i < count; i++) {
    const c = closes[i];
    out.push({
      t: haveTimes ? timestamps[i] : base + i * MINUTE_MS,
      o: c,
      h: c,
      l: c,
      c,
      v: volumes[i] ?? 0,
    });
  }
  return out;
}

/**
 * Bars for KLineChart, which backs the advanced chart.
 *
 * Note the absence of a unit conversion: KLineChart timestamps are
 * milliseconds, which is already what the feed emits, so unlike the
 * lightweight-charts path above there is nothing to divide by 1000. Getting
 * this backwards is the failure the module header describes — the chart still
 * renders, just with every bar placed decades away — so it is worth stating
 * plainly rather than leaving the reader to infer it from the absence of code.
 *
 * Runs through the same `normalise` as the candlestick adapter: KLineChart also
 * expects strictly ascending unique timestamps.
 */
export interface KLineBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** KLineChart's own `KLineData` carries an index signature for user fields.
   *  Without a matching one here the bars are not assignable to it. */
  [key: string]: unknown;
}

export function toKLineData(points: readonly ApiChartPoint[]): KLineBar[] {
  return normalise(points).map((p) => ({
    timestamp: p.t,
    open: p.o,
    high: p.h,
    low: p.l,
    close: p.c,
    volume: Number.isFinite(p.v) ? p.v : 0,
  }));
}

// `sma` deliberately lives in technicals.ts alongside rsi/ema/rebase.
// Re-exported here so chart callers have one import for chart-shaped helpers.
export { sma } from "./technicals";
