/**
 * NSE's provisional FII/FPI and DII cash-market activity - the figure every
 * market desk quotes at 6 pm - from /api/fiidiiTradeReact. Combined across
 * NSE, BSE and MSEI by NSE itself. Values are ₹ crore.
 */

export type FiiDiiRow = { category: "FII/FPI" | "DII"; date: string; buy_cr: number; sell_cr: number; net_cr: number };

const MONTHS: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };

/** "11-Sep-2026" → "2026-09-11"; null for anything else. */
export function nseDate(value: string): string | null {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(value.trim());
  return m && MONTHS[m[2]] ? `${m[3]}-${MONTHS[m[2]]}-${m[1].padStart(2, "0")}` : null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/,/g, "")) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Keeps only well-formed FII/FPI and DII rows; a malformed row is dropped, never zero-filled. */
export function parseFiiDii(raw: unknown): FiiDiiRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r: Record<string, unknown>) => {
    const category = r?.category === "FII/FPI" || r?.category === "DII" ? r.category : null;
    const date = typeof r?.date === "string" ? nseDate(r.date) : null;
    const buy = num(r?.buyValue);
    const sell = num(r?.sellValue);
    const net = num(r?.netValue);
    if (!category || !date || buy === null || sell === null) return [];
    return [{ category, date, buy_cr: buy, sell_cr: sell, net_cr: net ?? buy - sell }];
  });
}
