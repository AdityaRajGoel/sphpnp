// Per-IPO and per-stock news from Google News' RSS search (news.google.com/rss/search).
//
// Free and keyless. The IPO detail page used to filter the general market-news
// feed for words from the company's name, which found nothing for most issues;
// a search for the company's name as a phrase finds the coverage that exists -
// subscription updates, GMP pieces, reviews, listing reports.
//
// Pure: no fetch, no Deno APIs.

/** A character from an entity's code point; nothing for a code point no character has (String.fromCodePoint would throw). */
const codePoint = (n: number): string => (Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "");

export type NewsItem = { title: string; source: string; url: string; published_at: string };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", nbsp: " " };

const decode = (value: string): string =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x?[0-9a-f]+|[a-z]+\d*);/gi, (whole, name: string) => {
      if (/^#x/i.test(name)) return codePoint(parseInt(name.slice(2), 16));
      if (/^#\d+$/.test(name) && !ENTITIES[name]) return codePoint(Number(name.slice(1)));
      return ENTITIES[name.toLowerCase()] ?? whole;
    })
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tag = (item: string, name: string): string => decode(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(item)?.[1] ?? "");

/** The catalogue name without its parenthetical: "National Stock Exchange of India (NSE )" -> the name alone. */
const plainName = (name: string) => name.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();

/** The search: the company's name as a phrase, with IPO, from the last 60 days. */
export function ipoNewsQuery(name: string): string {
  return `"${plainName(name)}" IPO when:60d`;
}

/** Every story in the RSS, as published: headline without its " - Publisher" suffix. */
export function rssItems(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const source = tag(item, "source");
    const rawTitle = tag(item, "title");
    const title = source && rawTitle.endsWith(` - ${source}`) ? rawTitle.slice(0, -(source.length + 3)).trim() : rawTitle;
    const url = tag(item, "link");
    const published = Date.parse(tag(item, "pubDate"));
    if (!title || !/^https:\/\//.test(url) || Number.isNaN(published)) continue;
    items.push({ title, source, url, published_at: new Date(published).toISOString() });
  }
  return items;
}

const newestFirst = (items: NewsItem[], limit: number) =>
  [...items].sort((a, b) => b.published_at.localeCompare(a.published_at)).slice(0, limit);

/**
 * Stories from the RSS, newest first, only those whose headline names the
 * company - the search is a phrase match, but Google also returns loosely
 * related pieces, and a story about some other issue is noise on this page.
 */
export function parseGoogleNewsRss(xml: string, companyName: string, limit = 8): NewsItem[] {
  // The first word of the name is distinctive enough ("Rentomojo", "Jindal") and
  // survives the abbreviations headlines use for long names.
  const key = plainName(companyName).split(" ")[0]?.toLowerCase() ?? "";
  if (!key) return [];
  return newestFirst(rssItems(xml).filter((i) => i.title.toLowerCase().includes(key)), limit);
}

/** A listed company's name as headlines write it: no legal suffix, no parenthetical. */
const stockName = (name: string) => plainName(name).replace(/\s+(limited|ltd\.?)$/i, "").trim();

/** The search for a listed stock: its name as a phrase, about its shares or results, from the last fortnight. */
export function stockNewsQuery(name: string): string {
  return `"${stockName(name)}" (share OR shares OR stock OR results) when:14d`;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wholeWord = (value: string) => new RegExp(`(^|[^a-z0-9])${escapeRegExp(value.toLowerCase())}([^a-z0-9]|$)`);

/**
 * Stories about one listed stock, newest first, with duplicates of the same
 * headline dropped. A headline must name the company in full or carry its
 * ticker as a word: the first word alone is not enough for a stock - "Tata"
 * or "Bajaj" heads a dozen listed companies.
 */
export function parseStockNewsRss(xml: string, companyName: string, symbol: string, limit = 10): NewsItem[] {
  const name = stockName(companyName).toLowerCase();
  if (!name) return [];
  const matchers = [wholeWord(name), wholeWord(symbol)];
  const seen = new Set<string>();
  const items = rssItems(xml).filter((i) => {
    const title = i.title.toLowerCase();
    if (!matchers.some((m) => m.test(title))) return false;
    const key = title.replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return newestFirst(items, limit);
}
