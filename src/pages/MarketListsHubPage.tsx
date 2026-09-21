import { useMemo } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import WhatsAppButton from "@/components/WhatsAppButton";
import PageTransition from "@/components/PageTransition";
import { Skeleton } from "@/components/ui/skeleton";
import { useScreenerUniverse } from "@/hooks/useScreenerUniverse";
import { INDEX_NAMES, indexTitle, listSlug, tally } from "@/lib/market-lists";

/** /indices: every index and sector list page, so each is one click from a crawlable hub. */
export default function MarketListsHubPage() {
  const universe = useScreenerUniverse();
  const sectors = useMemo(
    () => tally([...(universe.data?.values() ?? [])], (r) => (r.quote?.sector === "General" ? null : r.quote?.sector)),
    [universe.data],
  );
  const crumbs = [{ name: "Home", url: "/" }, { name: "Indices & sectors" }];

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <SEOHead
          title="NSE Indices & Sector Stock Lists: Nifty 50, Bank, IT"
          description="Constituent lists for 22 NSE indices, from the Nifty 50 to the Nifty Smallcap 250, and stock lists for every sector we track, with P/E, market cap and ROE."
          breadcrumbs={crumbs}
        />
        <Header />
        <VisibleBreadcrumbs items={crumbs} />
        <main className="container mx-auto px-4 py-8" data-list-state={universe.isLoading ? "loading" : "ready"}>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">NSE indices and sector stock lists</h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed">
            Pick an index to see every stock in it, with its price, market cap, P/E, P/B and return on equity, plus the index's own P/E and
            dividend yield. Sector lists group the stocks we track by business.
          </p>

          <section aria-labelledby="indices" className="mt-8">
            <h2 id="indices" className="text-xl font-bold">NSE indices</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {INDEX_NAMES.map((n) => (
                <li key={n}><Link to={`/indices/${listSlug(n)}`} className="block rounded-md border px-3 py-2 font-medium hover:border-secondary/50 hover:text-secondary">{indexTitle(n)} stocks</Link></li>
              ))}
            </ul>
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
