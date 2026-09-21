import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import WhatsAppButton from "@/components/WhatsAppButton";
import PageTransition from "@/components/PageTransition";
import FAQ from "@/components/FAQ";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import NotFound from "@/pages/NotFound";
import { useScreenerUniverse } from "@/hooks/useScreenerUniverse";
import { displayMetric, formatMetric, METRIC_BY_ID, type MetricRow } from "@/lib/screener-metrics";
import { median } from "@/lib/stock-peers";
import { INDEX_NAMES, indexBySlug, indexTitle, listSlug, loadConstituents, loadIndexValuation, tally } from "@/lib/market-lists";

const COLUMNS = ["price", "market_cap", "pe", "pb", "roe", "sales_growth_yoy"].map((id) => METRIC_BY_ID.get(id)!);
const BASE = "https://www.sphpnp.com";

type Row = { symbol: string; name: string; industry: string | null; metrics: MetricRow | undefined };

const fmtDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const cap = (r: Row) => r.metrics?.quote?.market_cap ?? 0;
/** Meta descriptions stop near 160 characters; cut at a word, not mid-word. */
const clip = (text: string, max = 158) => (text.length <= max ? text : `${text.slice(0, text.lastIndexOf(" ", max))}…`);
const listNames = (names: string[]) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

/**
 * One page per NSE index (/indices/:slug) and per tracked sector
 * (/sectors/:slug): the constituents with their figures, an answer-first
 * summary and FAQ written from those figures. Answers the "nifty 50 stocks
 * list" and "banking stocks in India" searches and links every tracked name to
 * its stock page. Marked data-list-state="ready" for scripts/prerender.js.
 */
