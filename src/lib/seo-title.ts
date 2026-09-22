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

const SITE_SUFFIX = " | Parasram India";

/**
 * Any page's <title>: the brand is appended only while the whole still fits.
 * Appending it to every title under 60 pushed 11 of 105 audited pages to 66-83
 * characters, clipped in results; Google shows the site name above the title
 * link anyway, so a long title does better without it.
 */
export function pageTitle(title: string): string {
  if (title.includes("Parasram")) return title;
  return title.length + SITE_SUFFIX.length <= MAX ? `${title}${SITE_SUFFIX}` : title;
}
