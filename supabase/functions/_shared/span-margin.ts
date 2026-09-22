// Pure parts of the span-margin function, shared with vitest (src/test/span-margin.test.ts).

export const MAX_LEGS = 20;
export const MAX_RESULTS = 40;
// The group platform's exchange segments this calculator offers: NSE F&O and NSE currency.
export const SEGMENTS: Record<number, string> = { 2: "NSEFO", 3: "NSECD" };

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
    .map((c) => ({
      exchange: SEGMENTS[c.ExchangeSegment],
      id: c.ExchangeInstrumentID,
      name: c.Name,
      label: c.DisplayName,
      series: c.Series,
      lotSize: c.LotSize,
      expiry: c.ContractExpiration?.slice(0, 10) ?? null,
    }));
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
