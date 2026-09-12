// Turns one Yahoo quote object into the row fetch-screener-data upserts into
// screener_stocks.
//
// Pulled out of fetch-screener-data/index.ts (which calls Deno.serve() at
// module scope and therefore cannot be imported into a Node/vitest test
// runner) so this pure, testable logic can be exercised directly - the same
// reason ratios.ts and period.ts live here rather than inline in their
// respective sync functions.

export type StockMeta = { symbol: string; name: string; sector: string };
export type YahooQuoteLike = Record<string, unknown>;

/**
 * A quote whose last trade is more than `maxDays` old: a delisted or suspended
 * stock. Yahoo keeps answering for these with the final price (Tata Metaliks,
 * merged into Tata Steel, still quoted at its 2024 close), so writing it would
 * stamp a dead price as current. A quote without a trade time is not judged.
 */
export function isStaleQuote(q: YahooQuoteLike, nowMs: number, maxDays = 7): boolean {
  const t = q.regularMarketTime;
  const ms = typeof t === "number" && Number.isFinite(t) ? t * 1000 : typeof t === "string" ? Date.parse(t) : NaN;
  return Number.isFinite(ms) && nowMs - ms > maxDays * 86_400_000;
}

// Whether `q` (a Yahoo quote/chart record) carries a usable market cap.
// A missing, zero, negative, or non-numeric value means Yahoo didn't give
// us real data this run - that is NOT the same as the company actually
// having a zero market cap, and must never be treated as one.
export function hasUsableMarketCap(q: YahooQuoteLike): boolean {
  const v = q.marketCap;
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

/**
 * Whether `value` is real data Yahoo actually reported, rather than this
 * file's (or fetch-screener-data's own v8 chart fallback's) `?? 0` filler
 * for "we don't know". Mirrors hasUsableMarketCap's rule one level down:
 * missing, non-numeric, or non-finite is never usable, and - because 0 is
 * the established sentinel this codebase already uses for "unknown" on
 * market_cap and (in the v8 fallback) trailingPE - a literal 0 is treated
 * as unusable too, not as "the value is genuinely zero".
 *
 * `allowNegative` exists because some of these fields have real negative
 * values (a stock trading down, a loss-making company's P/E) that must not
 * be discarded just for being negative.
 */
function usableNumber(value: unknown, opts: { allowNegative?: boolean } = {}): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value === 0) return null;
  if (!opts.allowNegative && value < 0) return null;
  return value;
}

// One (row key, source field(s), sign rule) triple per optional column.
// pe is the only field with two candidate source fields (trailingPE falls
// back to forwardPE) - handled as its own case below rather than forced
// into this table.
const OPTIONAL_QUOTE_FIELDS: ReadonlyArray<{
  column: string;
  field: string;
  allowNegative?: boolean;
}> = [
  { column: "price", field: "regularMarketPrice" },
  { column: "change", field: "regularMarketChange", allowNegative: true },
  { column: "change_pct", field: "regularMarketChangePercent", allowNegative: true },
  { column: "high_52", field: "fiftyTwoWeekHigh" },
  { column: "low_52", field: "fiftyTwoWeekLow" },
  { column: "volume", field: "regularMarketVolume" },
  { column: "day_high", field: "regularMarketDayHigh" },
  { column: "day_low", field: "regularMarketDayLow" },
  { column: "open_price", field: "regularMarketOpen" },
  { column: "prev_close", field: "regularMarketPreviousClose" },
];

export function buildStockRow(stock: StockMeta, q: YahooQuoteLike): Record<string, unknown> {
  const row: Record<string, unknown> = {
    symbol: stock.symbol,
    name: stock.name,
    sector: stock.sector,
    updated_at: new Date().toISOString(),
  };

  for (const { column, field, allowNegative } of OPTIONAL_QUOTE_FIELDS) {
    const value = usableNumber(q[field], { allowNegative });
    if (value !== null) row[column] = value;
  }

  // trailingPE falls back to forwardPE - the only field with two candidate
  // sources - so it cannot live in the table above.
  const pe = usableNumber(q.trailingPE, { allowNegative: true })
    ?? usableNumber(q.forwardPE, { allowNegative: true });
  if (pe !== null) row.pe = pe;

  // market_cap keeps its own pre-existing rule (hasUsableMarketCap) and unit
  // conversion (raw Yahoo value -> crores) rather than being folded into
  // OPTIONAL_QUOTE_FIELDS, which assumes a 1:1 field-to-column passthrough.
  if (hasUsableMarketCap(q)) {
    row.market_cap = Math.round((q.marketCap as number) / 10000000);
  }

  return row;
}

/**
 * Groups rows by the exact set of keys they carry, so each group can be
 * upserted in its own PostgREST call.
 *
 * PostgREST's bulk upsert derives one fixed column list per call from the
 * batch it is given. Rows that omit different optional columns - because
 * Yahoo returned different fields for different symbols this run - must
 * never share a call: mixing shapes either errors or fills the "missing"
 * row's omitted columns with NULL, overwriting whatever good value is
 * already stored there. See hasUsableMarketCap's original two-bucket split
 * in fetch-screener-data, which this generalizes to every optional field
 * buildStockRow may omit.
 */
export function groupRowsByShape(
  rows: Record<string, unknown>[],
): Record<string, unknown>[][] {
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const key = Object.keys(row).sort().join(",");
    const group = groups.get(key);
    if (group) {
      group.push(row);
    } else {
      groups.set(key, [row]);
    }
  }
  return [...groups.values()];
}
