// Twelve Data daily bars (GET /time_series). The free plan carries US stocks
// and ETFs, forex and crypto - not NSE or BSE - at 8 credits a minute and 800 a
// day, one credit per symbol. Used by sync-global-markets as the fallback
// between Yahoo and EODHD, so only exact equivalents of a stored series are
// mapped: a proxy would put a false step in the history.
//
// Pure: no fetch.

import type { GlobalBar } from "./eodhd.ts";

export function twelveDataUrl(symbol: string, key: string, outputsize: number): string {
  return `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=${outputsize}&apikey=${encodeURIComponent(key)}`;
}

/**
 * `values` arrive newest first with every price as a string. An error comes as
 * {code, message, status:"error"}, which parses to no bars.
 */
export function parseTwelveDataSeries(raw: unknown, ticker: string): GlobalBar[] {
  const body = raw as { status?: unknown; values?: unknown };
  if (body?.status !== "ok" || !Array.isArray(body.values)) return [];
  const n = (v: unknown) => {
    const x = typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
    return Number.isFinite(x) ? x : null;
  };
  const out = new Map<string, GlobalBar>();
  for (const r of body.values) {
    const row = (r ?? {}) as Record<string, unknown>;
    const date = typeof row.datetime === "string" ? row.datetime.slice(0, 10) : "";
    const close = n(row.close);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || close === null) continue;
    out.set(date, { ticker, trade_date: date, open: n(row.open), high: n(row.high), low: n(row.low), close, volume: n(row.volume) });
  }
  return [...out.values()].sort((a, b) => a.trade_date.localeCompare(b.trade_date));
}
