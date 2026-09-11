import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ExternalLink, Newspaper } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { revealItem, revealSection } from "@/lib/motion";
import { loadStockNews, relativeTime, safeHref, type StockNews as News } from "@/lib/stock-news";

type Props = { symbol: string; name: string };

/** Recent coverage of this stock from Google News, newest first, each linking to the publisher's story. */
export default function StockNews({ symbol, name }: Props) {
  const [news, setNews] = useState<News | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setNews(null);
    setFailed(false);
    const headless = typeof navigator !== "undefined" && navigator.webdriver === true;
    loadStockNews(symbol, !headless)
      .then((n) => { if (!cancelled) setNews(n); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [symbol]);

  if (failed || (news && news.items.length === 0)) return null;

  return (
    <motion.section {...revealSection} aria-labelledby="stock-news-heading">
      <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
        <h2 id="stock-news-heading" className="text-2xl font-bold flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-brand-orange" aria-hidden="true" /> Latest news
        </h2>
        {news?.fetched_at && (
          <span className="text-xs text-muted-foreground">Google News · updated {relativeTime(news.fetched_at)}</span>
        )}
      </div>
      {!news ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {news.items.map((item, i) => {
            const href = safeHref(item.url);
            return (
              <motion.li key={item.url} {...revealItem(i)}>
                <Card className="h-full p-4 transition-colors hover:border-primary/50 group">
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="flex h-full flex-col gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="font-medium leading-snug group-hover:text-primary transition-colors line-clamp-3">{item.title}</span>
                    <span className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground/70">{item.source || "News"}</span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={item.published_at}>{relativeTime(item.published_at)}</time>
                      <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                    </span>
                  </a>
                </Card>
              </motion.li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Headlines about {name} from the last two weeks, gathered by Google News. Stories belong to their publishers; Parasram India does not endorse them.
      </p>
    </motion.section>
  );
}
