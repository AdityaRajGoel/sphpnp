import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Briefcase, Download, Send, Star, Trash2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import PageTransition from "@/components/PageTransition";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DURATION, EASE_OUT, revealSection } from "@/lib/motion";
import { useWatchlist } from "@/hooks/useWatchlist";
import { supabase } from "@/integrations/supabase/client";
import { useScreenerUniverse } from "@/hooks/useScreenerUniverse";
import { displayMetric, METRIC_BY_ID, metricTone, type MetricRow } from "@/lib/screener-metrics";
import { buildChecklist, tally } from "@/lib/stock-checklist";
import { sectorPeers } from "@/lib/stock-peers";
import { csvCell, downloadText } from "@/lib/statement-csv";
import { IllustrationTile } from "@/components/ui/illustration";
import PageHeader, { HeaderStat } from "@/components/PageHeader";

const COLUMNS = ["price", "change_pct", "return_1m", "return_1y", "pe", "roe", "roce", "debt_to_equity", "rsi_14", "composite_score"];

const ROW_MOTION = {
  layout: true,
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: -24 },
  transition: { duration: DURATION.base, ease: EASE_OUT },
} as const;

const SUGGESTIONS = ["RELIANCE", "HDFCBANK", "TCS", "INFY", "ICICIBANK", "BHARTIARTL"];

