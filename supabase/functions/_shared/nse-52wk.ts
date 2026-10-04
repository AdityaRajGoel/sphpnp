/**
 * NSE's daily 52-week high/low report (archives: /content/CM_52_wk_High_low_<DDMMYYYY>.csv).
 * One file covers every listed security, with highs and lows already adjusted
 * for bonuses, splits and rights - which the bhavcopy (one day only) cannot give.
 *
 * Layout: two quoted note lines (a disclaimer, then "Effective for 30-Sep-2026"),
 * a header, then rows. Prices are space-padded; a security with no trades in
 * the year has "-" in every column and is skipped.
 */
export type Week52Row = {
  symbol: string; series: string;
  high_52: number; high_date: string | null;
  low_52: number; low_date: string | null;
};

/** Equity boards only, as in sync-bhavcopy: mainboard EQ/BE/BZ, SME SM/ST, IQ. */
const EQUITY_SERIES = new Set(["EQ", "BE", "BZ", "SM", "ST", "IQ"]);
const MONTHS: Record<string, string> = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

/** "26-DEC-2025" or "30-Sep-2026" -> "2025-12-26"; anything else -> null. */
function isoDate(s: string): string | null {
  const m = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(s.trim());
  const mon = m ? MONTHS[m[2].toUpperCase()] : undefined;
  return m && mon ? `${m[3]}-${mon}-${m[1]}` : null;
}

const price = (s: string): number | null => {
  const v = Number(s.trim());
  return s.trim() && Number.isFinite(v) && v > 0 ? v : null;
};

/** Fields are always quoted and never contain commas, so a plain split is enough. */
const cells = (line: string) => line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));

export function parse52Week(csv: string): { effectiveDate: string | null; rows: Week52Row[] } {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  const headerAt = lines.findIndex((l) => /"?SYMBOL"?\s*,\s*"?SERIES"?/i.test(l) && /52/.test(l));
  if (headerAt < 0) return { effectiveDate: null, rows: [] };

  const note = lines.slice(0, headerAt).join(" ");
  const effectiveDate = isoDate(/Effective for (\d{2}-[A-Za-z]{3}-\d{4})/i.exec(note)?.[1] ?? "");

  const rows: Week52Row[] = [];
  for (const line of lines.slice(headerAt + 1)) {
    const [symbol, series, high, highDate, low, lowDate] = cells(line);
    const high_52 = price(high ?? "");
    const low_52 = price(low ?? "");
    if (!symbol || !EQUITY_SERIES.has((series ?? "").toUpperCase()) || high_52 === null || low_52 === null) continue;
    rows.push({ symbol, series: series.toUpperCase(), high_52, high_date: isoDate(highDate ?? ""), low_52, low_date: isoDate(lowDate ?? "") });
  }
  return { effectiveDate, rows };
}
