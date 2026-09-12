// NSE's option chain, v3 (2026). The old option-chain-indices /
// option-chain-equities endpoints answer 404 since NSE moved to:
//
//   /api/option-chain-contract-info?symbol=NIFTY           expiry dates and strikes
//   /api/option-chain-v3?type=Indices|Equity&symbol=&expiry=  one expiry's chain
//
// Rows carry the expiry as `expiryDates` ("15-Sep-2026"); the old code filtered
// on `expiryDate`, which matches nothing in v3.
//
// Pure: no fetch. fetch-fno-data and sync-market-data do the I/O.

export const INDEX_UNDERLYINGS = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"];

export type OptionRow = {
  strike: number;
  callOI: number; callChange: number; callLTP: number; callIV: number; callVolume: number;
  putOI: number; putChange: number; putLTP: number; putIV: number; putVolume: number;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function contractInfoUrl(symbol: string): string {
  return `https://www.nseindia.com/api/option-chain-contract-info?symbol=${encodeURIComponent(symbol)}`;
}

export function optionChainUrl(symbol: string, expiry: string): string {
  const type = INDEX_UNDERLYINGS.includes(symbol) ? "Indices" : "Equity";
  return `https://www.nseindia.com/api/option-chain-v3?type=${type}&symbol=${encodeURIComponent(symbol)}&expiry=${encodeURIComponent(expiry)}`;
}

/**
 * Whether NSE's chain timestamp ("11-Sep-2026 15:40:00", Indian time) is from
 * after the 15:30 close. A chain read during the session is a live snapshot,
 * not the day's close, and must not be stored as one. No timestamp, no proof.
 */
export function isAfterClose(timestamp: string | null): boolean {
  const m = timestamp ? /\b(\d{1,2}):(\d{2})(?::\d{2})?\s*$/.exec(timestamp.trim()) : null;
  if (!m) return false;
  return Number(m[1]) * 60 + Number(m[2]) >= 15 * 60 + 30;
}

/** Expiry dates as NSE writes them ("15-Sep-2026"), nearest first. */
export function parseContractInfo(raw: unknown): string[] {
  const dates = isRecord(raw) && Array.isArray(raw.expiryDates) ? raw.expiryDates : [];
  return dates.filter((d): d is string => typeof d === "string" && /^\d{2}-[A-Za-z]{3}-\d{4}$/.test(d));
}

/** One expiry's chain: strikes ascending, with the underlying's price and NSE's timestamp. */
export function parseOptionChainV3(raw: unknown, expiry: string): { spot: number; timestamp: string | null; rows: OptionRow[] } {
  const records = isRecord(raw) && isRecord(raw.records) ? raw.records : {};
  const data = Array.isArray(records.data) ? records.data.filter(isRecord) : [];
  const byStrike = new Map<number, OptionRow>();
  for (const row of data) {
    const ce = isRecord(row.CE) ? row.CE : null;
    const pe = isRecord(row.PE) ? row.PE : null;
    const rowExpiry = typeof row.expiryDates === "string" ? row.expiryDates : typeof row.expiryDate === "string" ? row.expiryDate : null;
    if (rowExpiry && rowExpiry !== expiry) continue;
    const strike = num(row.strikePrice) || num(ce?.strikePrice) || num(pe?.strikePrice);
    if (!strike) continue;
    const entry = byStrike.get(strike) ?? {
      strike, callOI: 0, callChange: 0, callLTP: 0, callIV: 0, callVolume: 0, putOI: 0, putChange: 0, putLTP: 0, putIV: 0, putVolume: 0,
    };
    if (ce) Object.assign(entry, { callOI: num(ce.openInterest), callChange: num(ce.changeinOpenInterest), callLTP: num(ce.lastPrice), callIV: num(ce.impliedVolatility), callVolume: num(ce.totalTradedVolume) });
    if (pe) Object.assign(entry, { putOI: num(pe.openInterest), putChange: num(pe.changeinOpenInterest), putLTP: num(pe.lastPrice), putIV: num(pe.impliedVolatility), putVolume: num(pe.totalTradedVolume) });
    byStrike.set(strike, entry);
  }
  const first = data[0];
  const spot = num(records.underlyingValue) || num((isRecord(first?.CE) ? first.CE : {}).underlyingValue) || num((isRecord(first?.PE) ? first.PE : {}).underlyingValue);
  return {
    spot,
    timestamp: typeof records.timestamp === "string" ? records.timestamp : null,
    rows: [...byStrike.values()].sort((a, b) => a.strike - b.strike),
  };
}

/**
 * The strike at which option writers pay out least at expiry: for each
 * candidate settlement price, the intrinsic value of every call below it and
 * every put above it, weighted by open interest.
 */
export function maxPain(rows: OptionRow[]): number | null {
  let best: number | null = null;
  let least = Infinity;
  for (const settle of rows) {
    let pain = 0;
    for (const r of rows) {
      if (settle.strike > r.strike) pain += r.callOI * (settle.strike - r.strike);
      if (settle.strike < r.strike) pain += r.putOI * (r.strike - settle.strike);
    }
    if (pain < least) { least = pain; best = settle.strike; }
  }
  return best;
}

export type ChainSummary = { maxPain: number | null; pcr: number | null; totalCallOI: number; totalPutOI: number; callWall: number | null; putWall: number | null };

/** Put-call ratio of open interest, max pain, and the strikes with the most call and put OI. */
export function summariseChain(rows: OptionRow[]): ChainSummary {
  const totalCallOI = rows.reduce((s, r) => s + r.callOI, 0);
  const totalPutOI = rows.reduce((s, r) => s + r.putOI, 0);
  const top = (key: "callOI" | "putOI") => rows.reduce<OptionRow | null>((b, r) => (r[key] > (b?.[key] ?? 0) ? r : b), null)?.strike ?? null;
  return { maxPain: maxPain(rows), pcr: totalCallOI > 0 ? totalPutOI / totalCallOI : null, totalCallOI, totalPutOI, callWall: top("callOI"), putWall: top("putOI") };
}

/** The strikes nearest the underlying's price, `each` on either side. */
export function aroundSpot(rows: OptionRow[], spot: number, each = 15): OptionRow[] {
  if (rows.length === 0) return rows;
  const atm = rows.reduce((bi, r, i) => (Math.abs(r.strike - spot) < Math.abs(rows[bi].strike - spot) ? i : bi), 0);
  return rows.slice(Math.max(0, atm - each), atm + each + 1);
}
