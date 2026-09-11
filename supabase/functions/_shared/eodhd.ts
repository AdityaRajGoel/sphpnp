// EODHD (eodhd.com) end-of-day data for the global markets an Indian trader
// watches before the open. The free plan allows 20 calls a day, one call per
// ticker returning up to a year of daily bars, end-of-day only; it has no NSE
// stocks ("Ticker Not Found") and no bond yields, so it is used for exactly
// what NSE cannot give: world indices, currencies, metals, oil and bitcoin.
//
// 15 tickers a day, leaving a margin under the limit (sync-global-markets
// also counts every call in provider_usage and stops at DAILY_BUDGET).
//
// Pure: no fetch.

export const DAILY_BUDGET = 18;

export type GlobalTicker = { ticker: string; name: string; group: "US" | "Europe" | "Asia" | "Currency" | "Commodity" | "Crypto"; unit: "points" | "rupees" | "dollars" };

export const GLOBAL_TICKERS: GlobalTicker[] = [
  { ticker: "GSPC.INDX", name: "S&P 500", group: "US", unit: "points" },
  { ticker: "IXIC.INDX", name: "Nasdaq Composite", group: "US", unit: "points" },
  { ticker: "DJI.INDX", name: "Dow Jones", group: "US", unit: "points" },
  { ticker: "VIX.INDX", name: "CBOE VIX", group: "US", unit: "points" },
  { ticker: "FTSE.INDX", name: "FTSE 100", group: "Europe", unit: "points" },
  { ticker: "GDAXI.INDX", name: "DAX", group: "Europe", unit: "points" },
  { ticker: "N225.INDX", name: "Nikkei 225", group: "Asia", unit: "points" },
  { ticker: "HSI.INDX", name: "Hang Seng", group: "Asia", unit: "points" },
  { ticker: "SSEC.INDX", name: "Shanghai Composite", group: "Asia", unit: "points" },
  { ticker: "USDINR.FOREX", name: "USD / INR", group: "Currency", unit: "rupees" },
  { ticker: "DXY.INDX", name: "US Dollar Index", group: "Currency", unit: "points" },
  { ticker: "XAUUSD.FOREX", name: "Gold (per oz)", group: "Commodity", unit: "dollars" },
  { ticker: "XAGUSD.FOREX", name: "Silver (per oz)", group: "Commodity", unit: "dollars" },
  { ticker: "BNO.US", name: "Brent crude (BNO ETF)", group: "Commodity", unit: "dollars" },
  { ticker: "BTC-USD.CC", name: "Bitcoin", group: "Crypto", unit: "dollars" },
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
