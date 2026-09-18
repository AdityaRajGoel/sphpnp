/**
 * World indices, Indian sector indices and Indian ETFs from Yahoo's chart
 * endpoint, summarised for a board. Pure parsing lives here so the site's
 * tests exercise it; fetch-world-markets does the network.
 *
 * The country list follows the one worldmonitor used for its per-country index
 * view. ETF "flow" is an ESTIMATE from price direction and traded value - no
 * Indian exchange publishes daily ETF creations - and is labelled as such.
 */

export type BoardGroup = "world" | "sectors" | "etfs";
export type BoardItem = {
  symbol: string;
  name: string;
  group: BoardGroup;
  region?: string;
  country?: string;
  /** Sector tiles: the index_name in index_valuation_daily this tile is read from. */
  nse?: string;
};

export const WORLD_INDICES: BoardItem[] = [
  ["^NSEI", "Nifty 50", "Asia", "IN"], ["^BSESN", "BSE Sensex", "Asia", "IN"],
  ["^GSPC", "S&P 500", "Americas", "US"], ["^IXIC", "Nasdaq Composite", "Americas", "US"], ["^DJI", "Dow Jones", "Americas", "US"],
  ["^GSPTSE", "TSX Composite", "Americas", "CA"], ["^BVSP", "Bovespa", "Americas", "BR"], ["^MXX", "IPC Mexico", "Americas", "MX"],
  ["^MERV", "MERVAL", "Americas", "AR"],
  ["^FTSE", "FTSE 100", "Europe", "GB"], ["^GDAXI", "DAX", "Europe", "DE"], ["^FCHI", "CAC 40", "Europe", "FR"],
  ["FTSEMIB.MI", "FTSE MIB", "Europe", "IT"], ["^IBEX", "IBEX 35", "Europe", "ES"], ["^AEX", "AEX", "Europe", "NL"],
  ["^SSMI", "SMI", "Europe", "CH"], ["^OMX", "OMX Stockholm 30", "Europe", "SE"],
  ["^OMXC25", "OMX Copenhagen 25", "Europe", "DK"], ["^OMXH25", "OMX Helsinki 25", "Europe", "FI"], ["^BFX", "BEL 20", "Europe", "BE"],
  ["^ATX", "ATX", "Europe", "AT"], ["^ISEQ", "ISEQ Overall", "Europe", "IE"],
  ["XU100.IS", "BIST 100", "Europe", "TR"],
  ["^N225", "Nikkei 225", "Asia", "JP"], ["000001.SS", "SSE Composite", "Asia", "CN"], ["^HSI", "Hang Seng", "Asia", "HK"],
  ["^KS11", "KOSPI", "Asia", "KR"], ["^TWII", "TAIEX", "Asia", "TW"], ["^STI", "STI", "Asia", "SG"],
  ["^KLSE", "KLCI", "Asia", "MY"], ["^JKSE", "Jakarta Composite", "Asia", "ID"],
  ["^AXJO", "ASX 200", "Asia", "AU"], ["^NZ50", "NZX 50", "Asia", "NZ"],
  // Oslo, Thailand, Philippines, Saudi and Dubai were dropped on 2026-09-18:
  // Yahoo returned nothing for them on every run.
  ["^TA125.TA", "TA-125", "Middle East & Africa", "IL"], ["^J203.JO", "JSE All Share", "Middle East & Africa", "ZA"],
].map(([symbol, name, region, country]) => ({ symbol, name, region, country, group: "world" as const }));

// Read from index_valuation_daily - NSE's own daily index file, loaded every
// evening by sync-market-data - not from Yahoo, where ten of these fifteen
// symbols (^CNXAUTO, ^CNXFMCG, NIFTY_FIN_SERVICE.NS, ...) had stopped resolving.
// The symbol stays as the tile's stable key.
export const INDIA_SECTORS: BoardItem[] = [
  ["^NSEBANK", "Bank", "Nifty Bank"], ["NIFTY_FIN_SERVICE.NS", "Financial Services", "Nifty Financial Services"],
  ["^CNXPSUBANK", "PSU Bank", "Nifty PSU Bank"], ["^CNXIT", "IT", "Nifty IT"], ["^CNXAUTO", "Auto", "Nifty Auto"],
  ["^CNXFMCG", "FMCG", "Nifty FMCG"], ["^CNXPHARMA", "Pharma", "Nifty Pharma"], ["^CNXMETAL", "Metal", "Nifty Metal"],
  ["^CNXREALTY", "Realty", "Nifty Realty"], ["^CNXENERGY", "Energy", "Nifty Energy"],
  ["^CNXINFRA", "Infrastructure", "Nifty Infrastructure"], ["^CNXMEDIA", "Media", "Nifty Media"], ["^CNXPSE", "PSE", "Nifty PSE"],
  ["^NSEMDCP50", "Midcap 50", "Nifty Midcap 50"], ["^INDIAVIX", "India VIX", "India VIX"],
].map(([symbol, name, nse]) => ({ symbol, name, nse, group: "sectors" as const }));

