/**
 * IPO listing performance derived from exchange bars, for issues whose catalogue
 * row carries no listing price.
 *
 * On its first day an IPO trades through NSE's special pre-open session, whose
 * single equilibrium price is the day's open (NSE member FAQ, special pre-open
 * session). So the listing price is the open of the first bar on or after the
 * listing date, and the listing gain is that open against the issue price.
 */

export type NseIpoLink = { symbol: string; ipo_slug: string | null; issue_price: number | null; listing_date: string | null };
export type EodBar = { symbol: string; trade_date: string; open: number | null; close: number | null };

export type ListingPerformance = {
  listing_price: number;
  listing_gain_pct: number;
  listing_day_close: number | null;
  listing_day_close_gain_pct: number | null;
  latest_close: number | null;
  latest_close_date: string | null;
  gain_since_issue_pct: number | null;
  nse_symbol: string;
};

const positive = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const pct = (now: number, base: number) => (now / base - 1) * 100;

/** Performance for one issue from its own bars (any order). Null when the listing bar or issue price is missing. */
export function listingPerformance(link: NseIpoLink, bars: readonly EodBar[]): ListingPerformance | null {
  if (!positive(link.issue_price) || !link.listing_date) return null;
  const own = bars
    .filter((b) => b.symbol === link.symbol && b.trade_date >= link.listing_date!)
    .sort((a, b) => a.trade_date.localeCompare(b.trade_date));
  const first = own[0];
  // A first bar more than a week after the listing date is a later session, not the listing.
  if (!first || !positive(first.open)) return null;
  if (Date.parse(`${first.trade_date}T00:00:00Z`) - Date.parse(`${link.listing_date}T00:00:00Z`) > 7 * 86_400_000) return null;
  const last = [...own].reverse().find((b) => positive(b.close)) ?? null;
  return {
    listing_price: first.open,
    listing_gain_pct: pct(first.open, link.issue_price),
    listing_day_close: positive(first.close) ? first.close : null,
    listing_day_close_gain_pct: positive(first.close) ? pct(first.close, link.issue_price) : null,
    latest_close: last?.close ?? null,
    latest_close_date: last?.trade_date ?? null,
    gain_since_issue_pct: last && positive(last.close) ? pct(last.close, link.issue_price) : null,
    nse_symbol: link.symbol,
  };
}

/** One map from catalogue slug to performance, for every linked issue that has bars. */
export function performanceBySlug(links: readonly NseIpoLink[], bars: readonly EodBar[]): Map<string, ListingPerformance> {
  const out = new Map<string, ListingPerformance>();
  for (const link of links) {
    if (!link.ipo_slug) continue;
    const perf = listingPerformance(link, bars);
    if (perf) out.set(link.ipo_slug, perf);
  }
  return out;
}
