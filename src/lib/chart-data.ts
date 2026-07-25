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