export const INDIA_ETFS: BoardItem[] = [
  ["NIFTYBEES.NS", "Nippon Nifty BeES"], ["JUNIORBEES.NS", "Nippon Junior BeES"], ["BANKBEES.NS", "Nippon Bank BeES"],
  ["PSUBNKBEES.NS", "Nippon PSU Bank BeES"], ["ITBEES.NS", "Nippon IT BeES"], ["GOLDBEES.NS", "Nippon Gold BeES"],
  ["SILVERBEES.NS", "Nippon Silver BeES"], ["LIQUIDBEES.NS", "Nippon Liquid BeES"], ["CPSEETF.NS", "CPSE ETF"], ["MON100.NS", "Motilal Nasdaq 100"],
].map(([symbol, name]) => ({ symbol, name, group: "etfs" as const }));

export const BOARD: BoardItem[] = [...WORLD_INDICES, ...INDIA_SECTORS, ...INDIA_ETFS];

export type BoardRow = BoardItem & {
  last: number;
  currency: string | null;
  as_of: string;
  day: number | null;
  week: number | null;
  month: number | null;
  quarter: number | null;
  /** Latest session's volume against the average of the previous 20. */
  volume_ratio: number | null;
  /** ETFs only: traded value signed by the day's direction, in ₹ crore. An estimate, not reported creations. */
  est_flow_cr: number | null;
  spark: number[];
  /** World markets outside the US: the same returns as a dollar holder saw them. */
  usd?: { day: number | null; week: number | null; month: number | null; quarter: number | null } | null;
};

const change = (closes: number[], sessions: number): number | null =>
  closes.length > sessions && closes[closes.length - 1 - sessions] > 0
    ? (closes[closes.length - 1] / closes[closes.length - 1 - sessions] - 1) * 100
    : null;

export type DailyPoint = { date: string; close: number; volume: number | null };

/** Daily closes (oldest first) → a board row, or null without two usable closes. */
export function summariseSeries(item: BoardItem, points: DailyPoint[], currency: string | null): BoardRow | null {
  const usable = points.filter((p) => Number.isFinite(p.close) && p.close > 0);
  if (usable.length < 2) return null;

  const closes = usable.map((p) => p.close);
  const volumes = usable.map((p) => p.volume ?? 0);
  const lastVol = volumes[volumes.length - 1];
  const prior = volumes.slice(-21, -1).filter((v) => v > 0);
  const avg = prior.length ? prior.reduce((a, b) => a + b, 0) / prior.length : 0;
  const day = change(closes, 1);
  const last = closes[closes.length - 1];

  return {
    ...item,
    last,
    currency,
    as_of: usable[usable.length - 1].date,
    day,
    week: change(closes, 5),
    month: change(closes, 21),
    quarter: change(closes, 62),
    volume_ratio: avg > 0 && lastVol > 0 ? lastVol / avg : null,
    est_flow_cr: item.group === "etfs" && day !== null && lastVol > 0 ? (Math.sign(day) * lastVol * last) / 1e7 : null,
    spark: closes.slice(-22),
  };
}

/** Yahoo quotes some markets in minor units; a return converts at the major currency's rate. */
const MAJOR_UNIT: Record<string, string> = { GBp: "GBP", GBX: "GBP", ZAc: "ZAR", ZAC: "ZAR", ILA: "ILS" };

/** Yahoo's units-per-dollar rate for a quote currency ("JPY=X"), or null for dollars / unknown. */
export function fxSymbol(currency: string | null): string | null {
  if (!currency) return null;
  const major = MAJOR_UNIT[currency] ?? currency.toUpperCase();
  return major === "USD" ? null : `${major}=X`;
}

/**
 * A local-currency series in dollars: each close divided by the units-per-dollar
 * rate on that date, or the latest one before it (rates and markets keep
 * different holidays). Dates before the first rate are dropped, not guessed.
 */
export function inDollars(points: DailyPoint[], unitsPerDollar: DailyPoint[]): DailyPoint[] {
  const rates = unitsPerDollar.filter((r) => r.close > 0).sort((a, b) => a.date.localeCompare(b.date));
  const out: DailyPoint[] = [];
  let i = 0;
  let rate: number | null = null;
  for (const p of points) {
    while (i < rates.length && rates[i].date <= p.date) rate = rates[i++].close;
    if (rate !== null) out.push({ ...p, close: p.close / rate });
  }
  return out;
}

/** The dated closes in a Yahoo chart response, oldest first. */
export function chartPoints(raw: unknown): { points: DailyPoint[]; currency: string | null } {
  const result = (raw as { chart?: { result?: unknown[] } })?.chart?.result?.[0] as
    | { meta?: { currency?: string }; timestamp?: number[]; indicators?: { quote?: { close?: (number | null)[]; volume?: (number | null)[] }[] } }
    | undefined;
  const quote = result?.indicators?.quote?.[0];
  const points = (result?.timestamp ?? []).flatMap((t, i) => {
    const close = quote?.close?.[i];
    return typeof close === "number"
      ? [{ date: new Date(t * 1000).toISOString().slice(0, 10), close, volume: quote?.volume?.[i] ?? null }]
      : [];
  });
  return { points, currency: result?.meta?.currency ?? null };
}

/** One Yahoo chart response → a board row, or null when there are not two usable closes. */
export function summariseChart(item: BoardItem, raw: unknown): BoardRow | null {
  const { points, currency } = chartPoints(raw);
  return summariseSeries(item, points, currency);
}
