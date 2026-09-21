/**
 * Holdings from a broker's CSV export, parsed in the browser: the file never
 * leaves the device. Columns are found by header name, so Zerodha ("Instrument,
 * Qty., Avg. cost"), Groww ("Stock Name/Symbol, Quantity, Average buy price"),
 * Upstox and Angel exports all read, as does a plain "symbol,quantity".
 */

export type Holding = { symbol: string; qty: number; avg: number | null };

const SYMBOL_COLS = /^(instrument|symbol|trading ?symbol|tradingsymbol|scrip|scrip ?name|stock|stock ?symbol|ticker|isin ?symbol)$/;
const QTY_COLS = /^(qty\.?|quantity|shares|net ?qty|holding ?qty|quantity ?available|total ?quantity)$/;
const AVG_COLS = /^(avg\.? ?cost|average ?(buy ?)?price|avg\.? ?price|buy ?avg\.?|average ?cost|cost ?price)$/;
export const MAX_HOLDINGS = 200;

/** Splits one CSV line, honouring double quotes ("1,250.50"). */
function cells(line: string): string[] {
  const out: string[] = [];
  let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted; }
    else if (c === "," && !quoted) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const number = (s: string | undefined) => {
  const n = Number((s ?? "").replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};

/** "NSE:RELIANCE-EQ" -> "RELIANCE". */
export const cleanSymbol = (s: string) => s.toUpperCase().replace(/^(NSE|BSE):/, "").replace(/-(EQ|BE|BZ|SM|ST)$/, "").replace(/[^A-Z0-9&-]/g, "");

export function parseHoldings(text: string): { holdings: Holding[]; error: string | null } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  // Some exports put a title or account line above the header row.
  const headerAt = lines.findIndex((l) => cells(l).some((c) => SYMBOL_COLS.test(c.toLowerCase())));
  if (headerAt < 0) return { holdings: [], error: "No symbol column found. The file needs a column named Symbol, Instrument or Stock." };
  const header = cells(lines[headerAt]).map((h) => h.toLowerCase());
  const col = (re: RegExp) => header.findIndex((h) => re.test(h));
  const [si, qi, ai] = [col(SYMBOL_COLS), col(QTY_COLS), col(AVG_COLS)];
  if (qi < 0) return { holdings: [], error: "No quantity column found. The file needs a column named Qty or Quantity." };

  const bySymbol = new Map<string, Holding>();
  for (const line of lines.slice(headerAt + 1)) {
    const row = cells(line);
    const symbol = cleanSymbol(row[si] ?? "");
    const qty = number(row[qi]);
    if (!symbol || !qty || qty <= 0) continue;
    const avg = ai >= 0 ? number(row[ai]) : null;
    const prev = bySymbol.get(symbol);
    // The same stock on two lines (two demat accounts): add quantities, weight the cost.
    bySymbol.set(symbol, prev
      ? { symbol, qty: prev.qty + qty, avg: prev.avg !== null && avg !== null ? (prev.avg * prev.qty + avg * qty) / (prev.qty + qty) : null }
      : { symbol, qty, avg: avg && avg > 0 ? avg : null });
  }
  const holdings = [...bySymbol.values()].slice(0, MAX_HOLDINGS);
  return { holdings, error: holdings.length ? null : "No holdings with a quantity were found in the file." };
}
