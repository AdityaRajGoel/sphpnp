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
export type BoardItem = { symbol: string; name: string; group: BoardGroup; region?: string; country?: string };

export const WORLD_INDICES: BoardItem[] = [
  ["^NSEI", "Nifty 50", "Asia", "IN"], ["^BSESN", "BSE Sensex", "Asia", "IN"],
  ["^GSPC", "S&P 500", "Americas", "US"], ["^IXIC", "Nasdaq Composite", "Americas", "US"], ["^DJI", "Dow Jones", "Americas", "US"],
  ["^GSPTSE", "TSX Composite", "Americas", "CA"], ["^BVSP", "Bovespa", "Americas", "BR"], ["^MXX", "IPC Mexico", "Americas", "MX"],
  ["^MERV", "MERVAL", "Americas", "AR"],
  ["^FTSE", "FTSE 100", "Europe", "GB"], ["^GDAXI", "DAX", "Europe", "DE"], ["^FCHI", "CAC 40", "Europe", "FR"],
  ["FTSEMIB.MI", "FTSE MIB", "Europe", "IT"], ["^IBEX", "IBEX 35", "Europe", "ES"], ["^AEX", "AEX", "Europe", "NL"],
  ["^SSMI", "SMI", "Europe", "CH"], ["^OMX", "OMX Stockholm 30", "Europe", "SE"], ["^OSEAX", "Oslo All Share", "Europe", "NO"],
  ["^OMXC25", "OMX Copenhagen 25", "Europe", "DK"], ["^OMXH25", "OMX Helsinki 25", "Europe", "FI"], ["^BFX", "BEL 20", "Europe", "BE"],
  ["^ATX", "ATX", "Europe", "AT"], ["^ISEQ", "ISEQ Overall", "Europe", "IE"],
  ["XU100.IS", "BIST 100", "Europe", "TR"],
  ["^N225", "Nikkei 225", "Asia", "JP"], ["000001.SS", "SSE Composite", "Asia", "CN"], ["^HSI", "Hang Seng", "Asia", "HK"],
  ["^KS11", "KOSPI", "Asia", "KR"], ["^TWII", "TAIEX", "Asia", "TW"], ["^STI", "STI", "Asia", "SG"],
  ["^KLSE", "KLCI", "Asia", "MY"], ["^JKSE", "Jakarta Composite", "Asia", "ID"], ["^SET.BK", "SET", "Asia", "TH"],
  ["PSEI.PS", "PSEi", "Asia", "PH"], ["^AXJO", "ASX 200", "Asia", "AU"], ["^NZ50", "NZX 50", "Asia", "NZ"],
  ["^TASI.SR", "Tadawul", "Middle East & Africa", "SA"], ["DFMGI.AE", "DFM General", "Middle East & Africa", "AE"],
  ["^TA125.TA", "TA-125", "Middle East & Africa", "IL"], ["^J203.JO", "JSE All Share", "Middle East & Africa", "ZA"],
].map(([symbol, name, region, country]) => ({ symbol, name, region, country, group: "world" as const }));

export const INDIA_SECTORS: BoardItem[] = [
  ["^NSEBANK", "Bank"], ["NIFTY_FIN_SERVICE.NS", "Financial Services"], ["^CNXPSUBANK", "PSU Bank"], ["^CNXIT", "IT"],
  ["^CNXAUTO", "Auto"], ["^CNXFMCG", "FMCG"], ["^CNXPHARMA", "Pharma"], ["^CNXMETAL", "Metal"], ["^CNXREALTY", "Realty"],
  ["^CNXENERGY", "Energy"], ["^CNXINFRA", "Infrastructure"], ["^CNXMEDIA", "Media"], ["^CNXPSE", "PSE"],
  ["^NSEMDCP50", "Midcap 50"], ["^INDIAVIX", "India VIX"],
].map(([symbol, name]) => ({ symbol, name, group: "sectors" as const }));

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
};

const change = (closes: number[], sessions: number): number | null =>
  closes.length > sessions && closes[closes.length - 1 - sessions] > 0
    ? (closes[closes.length - 1] / closes[closes.length - 1 - sessions] - 1) * 100
    : null;

/** One Yahoo chart response → a board row, or null when there are not two usable closes. */
export function summariseChart(item: BoardItem, raw: unknown): BoardRow | null {
  const result = (raw as { chart?: { result?: unknown[] } })?.chart?.result?.[0] as
    | { meta?: { currency?: string }; timestamp?: number[]; indicators?: { quote?: { close?: (number | null)[]; volume?: (number | null)[] }[] } }
    | undefined;
  const stamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  const pairs = stamps
    .map((t, i) => ({ t, c: quote?.close?.[i] ?? null, v: quote?.volume?.[i] ?? null }))
    .filter((p): p is { t: number; c: number; v: number | null } => typeof p.c === "number" && Number.isFinite(p.c) && p.c > 0);
  if (pairs.length < 2) return null;

  const closes = pairs.map((p) => p.c);
  const volumes = pairs.map((p) => p.v ?? 0);
  const lastVol = volumes[volumes.length - 1];
  const prior = volumes.slice(-21, -1).filter((v) => v > 0);
  const avg = prior.length ? prior.reduce((a, b) => a + b, 0) / prior.length : 0;
  const day = change(closes, 1);
  const last = closes[closes.length - 1];

  return {
    ...item,
    last,
    currency: result?.meta?.currency ?? null,
    as_of: new Date(pairs[pairs.length - 1].t * 1000).toISOString().slice(0, 10),
    day,
    week: change(closes, 5),
    month: change(closes, 21),
    quarter: change(closes, 62),
    volume_ratio: avg > 0 && lastVol > 0 ? lastVol / avg : null,
    est_flow_cr: item.group === "etfs" && day !== null && lastVol > 0 ? (Math.sign(day) * lastVol * last) / 1e7 : null,
    spark: closes.slice(-22),
  };
}
