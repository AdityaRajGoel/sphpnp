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
