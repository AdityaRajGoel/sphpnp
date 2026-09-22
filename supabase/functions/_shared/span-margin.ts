// Pure parts of the span-margin function, shared with vitest (src/test/span-margin.test.ts).

export const MAX_LEGS = 20;
export const MAX_RESULTS = 40;
// The group platform's exchange segments this calculator offers: NSE F&O, NSE currency
// and MCX commodities. BSE F&O is listed by the platform but its SPAN call returns
// zeros for buys and rejects sells, so it is left out.
export const SEGMENTS: Record<number, string> = { 2: "NSEFO", 3: "NSECD", 51: "MCXFO" };

export type Contract = {
  ExchangeSegment: number; ExchangeInstrumentID: number; Name: string; DisplayName: string;
  Series: string; LotSize: number; ContractExpiration?: string; StrikePrice?: number; OptionType?: number;
};

export type ContractOption = { exchange: string; id: number; name: string; label: string; series: string; lotSize: number; expiry: string | null };

/** Offered segments only, and no exchange-internal spread contracts ("29SEP27OCT SPD"): positions are legs. */
export const tradeable = (c: Contract) => Boolean(SEGMENTS[c.ExchangeSegment]) && !/\bSPD\b/.test(c.DisplayName);

/**
 * Every word of the query must appear in the contract's name. The underlying
 * itself sorts first ("RELIANCE" before "RELIANCEPP"), then futures before
 * options, nearest expiry, then strike.
 */
export function pickContracts(contracts: Contract[], query: string): ContractOption[] {
  const words = query.toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return contracts
    .filter((c) => tradeable(c) && words.every((w) => c.DisplayName.toUpperCase().includes(w)))
    .sort((a, b) =>
      Number(a.Name !== words[0]) - Number(b.Name !== words[0]) ||
      Number(!a.Series.startsWith("FUT")) - Number(!b.Series.startsWith("FUT")) ||
      (a.ContractExpiration ?? "").localeCompare(b.ContractExpiration ?? "") ||
      (a.StrikePrice ?? 0) - (b.StrikePrice ?? 0))
    .slice(0, MAX_RESULTS)
    .map(toOption);
}

export type Position = { exchange: string; id: number; quantity: number };

/** Whole positions only, on the offered segments, nonzero, bounded. Anything else is refused before it goes upstream. */
export function validPositions(raw: unknown): Position[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_LEGS) return null;
  const out: Position[] = [];
  for (const p of raw) {
    const exchange = (p as Position)?.exchange;
    const id = Number((p as Position)?.id);
    const quantity = Number((p as Position)?.quantity);
    if (!Object.values(SEGMENTS).includes(exchange)) return null;
    if (!Number.isInteger(id) || id <= 0) return null;
    if (!Number.isInteger(quantity) || quantity === 0 || Math.abs(quantity) > 10_000_000) return null;
    out.push({ exchange, id, quantity });
  }
  return out;
}

/** Contract names are letters, digits, spaces, '&' and '-' (M&M, BAJAJ-AUTO). */
export const validQuery = (q: unknown): q is string => typeof q === "string" && /^[A-Za-z0-9&\- ]{2,40}$/.test(q.trim());

// ---- Structured picker: symbol -> future / call / put -> expiry -> strike ----

export type Kind = "FUT" | "CE" | "PE";
export const KINDS: Kind[] = ["FUT", "CE", "PE"];
/** NSE F&O series: index contracts first, then stock contracts. */
export const seriesFor = (kind: Kind, index: boolean) => (kind === "FUT" ? (index ? "FUTIDX" : "FUTSTK") : index ? "OPTIDX" : "OPTSTK");
export const PICKER_SERIES = ["FUTIDX", "FUTSTK", "OPTIDX", "OPTSTK"];

export const validSymbol = (s: unknown): s is string => typeof s === "string" && /^[A-Z0-9&-]{1,20}$/.test(s);
export const validExpiry = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-10-27" -> "27Oct2026", the form the platform's lookups take. */
export function upstreamDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}${MONTHS[Number(m) - 1]}${y}`;
}

/** The platform lists expiries unsorted, repeated and including today's: dedupe, keep today onward, sort. */
export function cleanExpiries(raw: unknown, today: string): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 10)))]
    .filter((d) => d >= today)
    .sort();
}

export function sortedStrikes(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(Number).filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b);
}

export function toOption(c: Contract): ContractOption {
  return {
    exchange: SEGMENTS[c.ExchangeSegment],
    id: c.ExchangeInstrumentID,
    name: c.Name,
    label: c.DisplayName,
    series: c.Series,
    lotSize: c.LotSize,
    expiry: c.ContractExpiration?.slice(0, 10) ?? null,
  };
}
