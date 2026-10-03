/**
 * The screener universe as one static file (speed plan step 2). A host job
 * (scripts/write-screener-universe.mts, every 10 minutes in market hours) reads
 * the four tables below once and writes /data/screener-universe.json; nginx
 * serves it cached. Browsers load that one file instead of four database reads
 * per visit, and fall back to the reads when the file is missing or stale.
 *
 * No imports on purpose: the Node job imports this module directly.
 */

export const UNIVERSE_SOURCES = {
  quotes: { table: "screener_stocks", select: "*" },
  fundamentals: {
    table: "stock_fundamentals_summary",
    select: "symbol,source,roe,roce,opm,sales_growth_yoy,profit_growth_yoy,debt_to_equity,pb,dividend_yield,eps_ttm,latest_quarter",
  },
  risk: {
    table: "stock_price_analytics_latest",
    select:
      "symbol,as_of,volatility_1y,max_drawdown_1y,beta_1y,rsi_14,adx,return_3m,relative_strength_3m,week52_position,delivery_recent,delivery_change,volume_zscore,distance_from_200,ma_trend," +
      "drawdown_from_peak,atr_pct_14,return_1m,return_6m,return_1y,sma_50,sma_200,macd_histogram,bollinger_percent_b,bollinger_bandwidth,stochastic_k,stochastic_d,plus_di,minus_di,obv_trend_20,money_flow_index,close_vs_vwap",
  },
  scores: {
    table: "stock_fundamental_scores_latest",
    select: "symbol,period_end,piotroski_score,piotroski_testable,net_debt_to_equity,accruals_ratio,cash_conversion,capex_intensity,fcf_yield,ev_to_sales,peg,payout_ratio,revenue_cagr_3y,profit_cagr_3y",
  },
} as const;

export type UniversePart = keyof typeof UNIVERSE_SOURCES;
export type UniverseFile = { generated_at: string } & Record<UniversePart, Record<string, unknown>[]>;

export const UNIVERSE_FILE_URL = "/data/screener-universe.json";
/** Older than this and the job has stopped; read the tables instead. */
export const UNIVERSE_FILE_MAX_AGE_MS = 2 * 60 * 60_000;

const PARTS = Object.keys(UNIVERSE_SOURCES) as UniversePart[];

/** A file with every part as an array of rows, written within the max age. */
export function isUsableUniverseFile(value: unknown, now = Date.now()): value is UniverseFile {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const at = typeof v.generated_at === "string" ? Date.parse(v.generated_at) : NaN;
  if (!Number.isFinite(at) || now - at > UNIVERSE_FILE_MAX_AGE_MS) return false;
  return PARTS.every((p) => Array.isArray(v[p])) && (v.quotes as unknown[]).length > 0;
}

const MEMO_MS = 60_000;
let memo: { at: number; file: Promise<UniverseFile | null> } | null = null;

/**
 * The static file, or null when it is unavailable, malformed or stale. Shared for a
 * minute, so the universe and the three summary loaders cost one request together.
 */
export function fetchUniverseFile(): Promise<UniverseFile | null> {
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.file;
  const file = fetch(UNIVERSE_FILE_URL)
    .then(async (res) => {
      if (!res.ok) return null;
      const body: unknown = await res.json();
      return isUsableUniverseFile(body) ? body : null;
    })
    .catch(() => null);
  memo = { at: Date.now(), file };
  return file;
}
