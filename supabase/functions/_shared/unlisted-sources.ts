/**
 * Pure parsing for the dealer price lists behind the "How our rates compare"
 * block. No I/O, no Deno APIs, so this file is importable by both the edge
 * function and Vitest.
 *
 * It lives apart from sync-unlisted-quotes/index.ts for one reason: when
 * Stockify's markup changed, the parser silently produced zero rows and nothing
 * in the repository could have caught it, because the parser was welded to a
 * `fetch`. Every rule that decides what a quote IS now sits behind a function
 * that a fixture can be pointed at.
 *
 * The governing rule for both sources is the same one stated in the sync: only
 * numbers actually published in the document a plain GET returns are read.
 * Nothing here derives, interpolates or guesses a price.
 */

export interface Quote {
  match_key: string;
  company_name: string;
  source: string;
  source_url: string;
  price: number;
  sector: string | null;
  /** Minimum dealable lot, where the dealer publishes one. */
  lot_size: number | null;
  /** The dealer's own stamp on the quote, not our collection time. */
  as_of: string | null;
  /** Deep link to that company's page, so a reader can verify one number. */
  quote_url: string | null;
}

export const UNLISTEDZONE_URL = "https://www.unlistedzone.com/shares";
export const STOCKIFY_URL =
  "https://stockify.net.in/unlisted-shares-price-list-india/";

/**
 * Dealers name the same company differently — "NSE India Limited Unlisted
 * Shares", "NSE India Unlisted Shares", "NSE India Ltd". Strip the boilerplate
 * so one company yields one key across sources.
 *
 * This is imperfect and knowingly so: a dealer listing "CSK Unlisted Shares"
 * against another's "Chennai Super Kings Unlisted Shares" will not match, and
 * no amount of suffix-stripping fixes an abbreviation. Unmatched companies are
 * simply not compared, which is the safe direction to fail.
 */
export function matchKey(name: string): string {
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

/**
 * Pull one escaped JSON array out of a Next.js RSC flight payload by its key.
 *
 * Both dealers are Next.js apps that ship their lists as escaped JSON inside
 * `self.__next_f.push([1,"..."])`, so the array is extracted and parsed rather
 * than scraped out of rendered markup. That is not a stylistic preference: an
 * earlier UnlistedZone parser matched `"name"` and read the other fields from a
 * fixed window after it, which silently misattributed data because `slug`
 * precedes `name` in each object — Hindustan Power Exchange was being labelled
 * with Onix's sector. Parsing the real array removes that whole class of bug.
 *
 * The bracket walk skips string contents so a bracket inside a company name
 * cannot terminate the array early.
 */
export function extractEmbeddedArray(
  html: string,
  key: string,
): Array<Record<string, unknown>> {
  const marker = `\\"${key}\\":[`;
  const start = html.indexOf(marker);
  if (start < 0) return [];

  let depth = 0;
  let inStr = false;
  let end = -1;
  for (let i = start + marker.length - 1; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (c === "\\" && html.slice(i, i + 2) === '\\"') { i++; inStr = false; }
      continue;
    }
    if (c === "\\" && html.slice(i, i + 2) === '\\"') { i++; inStr = true; continue; }
    if (c === "[") depth++;
    else if (c === "]") { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) return [];

  const raw = html
    .slice(start + marker.length - 1, end + 1)
    .replace(/\\"/g, '"')
    .replace(/\\u0026/g, "&")
    .replace(/\\\\/g, "\\");

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Finite, strictly positive, or null. Zero is a placeholder, not a price. */
function positiveNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseUnlistedZone(html: string): Quote[] {
  const out: Quote[] = [];
  const seen = new Set<string>();

  for (const share of extractEmbeddedArray(html, "shares")) {
    const name = typeof share.name === "string" ? share.name.trim() : "";
    // Companies are published at 0 until a rate is set.
    const price = positiveNumber(share.price);
    if (!name || price === null) continue;

    const key = matchKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const asOf = typeof share.as_of === "string" ? share.as_of : null;
    const slug = typeof share.slug === "string" ? share.slug : null;

    out.push({
      match_key: key,
      company_name: name,
      price,
      sector: typeof share.sector === "string" ? share.sector : null,
      lot_size: positiveNumber(share.lot_size),
      // Kept only when it parses as a real date; a malformed value would
      // otherwise be shown to readers as the quote's age.
      as_of: asOf && !Number.isNaN(Date.parse(asOf)) ? asOf.slice(0, 10) : null,
      quote_url: slug ? `${UNLISTEDZONE_URL}/${slug}` : null,
      source: "UnlistedZone",
      source_url: UNLISTEDZONE_URL,
    });
  }
  return out;
}

/**
 * Stockify moved from a server-rendered price table to a Next.js app, and the
 * old parser — which matched "<company> Unlisted Shares ₹1,234.56" as adjacent
 * text — went to zero rows overnight. In the current markup a sector line, a
 * category pill and a "Price" label all sit between the company name and its
 * figure, so nothing about that regex could be repaired; adjacency is simply no
 * longer true. The scheduled run failed correctly and loudly
 * ("parsed 0 quotes (markup likely changed)"), which is what that check is for.
 *
 * The page carries the same data as JSON in the flight payload, in two arrays:
 *
 *   `data`    the price-list page itself — richer, but only the first page of
 *             companies (~30).
 *   `stocks`  the home ticker — name, slug and price only, but a wider set
 *             (~62).
 *
 * Both are read and merged, `data` first so its richer fields win a collision.
 * They were verified to agree: across the 18 companies present in both, zero
 * price disagreements. Merging is what keeps coverage from silently halving.
 */
export function parseStockify(html: string): Quote[] {
  const out: Quote[] = [];
  const seen = new Set<string>();

  for (const entry of [
    ...extractEmbeddedArray(html, "data"),
    ...extractEmbeddedArray(html, "stocks"),
  ]) {
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    const price = positiveNumber(entry.price);
    if (!name || price === null) continue;

    const key = matchKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const slug = typeof entry.slug === "string" ? entry.slug : null;

    out.push({
      match_key: key,
      company_name: name,
      price,
      // Deliberately null, though `data` does carry a sector. Stockify files it
      // lowercase and free-form ("non banking financial company") where
      // UnlistedZone files a short label, and the comparison block shows
      // whichever source's sector it finds first — so importing this one would
      // make the same company's sector change wording depending on which
      // dealer happened to be read first.
      sector: null,
      // The list carries no lot size. An invented one is worse than an absent
      // one.
      lot_size: null,
      // No per-quote stamp is published. `keyIndicators.updatedAt` exists but
      // dates the financial-indicator block, not the price, and this field
      // drives the "as of" date shown above the whole comparison table — so
      // borrowing it would put a date on a number it does not describe.
      as_of: null,
      quote_url: slug ? `https://stockify.net.in/companies/${slug}` : null,
      source: "Stockify",
      source_url: STOCKIFY_URL,
    });
  }
  return out;
}
