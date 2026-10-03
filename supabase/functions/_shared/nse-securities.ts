/**
 * NSE's lists of every listed security: EQUITY_L.csv (main board) and
 * SME_EQUITY_L.csv (Emerge), from nsearchives.nseindia.com. They name the
 * companies the bhavcopy only gives symbols for, so every NSE stock can have a
 * page. The two files differ: headers with and without underscores and leading
 * spaces, and dates as 06-OCT-2008 or 30-Sep-26.
 */

export const EQUITY_LIST_URL = "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv";
export const SME_LIST_URL = "https://nsearchives.nseindia.com/emerge/corporates/content/SME_EQUITY_L.csv";

export type NseSecurity = {
  symbol: string;
  name: string;
  series: string;
  board: "main" | "sme";
  listing_date: string | null;
  isin: string | null;
  face_value: number | null;
};

const MONTHS: Record<string, string> = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };
const SYMBOL = /^[A-Z0-9&-]{1,20}$/;
const ISIN = /^IN[A-Z0-9]{10}$/;

/** "06-OCT-2008" or "30-Sep-26" -> ISO; two-digit years are 20xx. */
export function listingDate(value: string): string | null {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})$/.exec(value.trim());
  if (!m || !MONTHS[m[2].toUpperCase()]) return null;
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${year}-${MONTHS[m[2].toUpperCase()]}-${m[1].padStart(2, "0")}`;
}

const key = (h: string) => h.trim().toUpperCase().replace(/[\s_]+/g, " ");

/** Rows of one list; unknown or malformed rows are skipped. */
export function parseSecurities(csv: string, board: NseSecurity["board"]): NseSecurity[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const head = lines[0].split(",").map(key);
  const col = (name: string) => head.indexOf(name);
  const at = { symbol: col("SYMBOL"), name: col("NAME OF COMPANY"), series: col("SERIES"), date: col("DATE OF LISTING"), isin: col("ISIN NUMBER"), face: col("FACE VALUE") };
  if (at.symbol < 0 || at.name < 0) return [];
  const out: NseSecurity[] = [];
  for (const line of lines.slice(1)) {
    // Company names carry no commas in these files; a quoted field would, so split on commas outside quotes.
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim()) ?? [];
    const symbol = (cells[at.symbol] ?? "").toUpperCase();
    const name = cells[at.name] ?? "";
    if (!SYMBOL.test(symbol) || !name) continue;
    const isin = (cells[at.isin] ?? "").toUpperCase();
    const face = Number(cells[at.face]);
    out.push({
      symbol, name: name.slice(0, 200), series: (cells[at.series] ?? "").toUpperCase().slice(0, 4), board,
      listing_date: at.date >= 0 ? listingDate(cells[at.date] ?? "") : null,
      isin: ISIN.test(isin) ? isin : null,
      face_value: Number.isFinite(face) && face > 0 ? face : null,
    });
  }
  return out;
}