export default function MarketListPage({ kind }: { kind: "index" | "sector" }) {
  const { slug } = useParams<{ slug: string }>();
  const universe = useScreenerUniverse();
  const indexName = kind === "index" ? indexBySlug(slug) : null;

  const constituents = useQuery({
    queryKey: ["index-constituents", indexName],
    queryFn: () => loadConstituents(indexName!),
    enabled: indexName !== null,
    staleTime: 60 * 60_000,
  });
  const valuation = useQuery({
    queryKey: ["index-valuation", indexName],
    queryFn: () => loadIndexValuation(indexName!),
    enabled: indexName !== null,
    staleTime: 60 * 60_000,
  });

  const sectorName = useMemo(() => {
    if (kind !== "sector" || !universe.data) return null;
    for (const r of universe.data.values()) {
      const s = r.quote?.sector;
      if (s && s !== "General" && listSlug(s) === slug) return s;
    }
    return null;
  }, [kind, universe.data, slug]);

  const rows: Row[] = useMemo(() => {
    const u = universe.data;
    const list: Row[] = kind === "index"
      ? (constituents.data ?? []).map((c) => ({ symbol: c.symbol, name: u?.get(c.symbol)?.quote?.name ?? c.company ?? c.symbol, industry: c.industry, metrics: u?.get(c.symbol) }))
      : [...(u?.values() ?? [])].filter((r) => r.quote?.sector === sectorName).map((r) => ({ symbol: r.symbol, name: r.quote?.name ?? r.symbol, industry: sectorName, metrics: r }));
    return list.sort((a, b) => cap(b) - cap(a) || a.name.localeCompare(b.name));
  }, [kind, constituents.data, universe.data, sectorName]);

  const loading = universe.isLoading || constituents.isLoading || valuation.isLoading;
  if (kind === "index" && !indexName) return <NotFound />;
  if (kind === "sector" && !loading && !sectorName) return <NotFound />;

  const title = kind === "index" ? indexTitle(indexName!) : `${sectorName ?? ""} stocks`;
  const heading = kind === "index" ? `${title} stocks: list of all ${rows.length || ""} companies` : `${sectorName} stocks in India: ${rows.length} NSE companies`;
  const asOf = kind === "index" ? constituents.data?.[0]?.as_of : null;
  const leaders = rows.filter((r) => cap(r) > 0).slice(0, 3).map((r) => r.name);
  const industries = kind === "index" ? tally(rows, (r) => r.industry) : [];
  const v = valuation.data;
  const metricOf = (id: string) => rows.map((r) => (r.metrics ? METRIC_BY_ID.get(id)!.get(r.metrics) : null));
  // Only a positive P/E is a multiple, the same rule as the peer medians.
  const medPe = median(metricOf("pe").filter((x) => x !== null && x > 0));
  const medRoe = median(metricOf("roe"));

  const answer = kind === "index"
    ? [
        `The ${title} has ${rows.length} stocks${asOf ? ` as of ${fmtDate(asOf)}` : ""}.`,
        v?.close ? `It closed at ${v.close.toLocaleString("en-IN")} on ${fmtDate(v.trade_date)}${v.pe ? `, at a P/E of ${v.pe.toFixed(2)}` : ""}${v.pb ? `, P/B of ${v.pb.toFixed(2)}` : ""}${v.div_yield ? ` and a dividend yield of ${v.div_yield.toFixed(2)}%` : ""}.` : "",
        leaders.length ? `The largest by market capitalisation are ${listNames(leaders)}.` : "",
        industries.length > 1 ? `${industries[0].name} is its biggest industry, with ${industries[0].count} of the ${rows.length} stocks.` : "",
      ].filter(Boolean).join(" ")
    : [
        `We track ${rows.length} ${sectorName} stocks listed on NSE.`,
        leaders.length ? `The largest by market capitalisation are ${listNames(leaders)}.` : "",
        medPe !== null ? `Their median P/E is ${medPe.toFixed(1)}${medRoe !== null ? ` and median return on equity ${medRoe.toFixed(1)}%` : ""}.` : "",
      ].filter(Boolean).join(" ");

  const faq = rows.length === 0 ? [] : [
    kind === "index"
      ? { q: `How many stocks are in the ${title}?`, a: `${rows.length} stocks${asOf ? `, per the constituent list NSE Indices published for ${fmtDate(asOf)}` : ""}. The list is reviewed twice a year, so names change.` }
      : { q: `How many ${sectorName} stocks are listed on NSE?`, a: `This page covers the ${rows.length} ${sectorName} companies in the universe we track, not every listed company in the sector.` },
    ...(leaders.length ? [{ q: `Which are the largest ${kind === "index" ? `${title} stocks` : `${sectorName} companies`}?`, a: `By market capitalisation: ${listNames(leaders)}.` }] : []),
    ...(kind === "index" && v?.pe ? [{ q: `What is the P/E ratio of the ${title}?`, a: `${v.pe.toFixed(2)} on ${fmtDate(v.trade_date)}, from NSE's daily index data${v.pb ? `, with a P/B of ${v.pb.toFixed(2)}` : ""}.` }] : []),
    ...(kind === "sector" && medPe !== null ? [{ q: `What is the average P/E of ${sectorName} stocks?`, a: `The median P/E across the ${rows.length} tracked ${sectorName} stocks is ${medPe.toFixed(1)}, counting profitable companies only.` }] : []),
    ...(industries.length > 1 ? [{ q: `Which industries make up the ${title}?`, a: industries.slice(0, 5).map((i) => `${i.name} (${i.count})`).join(", ") + "." }] : []),
  ];

  const crumbs = [{ name: "Home", url: "/" }, { name: "Indices & sectors", url: "/indices" }, { name: title }];

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <SEOHead
          title={kind === "index" ? `${title} Stocks List ${new Date().getFullYear()}: ${rows.length || ""} Companies` : `${sectorName ?? "Sector"} Stocks in India: List, P/E, Market Cap`}
          description={clip(answer) || `Constituents of the ${title} with price, market cap, P/E, P/B and ROE.`}
          breadcrumbs={crumbs}
          faqItems={faq.map((f) => ({ question: f.q, answer: f.a }))}
          dateModified={asOf ?? v?.trade_date ?? undefined}
          jsonLd={rows.length ? {
            "@type": "ItemList",
            name: heading,
            numberOfItems: rows.length,
            itemListElement: rows.slice(0, 50).map((r, i) => ({ "@type": "ListItem", position: i + 1, name: r.name, ...(r.metrics ? { url: `${BASE}/stock/${encodeURIComponent(r.symbol)}` } : {}) })),
          } : undefined}
        />
        <Header />
        <VisibleBreadcrumbs items={crumbs} />
        <main className="container mx-auto px-4 py-8" data-list-state={loading ? "loading" : rows.length ? "ready" : "empty"}>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{heading}</h1>
          {loading ? <Skeleton className="mt-4 h-16 w-full max-w-3xl" /> : <p className="mt-4 max-w-3xl text-lg leading-relaxed">{answer}</p>}

          {industries.length > 1 && (
            <section aria-labelledby="industries" className="mt-8">
              <h2 id="industries" className="text-xl font-bold">Industry breakdown</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {industries.map((i) => (
                  <li key={i.name} className="rounded-md border px-2.5 py-1 text-sm">{i.name} <span className="tabular-nums text-muted-foreground">{i.count}</span></li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="constituents" className="mt-8">
            <h2 id="constituents" className="text-xl font-bold">{kind === "index" ? `${title} constituents` : `All ${sectorName} stocks`}, by market cap</h2>
            <Card className="mt-3 overflow-hidden p-0">
              {loading ? <Skeleton className="h-96 w-full" /> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th scope="col" className="p-3 text-left font-medium">#</th>
                        <th scope="col" className="p-3 text-left font-medium">Company</th>
                        {kind === "index" && <th scope="col" className="p-3 text-left font-medium">Industry</th>}
                        {COLUMNS.map((m) => <th key={m.id} scope="col" title={m.title} className="whitespace-nowrap p-3 text-right font-medium">{m.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={r.symbol} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="p-3 tabular-nums text-muted-foreground">{i + 1}</td>
                          <th scope="row" className="p-3 text-left font-normal">
                            {r.metrics
                              ? <Link to={`/stock/${encodeURIComponent(r.symbol)}`} className="font-medium hover:text-secondary hover:underline underline-offset-4">{r.name}</Link>
                              : <span>{r.name}</span>}
                            <span className="ml-2 font-mono text-[0.6875rem] text-muted-foreground">{r.symbol}</span>
                          </th>
                          {kind === "index" && <td className="p-3 text-muted-foreground">{r.industry ?? "—"}</td>}
                          {COLUMNS.map((m) => <td key={m.id} className="whitespace-nowrap p-3 text-right tabular-nums">{r.metrics ? displayMetric(m, r.metrics) : formatMetric(null, m.unit)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <p className="mt-2 text-xs text-muted-foreground">
              {kind === "index" ? "Constituents from NSE Indices; figures for the stocks we track, updated daily. " : "Sector as classified in our tracked universe. "}
              Prices are end-of-day snapshots and refresh live on each stock's page. Not investment advice.
            </p>
          </section>

          <nav aria-label="Other indices" className="mt-10">
            <h2 className="text-xl font-bold">Other NSE indices</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {INDEX_NAMES.filter((n) => n !== indexName).map((n) => (
                <li key={n}><Link to={`/indices/${listSlug(n)}`} className="inline-block rounded-md border px-2.5 py-1 text-sm hover:border-secondary/50 hover:text-secondary">{indexTitle(n)}</Link></li>
              ))}
            </ul>
          </nav>
        </main>
        {faq.length > 0 && <FAQ title={`${title}: common questions`} subtitle="Answered from the figures on this page." items={faq} />}
        <Footer />
        <WhatsAppButton />
      </div>
    </PageTransition>
  );
}

