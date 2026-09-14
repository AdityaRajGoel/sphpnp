import type { MetricRow } from "@/lib/screener-metrics";

/**
 * Market breadth across the tracked universe, from the same joined rows the
 * screener reads. Every share is "of the stocks where the figure is known",
 * and carries that denominator: 120 of 240 above the 200DMA is a different
 * statement from 120 of 130.
 */
export type Share = { count: number; known: number; pct: number | null };

export type Breadth = {
  advancers: Share;
  decliners: Share;
  above200: Share;
  golden: Share;
  rsiOversold: Share;
  rsiOverbought: Share;
  trendingUp: Share;
  trendingDown: Share;
  deliveryRising: Share;
  medianRsi: number | null;
  medianReturn3m: number | null;
  leaders: MetricRow[];
  laggards: MetricRow[];
};

const share = (rows: MetricRow[], known: (r: MetricRow) => boolean, hit: (r: MetricRow) => boolean): Share => {
  const pool = rows.filter(known);
  const count = pool.filter(hit).length;
  return { count, known: pool.length, pct: pool.length > 0 ? (count / pool.length) * 100 : null };
};

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const has = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

export function computeBreadth(all: Iterable<MetricRow>, topN = 8): Breadth {
  const rows = [...all];
  const priced = (r: MetricRow) => !!r.quote && r.quote.price > 0;
  const rs = rows.filter((r) => has(r.risk?.relative_strength_3m)).sort((a, b) => b.risk!.relative_strength_3m! - a.risk!.relative_strength_3m!);
  const adx = (r: MetricRow) => has(r.risk?.adx) && has(r.risk?.plus_di) && has(r.risk?.minus_di);

  return {
    advancers: share(rows, priced, (r) => r.quote!.change_pct > 0),
    decliners: share(rows, priced, (r) => r.quote!.change_pct < 0),
    above200: share(rows, (r) => has(r.risk?.distance_from_200), (r) => r.risk!.distance_from_200! > 0),
    golden: share(rows, (r) => !!r.risk?.ma_trend, (r) => r.risk!.ma_trend === "golden"),
    rsiOversold: share(rows, (r) => has(r.risk?.rsi_14), (r) => r.risk!.rsi_14! <= 30),
    rsiOverbought: share(rows, (r) => has(r.risk?.rsi_14), (r) => r.risk!.rsi_14! >= 70),
    trendingUp: share(rows, adx, (r) => r.risk!.adx! > 25 && r.risk!.plus_di! > r.risk!.minus_di!),
    trendingDown: share(rows, adx, (r) => r.risk!.adx! > 25 && r.risk!.minus_di! > r.risk!.plus_di!),
    deliveryRising: share(rows, (r) => has(r.risk?.delivery_change), (r) => r.risk!.delivery_change! > 0),
    medianRsi: median(rows.map((r) => r.risk?.rsi_14).filter(has)),
    medianReturn3m: median(rows.map((r) => r.risk?.return_3m).filter(has)),
    leaders: rs.slice(0, topN),
    laggards: rs.slice(-topN).reverse(),
  };
}
