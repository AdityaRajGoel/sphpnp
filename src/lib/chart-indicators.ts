/**
 * Indicators KLineChart does not ship, written as pure functions over bars so
 * they can be tested without a canvas, then wrapped as chart templates.
 *
 * Built-ins (MA, EMA, BOLL, SAR, MACD, RSI, KDJ, CCI, DMI, OBV, WR, ROC, ...)
 * stay the library's own. What is here is what a trader expects from a terminal
 * and the library lacks: Supertrend, ATR, Donchian and Keltner channels,
 * Ichimoku, and a rolling VWAP.
 *
 * Every series is null until its window is full - a 10-bar ATR drawn from
 * three bars is a different number with the same name.
 */

export type Bar = { open: number; high: number; low: number; close: number; volume?: number };

type Series = (number | null)[];

/** Wilder's true range, then his smoothing: the first value is a plain mean of `period` ranges. */
export function atr(bars: readonly Bar[], period = 14): Series {
  const out: Series = bars.map(() => null);
  if (bars.length <= period) return out;
  const tr = bars.map((b, i) => (i === 0 ? b.high - b.low : Math.max(b.high - b.low, Math.abs(b.high - bars[i - 1].close), Math.abs(b.low - bars[i - 1].close))));
  let value = tr.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
  out[period] = value;
  for (let i = period + 1; i < bars.length; i++) {
    value = (value * (period - 1) + tr[i]) / period;
    out[i] = value;
  }
  return out;
}

/**
 * Supertrend (ATR period, multiplier). The line is the lower band while the
 * trend is up and the upper band while it is down; `up` says which.
 */
export function supertrend(bars: readonly Bar[], period = 10, multiplier = 3): { value: number | null; up: boolean | null }[] {
  const range = atr(bars, period);
  const out = bars.map(() => ({ value: null as number | null, up: null as boolean | null }));
  let upperPrev = NaN;
  let lowerPrev = NaN;
  let upTrend = true;
  for (let i = 0; i < bars.length; i++) {
    const a = range[i];
    if (a === null) continue;
    const mid = (bars[i].high + bars[i].low) / 2;
    let upper = mid + multiplier * a;
    let lower = mid - multiplier * a;
    const prevClose = i > 0 ? bars[i - 1].close : bars[i].close;
    // Bands only tighten while price stays inside them.
    if (!Number.isNaN(upperPrev) && (upper > upperPrev && prevClose <= upperPrev)) upper = upperPrev;
    if (!Number.isNaN(lowerPrev) && (lower < lowerPrev && prevClose >= lowerPrev)) lower = lowerPrev;
    if (Number.isNaN(upperPrev)) upTrend = bars[i].close >= mid;
    else if (upTrend && bars[i].close < lowerPrev) upTrend = false;
    else if (!upTrend && bars[i].close > upperPrev) upTrend = true;
    out[i] = { value: upTrend ? lower : upper, up: upTrend };
    upperPrev = upper;
    lowerPrev = lower;
  }
  return out;
}

const windowExtreme = (bars: readonly Bar[], end: number, period: number) => {
  let hi = -Infinity;
  let lo = Infinity;
  for (let j = end - period + 1; j <= end; j++) { hi = Math.max(hi, bars[j].high); lo = Math.min(lo, bars[j].low); }
  return { hi, lo };
};

export function donchian(bars: readonly Bar[], period = 20): { upper: number | null; middle: number | null; lower: number | null }[] {
  return bars.map((_, i) => {
    if (i < period - 1) return { upper: null, middle: null, lower: null };
    const { hi, lo } = windowExtreme(bars, i, period);
    return { upper: hi, middle: (hi + lo) / 2, lower: lo };
  });
}

