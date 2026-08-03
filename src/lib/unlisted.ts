/**
 * Joining our unlisted quotes to other dealers' published rates.
 *
 * `unlistedMatchKey` is duplicated in supabase/functions/sync-unlisted-quotes.
 * That is deliberate rather than an oversight: the function is Deno and cannot
 * import from `src/`, and the two must agree exactly or the join silently
 * produces zero matches. The tests in src/test/unlisted.test.ts pin the
 * behaviour so a change here that drifts from the function is caught.
 */

/**
 * Reduce a dealer's display name to a comparable key.
 *
 * Dealers write the same company differently — "NSE India Limited Unlisted
 * Shares", "NSE India Unlisted Shares", "NSE India Ltd" — so the boilerplate
 * suffixes and punctuation come off before comparing.
 *
 * Known limit: an abbreviation is not recoverable. One dealer's "CSK Unlisted
 * Shares" will not match another's "Chennai Super Kings Unlisted Shares", and
 * they simply go uncompared. Failing to match is the safe direction; matching
 * two different companies would put a wrong price beside a real one.
 */
export function unlistedMatchKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/\b(unlisted|pre-?ipo)\b/g, " ")
    .replace(/\b(shares?|equity|stock)\b/g, " ")
    .replace(/\b(limited|ltd|private|pvt|inc|corporation|corp)\b/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

/** How old a collected quote may be before the UI stops treating it as current. */
export const QUOTE_STALE_AFTER_DAYS = 3;

export function isQuoteStale(fetchedAt: string, now = Date.now()): boolean {
  const ts = Date.parse(fetchedAt);
  // An unparseable timestamp is treated as stale. A quote we cannot date is
  // exactly the thing this whole module exists to avoid presenting as current.
  if (!Number.isFinite(ts)) return true;
  return now - ts > QUOTE_STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}
