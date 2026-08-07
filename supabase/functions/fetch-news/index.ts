const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Strips tags to a fixed point (not just one pass) so a malformed/nested
// fragment like "<<script>script>" can't leave a live tag behind after a
// single regex sweep.
function stripTags(s: string): string {
  let prev: string;
  let out = s;
  do {
    prev = out;
    out = out.replace(/<[^>]+>/g, '');
  } while (out !== prev);
  return out;
}

interface NewsItem {
  title: string;
  summary: string;
  category: string;
  timeAgo: string;
  timestamp: string;
  source: string;
  url: string;
}

interface RssFetchResult {
  // false when the fetch/parse itself failed (network error, non-OK HTTP
  // status, thrown exception). A feed that fetched fine but genuinely had
  // zero qualifying items still reports ok: true - that isn't a failure.
  ok: boolean;
  items: NewsItem[];
}

async function fetchRss(url: string, sourceName: string, defaultCategory: string): Promise<RssFetchResult> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`RSS fetch non-OK for ${sourceName} (${url}): HTTP ${res.status}`);
      return { ok: false, items: [] };
    }
    const xml = await res.text();
    
    // Very basic XML parsing using Regex to avoid heavy Deno dependencies
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 10);

    const parsed = items.map(match => {
      const itemStr = match[1];
      
      // Handle CDATA or regular text
      const titleMatch = itemStr.match(/<title>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/title>/i) || itemStr.match(/<title>\s*([\s\S]*?)\s*<\/title>/i);
      const descMatch = itemStr.match(/<description>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/description>/i) || itemStr.match(/<description>\s*([\s\S]*?)\s*<\/description>/i);
      const dateMatch = itemStr.match(/<pubDate>\s*([\s\S]*?)\s*<\/pubDate>/i);
      // Article link: <link> text, or an atom <link href="..."/>. Only keep http(s).
      const linkMatch = itemStr.match(/<link>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/link>/i)
        || itemStr.match(/<link>\s*([\s\S]*?)\s*<\/link>/i)
        || itemStr.match(/<link[^>]*href=["']([^"']+)["']/i);
      const rawUrl = linkMatch ? linkMatch[1].trim() : "";
      const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : "";

      const title = titleMatch ? stripTags(titleMatch[1]).trim() : "Market Update";
      let summary = descMatch ? descMatch[1] : "Click to read more details about this market event.";

      // Decode basic HTML entities before stripping tags, so an entity-encoded
      // "<script>" can't survive the strip and reappear as a live tag. "&amp;"
      // is decoded last so a double-encoded entity isn't unescaped twice.
      summary = summary.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
      summary = stripTags(summary).trim();

      if (summary.length > 150) summary = summary.substring(0, 147) + "...";
      if (!summary) summary = title; // fallback

      let date = new Date();
      if (dateMatch) {
         date = new Date(dateMatch[1]);
      }
      
      // Calculate timeAgo
      const diffMs = new Date().getTime() - date.getTime();
      const diffHrs = diffMs / (1000 * 60 * 60);
      let timeAgo = "Just now";
      if (diffHrs < 1) {
         timeAgo = `${Math.floor(diffHrs * 60)}m ago`;
      } else if (diffHrs < 24) {
         timeAgo = `${Math.floor(diffHrs)}h ago`;
      } else {
         timeAgo = `${Math.floor(diffHrs / 24)}d ago`;
      }

      return {
        title,
        summary,
        category: defaultCategory,
        timeAgo,
        timestamp: date.toISOString(),
        source: sourceName,
        url
      };
    }).filter(i => i.title !== "Market Update");

    return { ok: true, items: parsed };
  } catch (e) {
    console.error("RSS Fetch Error for", url, e);
    return { ok: false, items: [] };
  }
}

// Round-robin interleave so no single source dominates the feed, then dedupe by title.
function interleave<T extends { title: string }>(groups: T[][], limit: number): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  const maxLen = Math.max(0, ...groups.map((g) => g.length));
  for (let i = 0; i < maxLen && out.length < limit; i++) {
    for (const g of groups) {
      const item = g[i];
      if (!item) continue;
      const key = item.title.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= limit) break;
    }
  }
  return out;
}

async function getLiveNews() {
  // Reputed Indian market-news sources (RSS). fetchRss fails soft -> { ok: false, items: [] }
  // on error, so an occasionally-down feed never breaks the response. But we
  // still track ok/failed counts below so a total outage across every source
  // is visible in the response instead of quietly presenting empty arrays as
  // a successful fetch.
  const results = await Promise.all([
    fetchRss("https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms", "Economic Times", "Markets"),
    fetchRss("https://www.moneycontrol.com/rss/MCtopnews.xml", "Moneycontrol", "Business"),
    fetchRss("https://www.business-standard.com/rss/markets-106.rss", "Business Standard", "Markets"),
    fetchRss("https://www.livemint.com/rss/markets", "LiveMint", "Markets"),
    fetchRss("https://www.financialexpress.com/market/feed/", "Financial Express", "Markets"),
    fetchRss("https://feeds.feedburner.com/ndtvprofit-latest", "NDTV Profit", "Markets"),
    fetchRss("https://www.zeebiz.com/rss/india.xml", "Zee Business", "Business"),
    // World
    fetchRss("https://search.cnbc.com/rs/search/combinedcms/view.xml?profile=120000000&id=10000664", "CNBC", "Global"),
    fetchRss("https://query2.finance.yahoo.com/v1/finance/rss/news", "Yahoo Finance", "Markets"),
  ]);
  const [
    etMarkets, moneyControl, businessStandard, liveMint, financialExpress, ndtvProfit, zeeBusiness,
    cnbcWorld, yahooFinance,
  ] = results;

  // Deep enough that the client's featured story + 9-card grid still leaves
  // stories behind the "Show more" button.
  const indian = interleave(
    [etMarkets, moneyControl, businessStandard, liveMint, financialExpress, ndtvProfit, zeeBusiness].map(r => r.items),
    24,
  );
  const world = interleave([cnbcWorld, yahooFinance].map(r => r.items), 14);

  const sourcesTotal = results.length;
  const sourcesOk = results.filter(r => r.ok).length;

  return { indian, world, sourcesTotal, sourcesOk };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const news = await getLiveNews();

    // Total failure: every single RSS source errored or returned non-OK.
    // Previously this still answered `success: true` with two empty arrays,
    // so a full outage of the news pipeline was indistinguishable from a
    // legitimately quiet news day - nobody would know to look. Callers that
    // check `success` and per-array length (MarketNews, LearningCenterPage)
    // already fall back to their own cached/fallback content on
    // success: false, so this doesn't regress the UI, it just makes the
    // outage visible in the response instead of only in a log nobody reads.
    const allSourcesFailed = news.sourcesOk === 0;

    if (allSourcesFailed) {
      console.error(`All ${news.sourcesTotal} news sources failed on this request.`);
    }

    return new Response(
      JSON.stringify({
        success: !allSourcesFailed,
        indian: news.indian,
        world: news.world,
        sourcesOk: news.sourcesOk,
        sourcesTotal: news.sourcesTotal,
        ...(allSourcesFailed ? { error: 'All news sources are currently unavailable' } : {}),
        fetchedAt: new Date().toISOString(),
      }),
      {
        status: allSourcesFailed ? 502 : 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to fetch live news' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
