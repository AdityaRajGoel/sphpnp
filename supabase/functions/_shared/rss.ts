// Pure predicate pulled out of fetch-news/index.ts so it's testable under
// Vitest - the fetch flow around it (Deno.fetch, Deno.serve) is not.

/**
 * A feed URL that has rotted into a redirect (301 -> some HTML page) is still
 * a 200 by the time `fetch` returns, because Deno follows redirects
 * automatically. `res.ok` alone can't see that: the body is a webpage, the
 * `<item>` regex in fetchRss finds nothing, and the caller returns
 * `{ ok: true, items: [] }` - a rotted URL reads as a quiet news day forever.
 *
 * Checking for either RSS's `<item` or Atom's `<entry` after a successful
 * fetch turns that into a real, counted failure. `[\s>]` after the tag name
 * avoids false-positives on unrelated tags/attributes that merely start with
 * "item" or "entry" (e.g. "<itemprop", "<entryPoint").
 */
export function hasFeedItems(xml: string): boolean {
  return /<item[\s>]/i.test(xml) || /<entry[\s>]/i.test(xml);
}

/**
 * A publication date that `Date` cannot parse yields an Invalid Date, whose
 * `.toISOString()` does not return a sentinel - it THROWS
 * `RangeError: Invalid time value`.
 *
 * In fetch-news that throw happened inside the per-item `.map()`, so it escaped
 * the map, escaped the enclosing try, and discarded the WHOLE feed over a
 * single malformed item. Measured against the deployed function, four of nine
 * sources (LiveMint, BusinessLine, NDTV Profit, Business Today) were being lost
 * to exactly this - they fetch fine and parse fine apart from one date each.
 *
 * Falling back to `fallback` keeps one bad item from costing a whole publisher.
 * The item's position in the feed is a far better freshness signal than nothing
 * at all, and RSS orders newest-first.
 */
export function parseFeedDate(raw: string | null | undefined, fallback: Date = new Date()): Date {
  if (!raw) return fallback;
  const parsed = new Date(raw.trim());
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}
