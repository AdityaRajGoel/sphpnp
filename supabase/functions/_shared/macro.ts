/**
 * Parsers for the two macro data sources sync-macro ingests: World Bank Open
 * Data (Indian indicators) and Frankfurter (INR exchange rates). No I/O and no
 * Deno APIs here - `fetch` stays in the edge function - so Vitest can import
 * this module directly from src/test.
 */

export type WorldBankObservation = {
  year: number;
  value: number;
};

/**
 * The World Bank's country/indicator endpoint answers with a TWO-ELEMENT
 * array: `[paging metadata, data[]]`. There is no top-level object to check
 * for an "ok" flag - the shape itself is the only signal.
 *
 * Two other shapes reach this code on a bad request, both caught by the
 * `Array.isArray(json) && json.length >= 2` guard because neither is a
 * two-element array of [object, array]:
 *
 *  - an unknown indicator or country: `[{ message: [{ id, key, value }] }]`,
 *    a ONE-element array;
 *  - `page` beyond the last page: `[metadata, []]` - a valid two-element
 *    envelope, but with an empty data array, handled by flatMap below
 *    returning [] naturally rather than needing a special case.
 */
export function parseWorldBankIndicator(json: unknown): WorldBankObservation[] {
  if (!Array.isArray(json) || json.length < 2) return [];
  const data = json[1];
  if (!Array.isArray(data)) return [];

  return data.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const r = row as Record<string, unknown>;

    // `value` is frequently null for the most recent one or two years - the
    // national statistics office hasn't reported yet and the World Bank has
    // not backfilled it. Skipped rather than written as 0, which would read
    // as "confirmed zero inflation" (or zero GDP growth) instead of "no
    // figure exists yet". This is the single most important behavior this
    // parser has to get right - the task this function was built for names it
    // explicitly.
    if (r.value === null || r.value === undefined) return [];

    const year = Number(r.date);
    const value = Number(r.value);
    if (!Number.isFinite(year) || !Number.isFinite(value)) return [];

    return [{ year, value }];
  });
}

export type FrankfurterRate = {
  date: string;
  rate: number;
};

/**
 * Frankfurter's `/latest` (and historical `/<date>..`) endpoints answer with
 * `{ amount, base, date, rates: { <QUOTE>: <number>, ... } }` - a flat object,
 * no envelope, no paging. An unsupported currency pair does not 4xx; it
 * answers 200 with `{ "message": "not found" }`, which has no `rates` key at
 * all, so the `typeof j.rates !== "object"` guard below rejects it the same
 * as any other malformed payload rather than needing a special case.
 *
 * `quoteCurrency` is the caller's responsibility (matches whatever `to=`
 * was requested) since this function has no way to know which currency the
 * caller expected out of a `rates` object that could in principle carry
 * several.
 */
export function parseFrankfurterRate(json: unknown, quoteCurrency: string): FrankfurterRate | null {
  if (!json || typeof json !== "object") return null;
  const j = json as { date?: unknown; rates?: unknown };
  if (typeof j.date !== "string" || !j.date) return null;
  if (!j.rates || typeof j.rates !== "object") return null;

  const rate = (j.rates as Record<string, unknown>)[quoteCurrency];
  if (typeof rate !== "number" || !Number.isFinite(rate)) return null;

  return { date: j.date, rate };
}
