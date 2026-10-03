import { lazy, Suspense, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import WhatsAppButton from "@/components/WhatsAppButton";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import FAQ from "@/components/FAQ";
import NotFound from "@/pages/NotFound";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { loadEodHistory, loadSecurity, summarise } from "@/lib/lite-stock";
import { trailingReturns } from "@/lib/index-performance";
import { useStockStatements } from "@/hooks/useStockStatements";
import { shortDate } from "@/lib/market-data";

// recharts only for visitors who reach the chart; the page itself is small.
const LiteStockChart = lazy(() => import("@/components/stock/LiteStockChart"));
const StatementsSection = lazy(() => import("@/components/stock/StatementsSection"));

const rupees = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`);
const tone = (v: number | null | undefined) => (!v ? "text-muted-foreground" : v > 0 ? "text-secondary" : "text-destructive");
const count = (v: number | null | undefined) => (v === null || v === undefined ? "—" : Math.round(v).toLocaleString("en-IN"));

/**
 * /stock/:symbol for NSE stocks outside the screener universe: the price,
 * the day, the year's range and returns, delivery and volume, and the listing
 * facts, all from NSE's own files. No financial statements - those are kept
 * for the 750 stocks in the screener, which get the full page.
 */
export default function LiteStockPage({ symbol }: { symbol: string }) {
  const security = useQuery({ queryKey: ["nse-security", symbol], queryFn: () => loadSecurity(symbol), staleTime: 24 * 60 * 60_000 });
  const history = useQuery({ queryKey: ["eod-history", symbol], queryFn: () => loadEodHistory(symbol), staleTime: 60 * 60_000 });
  const bars = useMemo(() => history.data ?? [], [history.data]);
  const s = useMemo(() => summarise(bars), [bars]);
  const returns = useMemo(() => trailingReturns(bars), [bars]);
  // Financials arrive as the screener.in pass reaches this stock; shown when they exist.
  const st = useStockStatements(symbol);
  const hasStatements = Object.keys(st.statements).length > 0;

  const loading = security.isLoading || history.isLoading || st.loading;
  if (!loading && (!security.data || !s)) return <NotFound />;

  const sec = security.data;
  const name = sec?.name ?? symbol;
  // "Limited" adds nine characters to every title and no meaning; the page keeps the full name.
  const shortName = name.replace(/\s+(limited|ltd\.?)$/i, "");
  const crumbs = [{ name: "Home", url: "/" }, { name: "Stocks", url: "/screener" }, { name: `${name} (${symbol})` }];
  const position = s && s.high52 > s.low52 ? ((s.last.close - s.low52) / (s.high52 - s.low52)) * 100 : null;
  const faq = s ? [
    { q: `What is the ${name} share price today?`, a: `${name} (NSE: ${symbol}) closed at ${rupees(s.last.close)} on ${shortDate(s.last.trade_date)}, ${pct(s.changePct)} on the day, from NSE's daily bhavcopy.` },
    { q: `What is the 52-week high and low of ${symbol}?`, a: `Over the last year ${symbol} traded between ${rupees(s.low52)} and ${rupees(s.high52)} on NSE.` },
    { q: `How do I buy ${name} shares?`, a: `Open a Demat and trading account with Parasram and buy ${symbol} on NSE through the trading app, the web terminal or by calling the Panipat branch.` },
  ] : [];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`${shortName} (${symbol}) Share Price Today`}
        description={`${name} (NSE: ${symbol}) share price, day range, 52-week high and low, returns, delivery percentage and listing details, from NSE's daily data.`}
        breadcrumbs={crumbs}
        faqItems={faq.map((f) => ({ question: f.q, answer: f.a }))}
      />
      <Header />
      <VisibleBreadcrumbs items={crumbs} />
      <main className="container mx-auto max-w-5xl px-4 py-8">
        {loading || !s || !sec ? <Skeleton className="h-96 w-full" /> : (
          <div className="space-y-8" data-stock-state="lite">
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{symbol}</Badge>
                  <Badge variant="outline">{sec.board === "sme" ? "NSE Emerge (SME)" : "NSE"} · {sec.series}</Badge>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold tabular-nums">{rupees(s.last.close)}</div>
                <div className={`text-sm font-semibold tabular-nums ${tone(s.changePct)}`}>{s.change !== null ? `${s.change > 0 ? "+" : ""}${s.change.toFixed(2)} ` : ""}({pct(s.changePct)})</div>
                <div className="text-xs text-muted-foreground">Close, {shortDate(s.last.trade_date)}</div>
              </div>
            </header>

            <section aria-labelledby="day" className="grid gap-4 md:grid-cols-3">
              <h2 id="day" className="sr-only">The day and the year</h2>
              <Card className="p-5 md:col-span-2">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                  <div><dt className="text-xs text-muted-foreground">Open</dt><dd className="font-semibold tabular-nums">{rupees(s.last.open)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Day range</dt><dd className="font-semibold tabular-nums">{rupees(s.last.low)} – {rupees(s.last.high)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Previous close</dt><dd className="font-semibold tabular-nums">{rupees(s.last.prev_close)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Volume</dt><dd className="font-semibold tabular-nums">{count(s.last.volume)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Delivery</dt><dd className="font-semibold tabular-nums">{s.last.deliv_pct !== null ? `${s.last.deliv_pct.toFixed(1)}%` : "—"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Turnover</dt><dd className="font-semibold tabular-nums">{s.last.turnover_lacs !== null ? `₹${(s.last.turnover_lacs / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr` : "—"}</dd></div>
                </dl>
                <div className="mt-5 border-t pt-4">
                  <div className="flex justify-between text-xs text-muted-foreground"><span>52-week low {rupees(s.low52)}</span><span>52-week high {rupees(s.high52)}</span></div>
                  <div className="relative mt-2 h-2 rounded-full bg-muted" role="img" aria-label={position !== null ? `Price at ${position.toFixed(0)}% of its 52-week range` : "52-week range"}>
                    {position !== null && <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-secondary" style={{ left: `${position}%` }} />}
                  </div>
                </div>
              </Card>
              <Card className="p-5">
                <h3 className="text-sm font-semibold">Trading pattern, 20 sessions</h3>
                <dl className="mt-3 space-y-2.5 text-sm">
                  <div className="flex justify-between"><dt className="text-muted-foreground">Average delivery</dt><dd className="font-semibold tabular-nums">{s.avgDelivery20 !== null ? `${s.avgDelivery20.toFixed(1)}%` : "—"}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Average volume</dt><dd className="font-semibold tabular-nums">{count(s.avgVolume20)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Today vs average</dt><dd className="font-semibold tabular-nums">{s.volumeVsAvg !== null ? `${s.volumeVsAvg.toFixed(1)}×` : "—"}</dd></div>
                </dl>
                <p className="mt-3 text-xs text-muted-foreground">Delivery is the share of traded quantity settled by delivery rather than squared off the same day.</p>
              </Card>
            </section>

            <section aria-labelledby="chart" className="space-y-3">
              <h2 id="chart" className="text-xl font-bold">Price over the last year</h2>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {returns.map((r) => (
                  <div key={r.key} className="rounded-lg border bg-card px-3 py-2 text-center">
                    <div className="text-[11px] text-muted-foreground">{r.label}</div>
                    <div className={`text-sm font-semibold tabular-nums ${tone(r.pct)}`}>{pct(r.pct)}</div>
                  </div>
                ))}
              </div>
              <Card className="min-w-0 p-4">
                <Suspense fallback={<Skeleton className="h-64 w-full" />}><LiteStockChart bars={bars} /></Suspense>
              </Card>
            </section>

            {hasStatements && (
              <section aria-labelledby="financials">
                <h2 id="financials" className="mb-3 text-xl font-bold">Financials</h2>
                <Suspense fallback={<Skeleton className="h-64 w-full" />}><StatementsSection statements={st.statements} symbol={symbol} /></Suspense>
              </section>
            )}

            <section aria-labelledby="listing" className="grid gap-4 md:grid-cols-2">
              <Card className="p-5">
                <h2 id="listing" className="font-semibold">Listing details</h2>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-xs text-muted-foreground">Listed on NSE</dt><dd className="font-medium">{sec.listing_date ? shortDate(sec.listing_date) : "—"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">ISIN</dt><dd className="font-mono text-xs font-medium">{sec.isin ?? "—"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Face value</dt><dd className="font-medium">{sec.face_value !== null ? `₹${sec.face_value}` : "—"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Board and series</dt><dd className="font-medium">{sec.board === "sme" ? "SME" : "Main board"} · {sec.series}</dd></div>
                </dl>
                <a href={`https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(symbol)}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-secondary hover:underline underline-offset-4">Live quote on NSE <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></a>
              </Card>
              <Card className="p-5">
                <h2 className="font-semibold">Trade {symbol} with Parasram</h2>
                <p className="mt-2 text-sm text-muted-foreground">Buy and sell {name} on NSE from one Demat account, with brokerage published up front and a branch in Panipat to call.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to="/open-account" className="inline-flex min-h-[44px] items-center rounded-lg bg-secondary px-4 text-sm font-semibold text-secondary-foreground hover:bg-secondary/90">Open a Demat account</Link>
                  <Link to="/screener" className="inline-flex min-h-[44px] items-center rounded-lg border px-4 text-sm font-semibold hover:border-secondary hover:text-secondary">Research 750 stocks</Link>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{hasStatements ? "Financials from company filings via screener.in; research profiles are kept for the 750 stocks in the screener." : "Financials appear here as our data pass reaches this company; research profiles are kept for the 750 stocks in the screener."}</p>
              </Card>
            </section>

            <p className="text-xs text-muted-foreground">End-of-day figures from NSE's bhavcopy with delivery data and NSE's list of listed securities. Market data, not investment advice.</p>
          </div>
        )}
      </main>
      {faq.length > 0 && <FAQ title={`${name}: common questions`} subtitle="Answered from the figures on this page." items={faq} />}
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
