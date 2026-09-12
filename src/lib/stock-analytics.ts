import { supabase } from "@/integrations/supabase/client";

/**
 * The computed per-stock measures: risk and technicals from
 * stock_price_analytics, fundamental scores from stock_fundamental_scores, and
 * the research forecast band from stock_forecasts.
 *
 * All three are read from their `_latest` views, which pick the newest row per
 * symbol. Every field is nullable because the computation that produced it
 * refuses rather than guesses - a stock with four months of bars has no
 * 52-week position, and the page must render that as absent, not as zero.
 */

export type PriceAnalytics = {
  as_of: string;
  observations: number;
  actions_applied: number;
  benchmark: string | null;
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
  sma_20: number | null;
  sma_50: number | null;
  sma_200: number | null;
  distance_from_200: number | null;
  ma_trend: "golden" | "death" | null;
  macd: number | null;
  macd_signal: number | null;
  macd_histogram: number | null;
  bollinger_upper: number | null;
  bollinger_lower: number | null;
  bollinger_percent_b: number | null;
  bollinger_bandwidth: number | null;
  stochastic_k: number | null;
  stochastic_d: number | null;
  adx: number | null;
  plus_di: number | null;
  minus_di: number | null;
  obv_trend_20: number | null;
  money_flow_index: number | null;
  vwap: number | null;
  close_vs_vwap: number | null;
  relative_strength_3m: number | null;
};

export type PiotroskiCriterion = { name: string; passed: boolean | null; unavailable?: string };

export type FundamentalScores = {
  period_end: string;
  basis: string;
  piotroski_score: number | null;
  piotroski_testable: number | null;
  piotroski_criteria: PiotroskiCriterion[] | null;
  net_debt: number | null;
  net_debt_to_equity: number | null;
  accruals_ratio: number | null;
  cash_conversion: number | null;
  capex_intensity: number | null;
  free_cash_flow: number | null;
  fcf_yield: number | null;
  ev_to_sales: number | null;
  peg: number | null;
  payout_ratio: number | null;
  revenue_cagr_3y: number | null;
  profit_cagr_3y: number | null;
};

export type ForecastPathPoint = { session: number; date: string; low: number; mid: number; high: number };

export type Forecast = {
  as_of: string;
  model: string;
  horizon_days: number;
  samples: number;
  last_close: number;
  band_low: number;
  band_mid: number;
  band_high: number;
  band_low_pct: number;
  band_mid_pct: number;
  band_high_pct: number;
  path: ForecastPathPoint[];
  /** Carried in the row rather than written into the component, so it cannot be lost in a refactor. */
  disclaimer: string;
};

export type StockAnalytics = {
  price: PriceAnalytics | null;
  fundamentals: FundamentalScores | null;
  forecast: Forecast | null;
};

const EMPTY: StockAnalytics = { price: null, fundamentals: null, forecast: null };

/**
 * All three in parallel. A failure on any one yields null for that section
 * rather than failing the page: these are supplementary panels, and a stock
 * page that renders without its risk block is far better than one that does not
 * render at all.
 */
export async function loadStockAnalytics(symbol: string): Promise<StockAnalytics> {
  const [price, fundamentals, forecast] = await Promise.all([
    supabase.from("stock_price_analytics_latest").select("*").eq("symbol", symbol).maybeSingle(),
    supabase.from("stock_fundamental_scores_latest").select("*").eq("symbol", symbol).maybeSingle(),
    supabase.from("stock_forecasts_latest").select("*").eq("symbol", symbol).maybeSingle(),
  ]);

  return {
    price: (price.data as PriceAnalytics | null) ?? null,
    fundamentals: (fundamentals.data as FundamentalScores | null) ?? null,
    forecast: (forecast.data as Forecast | null) ?? null,
  };
}

export const emptyStockAnalytics = EMPTY;

/** Percentage with an explicit sign, or a dash when the measure was withheld. */
export const formatSignedPct = (value: number | null, digits = 1): string =>
  value === null || !Number.isFinite(value) ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;

export const formatPct = (value: number | null, digits = 1): string =>
  value === null || !Number.isFinite(value) ? "—" : `${value.toFixed(digits)}%`;

export const formatNumber = (value: number | null, digits = 2): string =>
  value === null || !Number.isFinite(value) ? "—" : value.toFixed(digits);

/**
 * How an RSI reading is conventionally described. Deliberately not a
 * recommendation - "oversold" says where the indicator sits, not what anyone
 * should do about it.
 */
export const rsiZone = (rsi: number | null): "oversold" | "neutral" | "overbought" | null =>
  rsi === null ? null : rsi >= 70 ? "overbought" : rsi <= 30 ? "oversold" : "neutral";
