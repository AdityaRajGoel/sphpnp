// EODHD (eodhd.com) end-of-day data for the global markets an Indian trader
// watches before the open. The free plan allows 20 calls a day, one call per
// ticker returning up to a year of daily bars, end-of-day only; it has no NSE
// stocks ("Ticker Not Found") and no bond yields, so it is used for exactly
// what NSE cannot give: world indices, currencies, metals, oil and bitcoin.
//
// Twelve of the fifteen tickers now come from Yahoo's keyless chart instead, so
// the key is spent only on gold and silver (EODHD stays the fallback for the
// rest). sync-global-markets still counts every EODHD call in provider_usage
// and stops at DAILY_BUDGET.
//
// Pure: no fetch.

export const DAILY_BUDGET = 18;

export type GlobalTicker = {
  ticker: string;
  name: string;
  group: "US" | "Europe" | "Asia" | "Currency" | "Commodity" | "Crypto" | "Rates";
  unit: "points" | "rupees" | "dollars" | "percent";
  /** Fetched from Yahoo's keyless chart instead of EODHD (stored under `ticker`). */
  yahoo?: string;
};

export const GLOBAL_TICKERS: GlobalTicker[] = [
  // Yahoo's keyless chart carries every one of these, so the EODHD key is spent
  // only where Yahoo has no equivalent. FTSE also returned 0 rows from EODHD
  // every day (checked 2026-09-17/18). Gold and silver stay on EODHD: Yahoo has
  // no spot series for them and its futures sit ~1.8% above spot, which would
  // put a false step in the stored history.
  { ticker: "GSPC.INDX", name: "S&P 500", group: "US", unit: "points", yahoo: "^GSPC" },
  { ticker: "IXIC.INDX", name: "Nasdaq Composite", group: "US", unit: "points", yahoo: "^IXIC" },
  { ticker: "DJI.INDX", name: "Dow Jones", group: "US", unit: "points", yahoo: "^DJI" },
  { ticker: "VIX.INDX", name: "CBOE VIX", group: "US", unit: "points", yahoo: "^VIX" },
  { ticker: "FTSE.INDX", name: "FTSE 100", group: "Europe", unit: "points", yahoo: "^FTSE" },
  { ticker: "GDAXI.INDX", name: "DAX", group: "Europe", unit: "points", yahoo: "^GDAXI" },
  { ticker: "N225.INDX", name: "Nikkei 225", group: "Asia", unit: "points", yahoo: "^N225" },
  { ticker: "HSI.INDX", name: "Hang Seng", group: "Asia", unit: "points", yahoo: "^HSI" },
  { ticker: "SSEC.INDX", name: "Shanghai Composite", group: "Asia", unit: "points", yahoo: "000001.SS" },
  { ticker: "USDINR.FOREX", name: "USD / INR", group: "Currency", unit: "rupees", yahoo: "INR=X" },
  { ticker: "DXY.INDX", name: "US Dollar Index", group: "Currency", unit: "points", yahoo: "DX-Y.NYB" },
  { ticker: "XAUUSD.FOREX", name: "Gold (per oz)", group: "Commodity", unit: "dollars" },
  { ticker: "XAGUSD.FOREX", name: "Silver (per oz)", group: "Commodity", unit: "dollars" },
  { ticker: "BNO.US", name: "Brent crude (BNO ETF)", group: "Commodity", unit: "dollars", yahoo: "BNO" },
  { ticker: "BTC-USD.CC", name: "Bitcoin", group: "Crypto", unit: "dollars", yahoo: "BTC-USD" },
  // The global rate cue an Indian desk watches before the open. Keyless, and
  // EODHD's free plan has no bond yields at all, so this exists only because the
  // board no longer depends on that plan.
  { ticker: "US10Y.YIELD", name: "US 10-year Treasury yield", group: "Rates", unit: "percent", yahoo: "^TNX" },
];

export type GlobalBar = { ticker: string; trade_date: string; open: number | null; high: number | null; low: number | null; close: number; volume: number | null };

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Daily bars from /api/eod/{ticker}?fmt=json; a bar without a close is dropped. */
export function parseEodhdEod(raw: unknown, ticker: string): GlobalBar[] {
  if (!Array.isArray(raw)) return [];
  const out = new Map<string, GlobalBar>();
  for (const r of raw) {
    if (typeof r !== "object" || r === null) continue;
    const row = r as Record<string, unknown>;
    const date = typeof row.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? row.date : null;
    const close = num(row.close);
    if (!date || close === null) continue;
    out.set(date, { ticker, trade_date: date, open: num(row.open), high: num(row.high), low: num(row.low), close, volume: num(row.volume) });
  }
  return [...out.values()].sort((a, b) => a.trade_date.localeCompare(b.trade_date));
}

/** The request for one ticker: a full year when history is short, the last fortnight otherwise - one call either way. */
export function eodUrl(ticker: string, token: string, from: string): string {
  return `https://eodhd.com/api/eod/${encodeURIComponent(ticker)}?api_token=${encodeURIComponent(token)}&fmt=json&from=${from}`;
}

/** Daily bars from Yahoo's v8 chart endpoint, in the same shape as EODHD's. */
export function parseYahooBars(raw: unknown, ticker: string): GlobalBar[] {
  const result = (raw as { chart?: { result?: unknown[] } })?.chart?.result?.[0] as
    | { timestamp?: number[]; indicators?: { quote?: Record<string, (number | null)[]>[] } }
    | undefined;
  const quote = result?.indicators?.quote?.[0] ?? {};
  const out = new Map<string, GlobalBar>();
  (result?.timestamp ?? []).forEach((t, i) => {
    const close = num(quote.close?.[i]);
    if (close === null) return;
    const trade_date = new Date(t * 1000).toISOString().slice(0, 10);
    out.set(trade_date, { ticker, trade_date, open: num(quote.open?.[i]), high: num(quote.high?.[i]), low: num(quote.low?.[i]), close, volume: num(quote.volume?.[i]) });
  });
  return [...out.values()].sort((a, b) => a.trade_date.localeCompare(b.trade_date));
}

/**
 * Keyless daily bars: ten years when the stored history is short, a month
 * otherwise. Yahoo charges nothing per call, so the deep history is fetched
 * once and kept - EODHD's plan is what used to cap this at a year.
 */
export function yahooChartUrl(symbol: string, long: boolean): string {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${long ? "10y" : "1mo"}&interval=1d`;
}
