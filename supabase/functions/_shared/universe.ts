/**
 * The screener universe: the hand-picked list in fetch-screener-data, widened
 * to the whole NIFTY 500 (large, mid and small caps) from index_constituents,
 * which sync-market-data refreshes from NSE. A semi-annual index review then
 * reaches the screener on its own.
 *
 * Hand-picked rows win: their names and sectors were set by hand. New rows
 * take NSE's company name and a sector mapped from NSE's industry, by the
 * sector most hand-picked stocks of that industry already carry. Pure: no I/O.
 */
export type UniverseStock = { symbol: string; yahoo: string; name: string; sector: string };
export type IndexConstituent = { symbol: string; company: string | null; industry: string | null };

/** NSE symbols are upper-case letters, digits, "&" and "-" (M&M, BAJAJ-AUTO). */
const VALID_SYMBOL = /^[A-Z0-9&-]{1,20}$/;

/** NSE industry -> the screener's sector. */
const INDUSTRY_SECTOR: Record<string, string> = {
  "Automobile and Auto Components": "Auto",
  "Capital Goods": "Infra",
  "Chemicals": "Chemicals",
  "Construction": "Infra",
  "Construction Materials": "Infra",
  "Consumer Durables": "Consumer",
  "Consumer Services": "Consumer",
  "Diversified": "Diversified",
  "Fast Moving Consumer Goods": "FMCG",
  "Healthcare": "Pharma",
  "Information Technology": "IT",
  "Media Entertainment & Publication": "Telecom",
  "Metals & Mining": "Metals",
  "Oil Gas & Consumable Fuels": "Energy",
  "Power": "Energy",
  "Realty": "Infra",
  "Services": "Infra",
  "Telecommunication": "Telecom",
  "Textiles": "Consumer",
};

/** NSE files banks, insurers and lenders alike under "Financial Services"; the name tells them apart. */
export function sectorFor(industry: string | null, company: string | null): string {
  if (industry === "Financial Services") {
    const name = company ?? "";
    if (/\bbank\b/i.test(name)) return "Banking";
    if (/insurance|assurance/i.test(name)) return "Insurance";
    return "NBFC";
  }
  return (industry && INDUSTRY_SECTOR[industry]) ?? "Diversified";
}

/** "Bajaj Auto Limited" -> "Bajaj Auto"; "Mphasis Ltd." -> "Mphasis". */
const cleanName = (company: string | null, symbol: string) =>
  (company ?? symbol).replace(/\s+(Ltd\.?|Limited)$/i, "").trim() || symbol;

export function mergeUniverse(curated: UniverseStock[], constituents: IndexConstituent[]): UniverseStock[] {
  const seen = new Set(curated.map((s) => s.symbol));
  const added: UniverseStock[] = [];
  for (const c of constituents) {
    const symbol = c.symbol?.trim().toUpperCase();
    if (!symbol || !VALID_SYMBOL.test(symbol) || seen.has(symbol)) continue;
    seen.add(symbol);
    added.push({ symbol, yahoo: `${symbol}.NS`, name: cleanName(c.company, symbol), sector: sectorFor(c.industry, c.company) });
  }
  return [...curated, ...added];
}

/**
 * Rows already in screener_stocks that the lists above do not cover: a stock a
 * visitor's search added (a BSE-only listing such as NSE.BO keeps its suffix as
 * its key) or one that has left the index. Without these the refresh never
 * re-quotes them and their prices freeze where they were first stored.
 */
// Any visitor's search can store a row (fetch-screener-data's symbol path), so the
// extras are capped: a flood of added symbols cannot grow every refresh's Yahoo calls.
// ponytail: first MAX_STORED_EXTRAS by symbol; rank by visits if real additions outgrow it.
export const MAX_STORED_EXTRAS = 50;

export function withStoredStocks(universe: UniverseStock[], stored: { symbol: string; name: string | null; sector: string | null }[]): UniverseStock[] {
  const seen = new Set(universe.map((s) => s.symbol));
  const extra: UniverseStock[] = [];
  for (const row of stored) {
    if (extra.length >= MAX_STORED_EXTRAS) break;
    const symbol = row.symbol?.trim().toUpperCase();
    if (!symbol || seen.has(symbol) || !/^[A-Z0-9&-]{1,20}(\.(NS|BO))?$/.test(symbol)) continue;
    seen.add(symbol);
    extra.push({ symbol, yahoo: symbol.includes(".") ? symbol : `${symbol}.NS`, name: row.name || symbol, sector: row.sector || "General" });
  }
  return [...universe, ...extra];
}
