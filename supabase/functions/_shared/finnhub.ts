// Finnhub market news (GET /api/v1/news?category=general). The free plan is US
// and global only - no NSE quotes or Indian company news - so it feeds the
// World news column, not anything India-specific. 60 calls a minute; over that
// it answers 429.
//
// Pure: no fetch.

export type FinnhubNewsItem = {
  title: string;
  summary: string;
  category: string;
  timeAgo: string;
  timestamp: string;
  source: string;
  url: string;
};

export const FINNHUB_NEWS_URL = "https://finnhub.io/api/v1/news?category=general";

function timeAgo(ms: number): string {
  const hrs = ms / 3_600_000;
  if (hrs < 1) return `${Math.max(0, Math.floor(hrs * 60))}m ago`;
  if (hrs < 24) return `${Math.floor(hrs)}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Finnhub's array of stories, newest first; `datetime` is unix seconds. A story without a headline, http(s) link or time is dropped. */
export function parseFinnhubNews(raw: unknown, now = Date.now(), limit = 12): FinnhubNewsItem[] {
  if (!Array.isArray(raw)) return [];
  const out: FinnhubNewsItem[] = [];
  for (const r of raw) {
    const { headline, summary, datetime, source, url } = (r ?? {}) as Record<string, unknown>;
    if (typeof headline !== "string" || !headline.trim()) continue;
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) continue;
    if (typeof datetime !== "number" || !Number.isFinite(datetime) || datetime <= 0) continue;
    const at = datetime * 1000;
    const text = typeof summary === "string" && summary.trim() ? summary.trim() : headline.trim();
    out.push({
      title: headline.trim(),
      summary: text.length > 150 ? `${text.slice(0, 147)}...` : text,
      category: "Global",
      timeAgo: timeAgo(now - at),
      timestamp: new Date(at).toISOString(),
      // The publisher (Reuters, CNBC, MarketWatch...), not "Finnhub".
      source: typeof source === "string" && source.trim() ? source.trim() : "Finnhub",
      url,
    });
    if (out.length >= limit) break;
  }
  return out;
}
