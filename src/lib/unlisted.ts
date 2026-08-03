/**
 * Freshness rules for the dealer rate comparison on /unlisted-space.
 *
 * Name matching used to live here too, to line our own quotes up against the
 * dealers'. That column has been removed - these are reference rates and our
 * desk quotes on different lot sizes and settlement terms, so a side-by-side
 * row invited a comparison that was not like-for-like. Grouping quotes across
 * dealers now happens on the `match_key` the sync function stores, so the
 * client no longer needs its own copy of that logic.
 */

/** How old a collected quote may be before the UI stops treating it as current. */
export const QUOTE_STALE_AFTER_DAYS = 3;

export function isQuoteStale(fetchedAt: string, now = Date.now()): boolean {
  const ts = Date.parse(fetchedAt);
  // An unparseable timestamp is treated as stale. A quote we cannot date is
  // exactly the thing this module exists to avoid presenting as current.
  if (!Number.isFinite(ts)) return true;
  return now - ts > QUOTE_STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}
