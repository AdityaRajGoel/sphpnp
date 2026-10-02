import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import WhatsAppButton from "@/components/WhatsAppButton";
import PageTransition from "@/components/PageTransition";
import { Skeleton } from "@/components/ui/skeleton";
import { useScreenerUniverse } from "@/hooks/useScreenerUniverse";
import { Card } from "@/components/ui/card";
import { INDEX_NAMES, indexTitle, listSlug, loadIndexBoard, tally } from "@/lib/market-lists";
import { shortDate } from "@/lib/market-data";

const pct = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);
const tone = (v: number | null) => (v === null ? "text-muted-foreground" : v >= 0 ? "text-secondary" : "text-destructive");

/** /indices: every index and sector list page, so each is one click from a crawlable hub. */
export default function MarketListsHubPage() {
  const universe = useScreenerUniverse();
  const board = useQuery({ queryKey: ["index-board"], queryFn: loadIndexBoard, staleTime: 30 * 60_000 });
  const boardByName = useMemo(() => new Map((board.data ?? []).map((r) => [r.name, r])), [board.data]);
  const asOf = board.data?.[0]?.trade_date ?? null;
  const sectors = useMemo(
    () => tally([...(universe.data?.values() ?? [])], (r) => (r.quote?.sector === "General" ? null : r.quote?.sector)),
    [universe.data],
  );
  const crumbs = [{ name: "Home", url: "/" }, { name: "Indices & sectors" }];

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <SEOHead
          title="NSE Indices Today: Nifty 50, Bank, IT Levels, Returns & P/E"
          description="Closing levels, day and one-year change and P/E for 22 NSE indices, from the Nifty 50 to the Smallcap 250, with charts, constituents and sector lists."
          breadcrumbs={crumbs}
        />
        <Header />
        <VisibleBreadcrumbs items={crumbs} />
        <main className="container mx-auto px-4 py-8" data-list-state={universe.isLoading || board.isLoading ? "loading" : "ready"}>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">NSE indices today</h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed">
            Where 22 NSE indices closed, how far they moved on the day and over a year, and what they trade at. Open an index for its chart,
            returns from a week to two years, 52-week range, P/E history and every stock in it. Sector lists group the stocks we track by business.
          </p>

          <section aria-labelledby="indices" className="mt-8">
            <h2 id="indices" className="text-xl font-bold">NSE indices{asOf ? <span className="ml-2 text-sm font-normal text-muted-foreground">close of {shortDate(asOf)}</span> : null}</h2>
            <Card className="mt-3 overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted">
                      <th scope="col" className="sticky left-0 z-10 bg-muted p-3 text-left font-medium">Index</th>
                      <th scope="col" className="p-3 text-right font-medium">Close</th>
                      <th scope="col" className="p-3 text-right font-medium">Day</th>
                      <th scope="col" className="p-3 text-right font-medium">1 year</th>
                      <th scope="col" className="p-3 text-right font-medium">P/E</th>
                    </tr>
                  </thead>
                  <tbody>
                    {INDEX_NAMES.map((n) => {
                      const r = boardByName.get(n);
                      return (
                        <tr key={n} className="border-b last:border-0 hover:bg-muted/30">
                          <th scope="row" className="sticky left-0 z-10 bg-card p-3 text-left font-normal">
                            <Link to={`/indices/${listSlug(n)}`} className="font-medium hover:text-secondary hover:underline underline-offset-4">{indexTitle(n)}</Link>
                          </th>
                          {board.isLoading ? <td colSpan={4} className="p-3"><Skeleton className="h-4 w-full" /></td> : (
                            <>
                              <td className="p-3 text-right tabular-nums">{r?.close ? r.close.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}</td>
                              <td className={`p-3 text-right tabular-nums ${tone(r?.change_pct ?? null)}`}>{pct(r?.change_pct ?? null)}</td>
                              <td className={`p-3 text-right tabular-nums ${tone(r?.year_pct ?? null)}`}>{pct(r?.year_pct ?? null)}</td>
                              <td className="p-3 text-right tabular-nums">{r?.pe ? r.pe.toFixed(2) : "—"}</td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
            <p className="mt-2 text-xs text-muted-foreground">
              From NSE's daily index file, end of day. Also see <Link to="/commodities" className="underline underline-offset-4 hover:text-secondary">commodity prices</Link> and <Link to="/markets/gift-nifty" className="underline underline-offset-4 hover:text-secondary">GIFT Nifty</Link>.
            </p>
          </section>

          <section aria-labelledby="sectors" className="mt-10">
            <h2 id="sectors" className="text-xl font-bold">Sectors</h2>
            {universe.isLoading ? <Skeleton className="mt-3 h-40 w-full" /> : (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {sectors.map((s) => (
                  <li key={s.name}>
                    <Link to={`/sectors/${listSlug(s.name)}`} className="flex items-baseline justify-between rounded-md border px-3 py-2 font-medium hover:border-secondary/50 hover:text-secondary">
                      {s.name} stocks <span className="text-sm tabular-nums text-muted-foreground">{s.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
        <Footer />
        <WhatsAppButton />
      </div>
    </PageTransition>
  );
}
