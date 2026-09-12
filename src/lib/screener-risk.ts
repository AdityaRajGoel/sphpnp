import { supabase } from "@/integrations/supabase/client";

/**
 * The screener's risk view (stock_price_analytics_latest), computed daily from
 * each stock's own daily bars by sync-price-analytics.
 *
 * Every figure may be null and a null is never rendered as zero: a stock with
 * four months of bars has no 52-week position and no one-year return, and the
 * computation refuses rather than extrapolating. Sorting sends those rows to
 * the end in BOTH directions, so "sort by lowest volatility" cannot put the
 * stocks whose volatility is unknown at the top.
 */
export type RiskSummary = {
  symbol: string;
  as_of: string;
  volatility_1y: number | null;
  max_drawdown_1y: number | null;
  beta_1y: number | null;
  rsi_14: number | null;
  adx: number | null;
  return_3m: number | null;
  relative_strength_3m: number | null;
  week52_position: number | null;
  delivery_recent: number | null;
  delivery_change: number | null;
  volume_zscore: number | null;
  distance_from_200: number | null;
  ma_trend: "golden" | "death" | null;
};

export type RiskKey = Exclude<keyof RiskSummary, "symbol" | "as_of" | "ma_trend">;

export const RISK_COLUMNS: { key: RiskKey; label: string; title: string; kind: "pct" | "ratio" | "sigma" | "points" }[] = [
  { key: "volatility_1y", label: "Volatility", title: "Annualised volatility of daily returns over the past year", kind: "pct" },
  { key: "beta_1y", label: "Beta", title: "Sensitivity to the Nifty 50 over the past year", kind: "ratio" },
  { key: "max_drawdown_1y", label: "Max DD", title: "Deepest peak-to-trough fall over the past year", kind: "pct" },
  { key: "return_3m", label: "3M return", title: "Price change over the past three months", kind: "pct" },
  { key: "relative_strength_3m", label: "vs Nifty", title: "Percentage points ahead of or behind the Nifty 50 over three months", kind: "points" },
  { key: "distance_from_200", label: "vs 200DMA", title: "Distance from the 200-day moving average", kind: "pct" },
  { key: "rsi_14", label: "RSI", title: "Relative strength index (14), Wilder", kind: "ratio" },
  { key: "adx", label: "ADX", title: "Trend strength (14), regardless of direction", kind: "ratio" },
  { key: "week52_position", label: "52w pos", title: "Where the close sits in its 52-week range: 0 at the low, 100 at the high", kind: "ratio" },
  { key: "delivery_recent", label: "Delivery", title: "Share of traded quantity settled as delivery, 20-day average", kind: "pct" },
  { key: "delivery_change", label: "Δ Delivery", title: "Delivery share against its own 60-day baseline", kind: "points" },
  { key: "volume_zscore", label: "Volume", title: "Latest session's volume against the previous 20 sessions", kind: "sigma" },
];

export function formatRisk(value: number | null, kind: "pct" | "ratio" | "sigma" | "points"): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (kind === "pct") return `${value.toFixed(1)}%`;
  if (kind === "points") return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
  if (kind === "sigma") return `${value > 0 ? "+" : ""}${value.toFixed(1)}σ`;
  return value.toFixed(2);
}

/**
 * Which columns read as good or bad at a glance.
 *
 * Volatility, drawdown and beta deliberately carry NO colour. High volatility
 * is not bad the way a falling price is bad - it is the price of a return
 * profile someone may well want - and colouring it red would turn a
 * description into a recommendation.
 */
export const riskTone = (key: RiskKey, value: number | null): "up" | "down" | null => {
  if (value === null || !Number.isFinite(value)) return null;
  if (!["return_3m", "relative_strength_3m", "distance_from_200", "delivery_change"].includes(key)) return null;
  return value >= 0 ? "up" : "down";
};

/** Sort by one column; stocks without the figure go last in either direction. */
export function sortByRisk<T extends { symbol: string }>(
  rows: T[],
  summaries: Map<string, RiskSummary>,
  key: RiskKey,
  dir: "asc" | "desc",
): T[] {
  const value = (row: T) => summaries.get(row.symbol)?.[key] ?? null;
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null && vb === null) return 0;
    // Always last, whichever way the column is sorted: an unknown volatility
    // must never lead a "least volatile first" list.
    if (va === null) return 1;
    if (vb === null) return -1;
    return dir === "asc" ? va - vb : vb - va;
  });
}

export type RiskScreen = { id: string; name: string; desc: string; test: (s: RiskSummary) => boolean };

/** Ready-made risk screens. A stock missing a figure a screen needs does not pass it. */
export const RISK_SCREENS: RiskScreen[] = [
  { id: "steady", name: "Steady", desc: "Volatility under 25% and beta under 1", test: (s) => s.volatility_1y !== null && s.volatility_1y < 25 && s.beta_1y !== null && s.beta_1y < 1 },
  { id: "leaders", name: "Outperforming", desc: "Ahead of the Nifty over three months and above its 200-day average", test: (s) => (s.relative_strength_3m ?? -Infinity) > 0 && (s.distance_from_200 ?? -Infinity) > 0 },
  { id: "trending", name: "Trending", desc: "ADX above 25", test: (s) => (s.adx ?? 0) > 25 },
  { id: "delivery", name: "Delivery rising", desc: "Delivery share up on its own 60-day baseline", test: (s) => (s.delivery_change ?? -Infinity) > 0 },
];

export async function getRiskSummaries(): Promise<Map<string, RiskSummary>> {
  const { data, error } = await (supabase.from("stock_price_analytics_latest" as never) as ReturnType<typeof supabase.from>)
    .select("symbol,as_of,volatility_1y,max_drawdown_1y,beta_1y,rsi_14,adx,return_3m,relative_strength_3m,week52_position,delivery_recent,delivery_change,volume_zscore,distance_from_200,ma_trend")
    .limit(1000);
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as unknown as RiskSummary[]).map((row) => [row.symbol, row]));
}
