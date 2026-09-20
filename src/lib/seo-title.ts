/**
 * The <title> for a stock page.
 *
 * Search results and answer engines clip a title past ~60 characters, and the
 * old template (`${name} (${SYMBOL}) | Shri Parasram Holdings Panipat`) reached
 * 74 for Reliance alone. The symbol and the brand are what a reader scans for,
 * so the company name is what gives way when something has to.
 */
const MAX = 60;
const BRAND = "Parasram";

export function stockPageTitle(name: string | null | undefined, symbol: string): string {
  const ticker = symbol.toUpperCase();
  if (!name) return `${ticker} share price and financials | ${BRAND}`;

  const suffix = ` (${ticker}) share price | ${BRAND}`;
  const room = MAX - suffix.length;
  const trimmed = name.length <= room ? name : `${name.slice(0, Math.max(1, room - 1)).trimEnd()}…`;
  return `${trimmed}${suffix}`;
}