export default function WatchlistPage() {
  const { watchlist, removeFromWatchlist, addToWatchlist } = useWatchlist();
  const { data: universe, isLoading } = useScreenerUniverse();
  const metrics = COLUMNS.map((id) => METRIC_BY_ID.get(id)!);

  const rows = useMemo(
    () =>
      watchlist.map((w) => {
        const row = universe?.get(w.symbol);
        const checks = row ? tally(buildChecklist(row, sectorPeers(universe, w.symbol)?.median.pe ?? null)) : null;
        return { item: w, row, checks };
      }),
    [watchlist, universe],
  );

  const summary = useMemo(() => {
    const moves = rows.map((r) => r.row?.quote?.change_pct).filter((v): v is number => typeof v === "number");
    return {
      up: moves.filter((v) => v > 0).length,
      down: moves.filter((v) => v < 0).length,
      avg: moves.length ? moves.reduce((a, b) => a + b, 0) / moves.length : null,
    };
  }, [rows]);

  const [telegram, setTelegram] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const linkTelegram = async () => {
    setTelegram({ busy: true, error: null });
    const { data, error } = await supabase.functions.invoke("telegram-link", { body: { symbols: watchlist.map((w) => w.symbol) } });
    if (error || !data?.url) {
      const message = (await (error as { context?: Response })?.context?.json?.().catch(() => null))?.error;
      setTelegram({ busy: false, error: message ?? "Could not create the Telegram link. Try again in a moment." });
      return;
    }
    setTelegram({ busy: false, error: null });
    window.open(data.url, "_blank", "noopener");
  };

  const exportCsv = () => {
    const header = ["Symbol", "Name", ...metrics.map((m) => m.label)].map(csvCell).join(",");
    const body = rows.map(({ item, row }) => [csvCell(item.symbol), csvCell(item.name), ...metrics.map((m) => csvCell(row ? m.get(row as MetricRow) : null))].join(","));
    downloadText([header, ...body].join("\r\n"), "watchlist.csv");
  };

  return (
    <PageTransition>
      <SEOHead title="My Watchlist | Shri Parasram Holdings" description="The stocks you follow, with prices, returns, valuation and quality in one table." noindex />
      <Header />
      <main className="container mx-auto max-w-6xl px-4 py-8">
        <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Stock Screener", url: "/screener" }, { name: "My Watchlist" }]} />

        <PageHeader
          className="mt-2"
          eyebrow={<><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" /> Your stocks</>}
          title="My Watchlist"
          description={watchlist.length === 0 ? "Follow stocks to see them side by side here." : "Prices, returns, valuation and quality for every stock you follow."}
        >
          <HeaderStat label="Following" value={watchlist.length} />
          {summary.avg !== null && (
            <>
              <HeaderStat label="Up / down today" value={`${summary.up} / ${summary.down}`} />
              <HeaderStat label="Average move" value={`${summary.avg >= 0 ? "+" : ""}${summary.avg.toFixed(2)}%`} />
            </>
          )}
          {watchlist.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportCsv} className="h-9">
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" /> Download CSV
            </Button>
          )}
          {watchlist.length > 0 && (
            <Button variant="outline" size="sm" onClick={linkTelegram} disabled={telegram.busy} className="h-9">
              <Send className="mr-1.5 h-4 w-4" aria-hidden="true" /> {telegram.busy ? "Creating link…" : "Alert me on Telegram"}
            </Button>
          )}
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link to="/portfolio"><Briefcase className="mr-1.5 h-4 w-4" aria-hidden="true" /> Check my portfolio</Link>
          </Button>
        </PageHeader>
        {telegram.error && <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm text-destructive">{telegram.error}</p>}

        {watchlist.length === 0 ? (
          <motion.div {...revealSection}>
            <Card className="mt-8 p-8 text-center">
              <IllustrationTile slug="art-candles" className="mx-auto h-36 w-36" sizes="144px" />
              <h2 className="mt-3 text-xl font-semibold">Your watchlist is empty</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Tap the star beside any stock in the screener, or Watch on a stock page. Or start with some of the largest companies:
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((sym) => (
                  <Button key={sym} variant="outline" size="sm" onClick={() => addToWatchlist(sym, universe?.get(sym)?.quote?.name ?? sym)}>
                    <Star className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> {sym}
                  </Button>
                ))}
              </div>
              <Link to="/screener" className="link-arrow mt-5 inline-flex text-sm font-semibold text-secondary">Browse the screener</Link>
            </Card>
          </motion.div>
        ) : (
          <Card className="mt-6 overflow-hidden p-0">
            {/* relative: the screen-reader-only header text is absolutely
                positioned, and without a positioned ancestor it escaped this
                scroller's clip and widened the whole page on a phone. */}
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <caption className="sr-only">Stocks in your watchlist</caption>
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th scope="col" className="sticky left-0 bg-muted/40 p-3 text-left font-medium">Stock</th>
                    {metrics.map((m) => <th key={m.id} scope="col" title={m.title} className="whitespace-nowrap p-3 text-right font-medium">{m.label}</th>)}
                    <th scope="col" className="p-3 text-center font-medium">Checklist</th>
                    <th scope="col" className="p-3"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {rows.map(({ item, row, checks }) => (
                      <motion.tr key={item.symbol} {...ROW_MOTION} className="border-b last:border-0 hover:bg-muted/30">
                        <th scope="row" className="sticky left-0 bg-card p-3 text-left font-normal">
                          <Link to={`/stock/${encodeURIComponent(item.symbol)}`} className="group block">
                            <span className="font-semibold group-hover:text-secondary">{item.symbol}</span>
                            <span className="block max-w-[14rem] truncate text-xs text-muted-foreground">{item.name}</span>
                          </Link>
                        </th>
                        {metrics.map((m) => {
                          if (!row) return <td key={m.id} className="p-3 text-right">{isLoading ? <Skeleton className="ml-auto h-4 w-12" /> : <span className="text-muted-foreground">—</span>}</td>;
                          const tone = m.id === "change_pct" || m.id.startsWith("return_") ? metricTone(m, m.get(row)) : null;
                          return (
                            <td key={m.id} className={`whitespace-nowrap p-3 text-right tabular-nums ${tone === "up" ? "text-secondary" : tone === "down" ? "text-destructive" : ""}`}>
                              {displayMetric(m, row)}
                            </td>
                          );
                        })}
                        <td className="p-3">
                          {checks && checks.pass + checks.neutral + checks.fail > 0 ? (
                            <div className="mx-auto flex h-2 w-24 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${checks.pass} strengths, ${checks.neutral} neutral, ${checks.fail} weaknesses`} title={`${checks.pass} strengths · ${checks.neutral} neutral · ${checks.fail} weaknesses`}>
                              <span className="bg-secondary" style={{ flexGrow: checks.pass }} />
                              <span className="bg-muted-foreground/40" style={{ flexGrow: checks.neutral }} />
                              <span className="bg-destructive" style={{ flexGrow: checks.fail }} />
                            </div>
                          ) : <span className="block text-center text-muted-foreground">—</span>}
                        </td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeFromWatchlist(item.symbol)} aria-label={`Remove ${item.name} from watchlist`}>
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </Card>
        )}
        <p className="mt-3 text-xs text-muted-foreground">Saved in this browser only, up to 50 stocks. Figures describe the latest session and filings; not investment advice.</p>
      </main>
      <Footer />
    </PageTransition>
  );
}