export function emaSeries(values: readonly number[], period: number): Series {
  const out: Series = values.map(() => null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let value = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = value;
  for (let i = period; i < values.length; i++) { value = values[i] * k + value * (1 - k); out[i] = value; }
  return out;
}

/** Keltner: EMA of close, ± multiplier × ATR. */
export function keltner(bars: readonly Bar[], period = 20, multiplier = 2, atrPeriod = 10): { upper: number | null; middle: number | null; lower: number | null }[] {
  const mid = emaSeries(bars.map((b) => b.close), period);
  const range = atr(bars, atrPeriod);
  return bars.map((_, i) => {
    const m = mid[i];
    const a = range[i];
    return m === null || a === null ? { upper: null, middle: null, lower: null } : { upper: m + multiplier * a, middle: m, lower: m - multiplier * a };
  });
}

/**
 * Ichimoku (9, 26, 52). Spans are shown at the bar they were computed on
 * rather than shifted 26 forward: the chart has no future bars to draw them
 * into, and a silently truncated cloud is worse than an unshifted one.
 */
export function ichimoku(bars: readonly Bar[], conversion = 9, base = 26, spanB = 52): { tenkan: number | null; kijun: number | null; spanA: number | null; spanB: number | null }[] {
  const mid = (i: number, p: number) => { if (i < p - 1) return null; const { hi, lo } = windowExtreme(bars, i, p); return (hi + lo) / 2; };
  return bars.map((_, i) => {
    const tenkan = mid(i, conversion);
    const kijun = mid(i, base);
    return { tenkan, kijun, spanA: tenkan !== null && kijun !== null ? (tenkan + kijun) / 2 : null, spanB: mid(i, spanB) };
  });
}

/** Rolling VWAP over `period` bars, from typical price. Null where the window traded nothing. */
export function rollingVwap(bars: readonly Bar[], period = 20): Series {
  return bars.map((_, i) => {
    if (i < period - 1) return null;
    let pv = 0;
    let vol = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const v = bars[j].volume ?? 0;
      pv += ((bars[j].high + bars[j].low + bars[j].close) / 3) * v;
      vol += v;
    }
    return vol > 0 ? pv / vol : null;
  });
}

// ---------------------------------------------------------------------------
// KLineChart templates
// ---------------------------------------------------------------------------

type Num = number | undefined;
type Template = {
  name: string;
  shortName: string;
  series: "price" | "normal";
  calcParams: number[];
  precision?: number;
  figures: { key: string; title: string; type: string }[];
  calc: (bars: Bar[], indicator: { calcParams: number[] }) => Record<string, Num>[];
};

const n = (v: number | null): Num => (v === null ? undefined : v);

export const CUSTOM_INDICATORS: Template[] = [
  {
    name: "SUPERTREND", shortName: "ST", series: "price", calcParams: [10, 3],
    figures: [{ key: "up", title: "ST up: ", type: "line" }, { key: "down", title: "ST down: ", type: "line" }],
    calc: (bars, { calcParams: [p, m] }) => supertrend(bars, p, m).map((s) => ({ up: s.up ? n(s.value) : undefined, down: s.up === false ? n(s.value) : undefined })),
  },
  {
    name: "DONCHIAN", shortName: "DC", series: "price", calcParams: [20],
    figures: [{ key: "upper", title: "Upper: ", type: "line" }, { key: "middle", title: "Mid: ", type: "line" }, { key: "lower", title: "Lower: ", type: "line" }],
    calc: (bars, { calcParams: [p] }) => donchian(bars, p).map((d) => ({ upper: n(d.upper), middle: n(d.middle), lower: n(d.lower) })),
  },
  {
    name: "KELTNER", shortName: "KC", series: "price", calcParams: [20, 2, 10],
    figures: [{ key: "upper", title: "Upper: ", type: "line" }, { key: "middle", title: "EMA: ", type: "line" }, { key: "lower", title: "Lower: ", type: "line" }],
    calc: (bars, { calcParams: [p, m, a] }) => keltner(bars, p, m, a).map((d) => ({ upper: n(d.upper), middle: n(d.middle), lower: n(d.lower) })),
  },
  {
    name: "ICHIMOKU", shortName: "ICHI", series: "price", calcParams: [9, 26, 52],
    figures: [{ key: "tenkan", title: "Tenkan: ", type: "line" }, { key: "kijun", title: "Kijun: ", type: "line" }, { key: "spanA", title: "Span A: ", type: "line" }, { key: "spanB", title: "Span B: ", type: "line" }],
    calc: (bars, { calcParams: [c, b, s] }) => ichimoku(bars, c, b, s).map((d) => ({ tenkan: n(d.tenkan), kijun: n(d.kijun), spanA: n(d.spanA), spanB: n(d.spanB) })),
  },
  {
    name: "RVWAP", shortName: "VWAP", series: "price", calcParams: [20],
    figures: [{ key: "vwap", title: "VWAP: ", type: "line" }],
    calc: (bars, { calcParams: [p] }) => rollingVwap(bars, p).map((v) => ({ vwap: n(v) })),
  },
  {
    name: "ATR", shortName: "ATR", series: "normal", calcParams: [14],
    figures: [{ key: "atr", title: "ATR: ", type: "line" }],
    calc: (bars, { calcParams: [p] }) => atr(bars, p).map((v) => ({ atr: n(v) })),
  },
];

let registered = false;

/** Idempotent: the module-level registry outlives any one chart. */
export function registerCustomIndicators(kline: { registerIndicator: (template: never) => void; getSupportedIndicators: () => string[] }): void {
  if (registered) return;
  const existing = new Set(kline.getSupportedIndicators());
  for (const template of CUSTOM_INDICATORS) {
    if (!existing.has(template.name)) kline.registerIndicator(template as never);
  }
  registered = true;
}
