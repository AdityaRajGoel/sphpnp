/**
 * MCX's own market watch (www.mcxindia.com/market-data/market-watch/GetMarketWatch),
 * fetched from inside a browser page by scripts/host-mcx.mts because MCX's CDN refuses
 * plain HTTP clients. The host posts only the commodity futures rows (InstrumentName
 * "FUTCOM"); everything here re-validates them, since the function treats the post as
 * untrusted input.
 */

export type McxFuture = {
  trade_date: string;
  symbol: string;
  expiry: string;
  unit: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  prev_close: number | null;
  change_pct: number | null;
  volume: number;
  oi: number;
  value_lacs: number | null;
  ltt: string;
};

const MONTHS: Record<string, string> = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };
const SYMBOL = /^[A-Z0-9]{2,20}$/;

/** "04DEC2026" -> "2026-12-04"; null for anything else. */
export function mcxExpiry(value: unknown): string | null {
  const m = /^(\d{2})([A-Z]{3})(\d{4})$/.exec(String(value ?? "").trim().toUpperCase());
  return m && MONTHS[m[2]] ? `${m[3]}-${MONTHS[m[2]]}-${m[1]}` : null;
}

const pos = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
const finite = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Valid FUTCOM rows as stored rows. The trade date and time come from LTTValue
 * ("2026-10-01 23:29:58", IST); a contract that has not traded keeps no row.
 */
export function parseMcxFutures(rows: unknown): McxFuture[] {
  if (!Array.isArray(rows)) return [];
  const out: McxFuture[] = [];
  for (const raw of rows.slice(0, 500)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (r.InstrumentName !== "FUTCOM") continue;
    const symbol = String(r.Symbol ?? "").trim().toUpperCase();
    const expiry = mcxExpiry(r.ExpiryDate);
    const close = pos(r.LTP);
    const ltt = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(String(r.LTTValue ?? ""));
    if (!SYMBOL.test(symbol) || !expiry || close === null || !ltt) continue;
    out.push({
      trade_date: ltt[1],
      symbol,
      expiry,
      unit: String(r.Unit ?? "").trim().slice(0, 20),
      open: pos(r.Open), high: pos(r.High), low: pos(r.Low), close,
      prev_close: pos(r.PreviousClose),
      change_pct: finite(r.PercentChange),
      volume: Math.max(0, Math.round(finite(r.Volume) ?? 0)),
      oi: Math.max(0, Math.round(finite(r.OpenInterest) ?? 0)),
      value_lacs: finite(r.ValueInLacs),
      ltt: `${ltt[1]}T${ltt[2]}+05:30`,
    });
  }
  return out;
}

/** Each commodity's most-held contract (highest open interest, then the nearest expiry). */
export function activeContracts<T extends Pick<McxFuture, "symbol" | "expiry" | "oi">>(rows: T[]): Map<string, T> {
  const best = new Map<string, T>();
  for (const r of rows) {
    const cur = best.get(r.symbol);
    if (!cur || r.oi > cur.oi || (r.oi === cur.oi && r.expiry < cur.expiry)) best.set(r.symbol, r);
  }
  return best;
}

/**
 * One day of MCX's date-wise bhavcopy (market-data/bhavcopy/GetDateWiseBhavCopy,
 * InstrumentName=FUTCOM): the day's closing figures per contract, for history. "Date" is
 * MM/DD/YYYY; symbols come space-padded. The close stands in for the last trade time.
 */
export function parseMcxBhavcopy(rows: unknown): McxFuture[] {
  if (!Array.isArray(rows)) return [];
  const out: McxFuture[] = [];
  for (const raw of rows.slice(0, 500)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (r.InstrumentName !== "FUTCOM") continue;
    const d = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(r.Date ?? "").trim());
    const symbol = String(r.Symbol ?? "").trim().toUpperCase();
    const expiry = mcxExpiry(r.ExpiryDate);
    const close = pos(r.Close);
    if (!d || !SYMBOL.test(symbol) || !expiry || close === null) continue;
    const trade_date = `${d[3]}-${d[1]}-${d[2]}`;
    const prev = pos(r.PreviousClose);
    out.push({
      trade_date, symbol, expiry, unit: "",
      open: pos(r.Open), high: pos(r.High), low: pos(r.Low), close,
      prev_close: prev,
      change_pct: prev ? Math.round(((close - prev) / prev) * 10_000) / 100 : null,
      volume: Math.max(0, Math.round(finite(r.Volume) ?? 0)),
      oi: Math.max(0, Math.round(finite(r.OpenInterest) ?? 0)),
      value_lacs: finite(r.Value),
      ltt: `${trade_date}T23:30:00+05:30`,
    });
  }
  return out;
}
