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
