import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import PageHeader, { HeaderStat } from "@/components/PageHeader";
import Footer from "@/components/Footer";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import SEOHead from "@/components/SEOHead";
import WhatsAppButton from "@/components/WhatsAppButton";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SymbolLink } from "@/components/markets/ActivitySection";
import NotFound from "@/pages/NotFound";
import { lakhs, marketSnapshots, trackedSymbols, type Mover } from "@/lib/market-data";
import { MOVER_LISTS, istDateTime, moverList, type MoverColumn } from "@/lib/market-movers";

const pct = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);
const crore = (v: number | null) => (v === null ? "—" : `₹${v.toLocaleString("en-IN", { maximumFractionDigits: v >= 100 ? 0 : 2 })} Cr`);

const COLUMN: Record<MoverColumn, { label: string; cell: (m: Mover) => string }> = {
  volume: { label: "Volume", cell: (m) => lakhs(m.volume === null ? null : Math.round(m.volume)) },
  volume_vs_week: { label: "vs 1-week avg", cell: (m) => (m.volume_vs_week === null ? "—" : `${m.volume_vs_week.toFixed(1)}×`) },
  value: { label: "Value", cell: (m) => crore(m.value_cr) },
};

/** The other lists, as links: each is its own crawlable page. */
export function MoverListNav({ current }: { current: string }) {
  return (
    <nav aria-label="Market movers" className="mb-4 flex flex-wrap gap-2">
      {MOVER_LISTS.map((list) => (
        <Link
          key={list.slug}
          to={`/markets/${list.slug}`}
          aria-current={list.slug === current ? "page" : undefined}
          className={`inline-flex min-h-9 items-center rounded-md border px-3 text-xs font-medium transition-colors ${
            list.slug === current ? "border-secondary bg-secondary text-secondary-foreground" : "bg-card text-muted-foreground hover:border-secondary/50 hover:text-foreground"
          }`}
        >
          {list.label}
        </Link>
      ))}
      <Link
        to="/markets/gift-nifty"
        aria-current={current === "gift-nifty" ? "page" : undefined}
        className={`inline-flex min-h-9 items-center rounded-md border px-3 text-xs font-medium transition-colors ${
          current === "gift-nifty" ? "border-secondary bg-secondary text-secondary-foreground" : "bg-card text-muted-foreground hover:border-secondary/50 hover:text-foreground"
        }`}
      >
        GIFT Nifty and pre-open
      </Link>
    </nav>
  );
}

export function MoverTable({ movers, columns, caption, tracked }: { movers: Mover[]; columns: MoverColumn[]; caption: string; tracked: Set<string> | undefined }) {
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">Stock</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Price (₹)</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Change</th>
            {columns.map((c) => <th key={c} scope="col" className="px-3 py-2.5 text-right font-medium">{COLUMN[c].label}</th>)}
          </tr>
        </thead>
        <tbody>
          {movers.map((m) => (
            <tr key={m.symbol} className="border-t">
              <td className="px-4 py-2">
                <SymbolLink symbol={m.symbol} tracked={tracked} />
                {m.name && <div className="max-w-[220px] truncate text-xs text-muted-foreground">{m.name}</div>}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{m.price?.toLocaleString("en-IN", { maximumFractionDigits: 2 }) ?? "—"}</td>
              <td className={`px-3 py-2 text-right tabular-nums ${m.change_pct === null ? "" : m.change_pct >= 0 ? "text-secondary" : "text-destructive"}`}>{pct(m.change_pct)}</td>
              {columns.map((c) => <td key={c} className="px-3 py-2 text-right tabular-nums text-muted-foreground">{COLUMN[c].cell(m)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

const MarketMoversPage = () => {
  const { list: slug } = useParams();
  const list = moverList(slug);
  const snap = useQuery({
    queryKey: ["market-snapshot", list?.kind],
    queryFn: async () => (await marketSnapshots([list!.kind]))[0] ?? null,
    enabled: !!list,
    staleTime: 5 * 60_000,
  });
  const tracked = useQuery({ queryKey: ["tracked-symbols"], queryFn: trackedSymbols, staleTime: 60 * 60_000 });

  if (!list) return <NotFound />;
  const asOf = istDateTime(snap.data?.as_of ?? null);
  const movers = snap.data?.payload ?? [];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`${list.title} | Parasram India`}
        description={list.description}
        breadcrumbs={[{ name: "Home", url: "/" }, { name: "Market Pulse", url: "/market-pulse" }, { name: list.label }]}
      />
      <Header />
      <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Market Pulse", url: "/market-pulse" }, { name: list.label }]} />
      <main className="container mx-auto px-4 py-8">
        <PageHeader className="mb-6" eyebrow="Market movers" title={list.title} description={list.description}>
          {asOf && <HeaderStat label="As of" value={asOf} />}
          {!snap.isLoading && <HeaderStat label="Stocks" value={movers.length} />}
        </PageHeader>

        <MoverListNav current={list.slug} />

        {snap.isLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : snap.isError ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">This list could not be loaded. Please try again in a few minutes.</Card>
        ) : movers.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">No stocks on this list yet today. It fills in once trading starts at 9:15 am.</Card>
        ) : (
          <MoverTable movers={movers} columns={list.columns} caption={list.title} tracked={tracked.data} />
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          Source: NSE. The list refreshes every 15 minutes while the market is open and once more after the close. Prices can move after the time shown.
          Linked symbols open their stock page. This is market data, not investment advice.
        </p>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default MarketMoversPage;
