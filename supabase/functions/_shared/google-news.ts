// Per-IPO news from Google News' RSS search (news.google.com/rss/search).
//
// Free and keyless. The IPO detail page used to filter the general market-news
// feed for words from the company's name, which found nothing for most issues;
// a search for the company's name as a phrase finds the coverage that exists -
// subscription updates, GMP pieces, reviews, listing reports.
//
// Pure: no fetch, no Deno APIs.

export type NewsItem = { title: string; source: string; url: string; published_at: string };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", nbsp: " " };

const decode = (value: string): string =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x?[0-9a-f]+|[a-z]+\d*);/gi, (whole, name: string) => {
      if (/^#x/i.test(name)) return String.fromCodePoint(parseInt(name.slice(2), 16));
      if (/^#\d+$/.test(name) && !ENTITIES[name]) return String.fromCodePoint(Number(name.slice(1)));
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
  const items: NewsItem[] = [];
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const source = tag(item, "source");
    const rawTitle = tag(item, "title");
    const title = source && rawTitle.endsWith(` - ${source}`) ? rawTitle.slice(0, -(source.length + 3)).trim() : rawTitle;
    const url = tag(item, "link");
    const published = Date.parse(tag(item, "pubDate"));
    if (!title || !/^https:\/\//.test(url) || Number.isNaN(published)) continue;
    if (!title.toLowerCase().includes(key)) continue;
    items.push({ title, source, url, published_at: new Date(published).toISOString() });
  }
  return items.sort((a, b) => b.published_at.localeCompare(a.published_at)).slice(0, limit);
}
