import { supabase } from "@/integrations/supabase/client";

export type StockNewsItem = { title: string; source: string; url: string; published_at: string };
export type StockNews = { items: StockNewsItem[]; fetched_at: string | null };

/** How long a cached copy is served before the page asks for a fresh one. */
export const NEWS_FRESH_MS = 2 * 60 * 60 * 1000;

const table = () => supabase.from("stock_news" as never) as ReturnType<typeof supabase.from>;

/** Whether a cached copy needs refreshing: absent, or older than two hours. */
export const isStale = (fetchedAt: string | null, now = Date.now()) =>
  !fetchedAt || Number.isNaN(Date.parse(fetchedAt)) || now - Date.parse(fetchedAt) >= NEWS_FRESH_MS;

/** "3h ago", "2d ago" - the age of a story at a glance. */
export function relativeTime(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Only links this page is willing to open: https, nothing else. */
export const safeHref = (url: string) => (/^https:\/\//i.test(url) ? url : undefined);

/**
 * The stock's recent news: the cached copy first, then - if that is missing or
 * stale - a fresh fetch through the stock-news function. A headless browser
 * (the build's prerender) only reads the cache, so a build never fans out
 * hundreds of searches.
 */
export async function loadStockNews(symbol: string, allowFetch: boolean): Promise<StockNews> {
  const { data, error } = await table().select("items,fetched_at").eq("symbol", symbol).maybeSingle();
  if (error) throw new Error(error.message);
  const cached: StockNews = { items: ((data as StockNews | null)?.items ?? []), fetched_at: (data as StockNews | null)?.fetched_at ?? null };
  if (!allowFetch || !isStale(cached.fetched_at)) return cached;

  const { data: fresh, error: fnError } = await supabase.functions.invoke("stock-news", { body: { symbol } });
  if (fnError || !fresh || !Array.isArray((fresh as StockNews).items)) return cached;
  return { items: (fresh as StockNews).items, fetched_at: (fresh as StockNews).fetched_at ?? null };
}
