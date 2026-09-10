import { hasFeedItems, parseFeedDate } from "../_shared/rss.ts";

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
  /** Publisher name, carried so a failure can be reported by name, not by index. */
  name: string;
  /** Why this source failed, present only when ok is false. */
  reason?: string;
}

async function fetchRss(url: string, sourceName: string, defaultCategory: string): Promise<RssFetchResult> {
  try {
    // A bare Deno fetch sends no User-Agent, and several Indian publishers 403
    // that outright from Supabase's egress IPs while serving the same feed to a
    // browser. Same reasoning as the UA already sent to NSE (_shared/nse.ts) and
    // Yahoo (_shared/yahoo.ts); Accept is included because a few feeds
    // content-negotiate to an HTML page when it is absent.
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept": "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
      },
    });
    if (!res.ok) {
      console.error(`RSS fetch non-OK for ${sourceName} (${url}): HTTP ${res.status}`);
      return { ok: false, items: [], name: sourceName, reason: `HTTP ${res.status}` };
    }
    const xml = await res.text();

    // fetch() follows redirects, so a feed URL that now 301s to an HTML page
    // still lands here with res.ok === true and an HTML body. Without this
    // check that body just yields zero <item> matches below and reports
    // ok: true with an empty feed - indistinguishable from a quiet news day.
    // See hasFeedItems for the full rationale.
    if (!hasFeedItems(xml)) {
      console.error(`RSS body for ${sourceName} (${url}) has no <item>/<entry> - feed likely redirected off RSS`);
      return { ok: false, items: [], name: sourceName, reason: "200 but no <item>/<entry>" };
    }

    // Very basic XML parsing using Regex to avoid heavy Deno dependencies
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 10);

    const parsed = items.map(match => {
      const itemStr = match[1];
      
      // Handle CDATA or regular text
      const titleMatch = itemStr.match(/<title>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/title>/i) || itemStr.match(/<title>\s*([\s\S]*?)\s*<\/title>/i);
      const descMatch = itemStr.match(/<description>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/description>/i) || itemStr.match(/<description>\s*([\s\S]*?)\s*<\/description>/i);
      // CDATA-aware, like title/description above. Without the first branch the
      // regex captured the literal "<![CDATA[Thu, 10 Sep 2026 ...]]>" string,
      // new Date() could not parse it, and parseFeedDate fell back to "now" -
      // so every item from LiveMint, BusinessLine and NDTV Profit (which all
      // wrap pubDate in CDATA) was stamped with the fetch instant and wrongly
      // flagged as breaking news by the "New" badge.
      const dateMatch = itemStr.match(/<pubDate>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/pubDate>/i)
        || itemStr.match(/<pubDate>\s*([\s\S]*?)\s*<\/pubDate>/i);
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

      // Never construct this with a bare `new Date(raw)` again: an unparseable
      // pubDate makes `date.toISOString()` below throw, which used to take the
      // entire feed down with it. See parseFeedDate.
      const date = parseFeedDate(dateMatch ? dateMatch[1] : null);

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

    return { ok: true, items: parsed, name: sourceName };
  } catch (e) {
    console.error("RSS Fetch Error for", url, e);
    return {
      ok: false,
      items: [],
      name: sourceName,
      reason: e instanceof Error ? e.message.slice(0, 80) : "network error",
    };
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
    // Moneycontrol's MCtopnews.xml is DELIBERATELY not here. It still returns
    // HTTP 200 and well-formed RSS with real <item> tags, so every health check
    // passes - but its lastBuildDate and every pubDate are frozen at
    // 2016-10-05. It was feeding decade-old stories into the live feed, which
    // is where the "3627d ago" cards came from. A stale mirror is worse than a
    // dead feed: it looks healthy. Restore it only if the URL starts serving
    // current items again.
    fetchRss("https://www.business-standard.com/rss/markets-106.rss", "Business Standard", "Markets"),
    fetchRss("https://www.livemint.com/rss/markets", "LiveMint", "Markets"),
    // financialexpress.com/market/feed/ now 301s to /market/ (an HTML page) and
    // returned HTTP 200 with no <item> in it - swapped for a probed-working feed.
    fetchRss("https://www.thehindubusinessline.com/markets/feeder/default.rss", "BusinessLine", "Markets"),
    fetchRss("https://feeds.feedburner.com/ndtvprofit-latest", "NDTV Profit", "Markets"),
    // zeebiz.com/rss/india.xml (and every other zeebiz.com/*/rss path probed)
    // now answers 403 - swapped for a probed-working feed.
    fetchRss("https://www.businesstoday.in/rss/latest.xml", "Business Today", "Business"),
    // World
    // search.cnbc.com/... now answers 503 - same CNBC "Finance" category (id
    // 10000664), different still-live endpoint.
    fetchRss("https://www.cnbc.com/id/10000664/device/rss/rss.html", "CNBC", "Global"),
    // query2.finance.yahoo.com/... now answers 429 (rate-limited) - swapped for
    // Yahoo's own front-end RSS index, which isn't gated the same way.
    fetchRss("https://finance.yahoo.com/news/rssindex", "Yahoo Finance", "Markets"),
  ]);
  /*
   * Looked up BY NAME, not by position.
   *
   * This was a positional destructure, so removing a single feed from the array
   * above shifted every name after it by one and left the last binding
   * undefined - a 500 on the very next call. Feeds get added and dropped here
   * routinely (four URLs in this file have already rotted and been swapped), so
   * the list must be safe to edit. Same failure this codebase hit in the IPO
   * parser, which read table columns by index until the columns moved.
   */
  const by = (name: string) => results.find((r) => r.name === name)?.items ?? [];

  const INDIAN_SOURCES = [
    "Economic Times", "Business Standard", "LiveMint",
    "BusinessLine", "NDTV Profit", "Business Today",
  ];
  const WORLD_SOURCES = ["CNBC", "Yahoo Finance"];

  // Deep enough that the client's featured story + 9-card grid still leaves
  // stories behind the "Show more" button.
  const indian = interleave(INDIAN_SOURCES.map(by), 24);
  const world = interleave(WORLD_SOURCES.map(by), 14);

  const sourcesTotal = results.length;
  const sourcesOk = results.filter(r => r.ok).length;
  // By name and reason, not just a count. A bare "3 of 9" cannot tell you
  // whether one publisher rotated a URL or whether the whole egress IP is
  // being throttled, and those need different responses.
  const failedSources = results
    .filter(r => !r.ok)
    .map(r => ({ name: r.name, reason: r.reason ?? "unknown" }));

  return { indian, world, sourcesTotal, sourcesOk, failedSources };
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

    // Fewer than half the sources answering is a real outage, not a quiet news
    // day - the first measurement from the deployed function found 3 of 9,
    // because Supabase's egress IPs are throttled by publishers that answer a
    // laptop fine. `allSourcesFailed` cannot see that: it only trips at zero.
    //
    // Deliberately NOT folded into `success`. Both callers (MarketNews,
    // LearningCenterPage) gate rendering on `data?.success` and fall back to
    // hardcoded copy when it is false, so degrading `success` here would throw
    // away the articles the working sources DID return and show staler content
    // than we already have. The degradation is surfaced as its own field and
    // logged instead, so it is visible to monitoring without being paid for by
    // the reader.
    const degraded = !allSourcesFailed && news.sourcesOk * 2 < news.sourcesTotal;

    if (allSourcesFailed) {
      console.error(`All ${news.sourcesTotal} news sources failed on this request.`);
    } else if (degraded) {
      console.error(
        `News degraded: only ${news.sourcesOk}/${news.sourcesTotal} sources answered. ` +
          `Failed: ${news.failedSources.map(f => `${f.name} (${f.reason})`).join(", ")}`,
      );
    }

    return new Response(
      JSON.stringify({
        success: !allSourcesFailed,
        degraded,
        indian: news.indian,
        world: news.world,
        sourcesOk: news.sourcesOk,
        sourcesTotal: news.sourcesTotal,
        failedSources: news.failedSources,
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
