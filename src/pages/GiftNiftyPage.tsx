import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import PageHeader, { HeaderStat } from "@/components/PageHeader";
import Footer from "@/components/Footer";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import SEOHead from "@/components/SEOHead";
import WhatsAppButton from "@/components/WhatsAppButton";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MoverListNav, MoverTable } from "@/pages/MarketMoversPage";
import { marketSnapshots, shortDate, trackedSymbols, type MarketStatus, type PreOpen, type Snapshot } from "@/lib/market-data";
import { istDateTime } from "@/lib/market-movers";

const points = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);
const pct = (v: number | null) => (v === null ? "" : ` (${v >= 0 ? "+" : ""}${v.toFixed(2)}%)`);
const level = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const tone = (v: number | null) => (v === null ? "" : v >= 0 ? "text-secondary" : "text-destructive");

function Tile({ label, value, change, changePct, note }: { label: string; value: string; change?: number | null; changePct?: number | null; note: string }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</div>
      {change !== undefined && <div className={`text-sm tabular-nums ${tone(change ?? null)}`}>{points(change ?? null)}{pct(changePct ?? null)}</div>}
      <div className="mt-1 text-xs text-muted-foreground">{note}</div>
    </Card>
  );
}

const GiftNiftyPage = () => {
  const snaps = useQuery({
    queryKey: ["market-snapshot", "gift-nifty"],
    queryFn: () => marketSnapshots<unknown>(["market_status", "pre_open_fo"]),
    staleTime: 5 * 60_000,
  });
  const tracked = useQuery({ queryKey: ["tracked-symbols"], queryFn: trackedSymbols, staleTime: 60 * 60_000 });

  const status = snaps.data?.find((s) => s.kind === "market_status") as Snapshot<MarketStatus> | undefined;
  const pre = snaps.data?.find((s) => s.kind === "pre_open_fo") as Snapshot<PreOpen> | undefined;
  const gift = status?.payload.gift_nifty ?? null;
  const nifty = status?.payload.nifty ?? null;
  const gap = gift && nifty ? gift.last - nifty.last : null;
  const movers = pre?.payload.movers ?? [];
  const risers = movers.filter((m) => (m.change_pct ?? 0) > 0);
  const fallers = movers.filter((m) => (m.change_pct ?? 0) < 0);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="GIFT Nifty Today and NSE Pre-Open Market | Parasram India"
        description="GIFT Nifty's latest price against the Nifty 50's last close, and how F&O stocks priced in NSE's 9:00 to 9:08 am pre-open session."
        breadcrumbs={[{ name: "Home", url: "/" }, { name: "Market Pulse", url: "/market-pulse" }, { name: "GIFT Nifty" }]}
      />
      <Header />
      <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Market Pulse", url: "/market-pulse" }, { name: "GIFT Nifty" }]} />
      <main className="container mx-auto px-4 py-8">
        <PageHeader
          className="mb-6"
          eyebrow="Before the open"
          title="GIFT Nifty and pre-open today"
          description="GIFT Nifty's latest price against the Nifty 50's last close, and how F&O stocks priced in NSE's pre-open session."
        >
          {gift?.as_of && <HeaderStat label="GIFT Nifty as of" value={istDateTime(gift.as_of)} />}
        </PageHeader>

        <MoverListNav current="gift-nifty" />

        {snaps.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : snaps.isError || !gift ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">GIFT Nifty data could not be loaded. Please try again in a few minutes.</Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <Tile label="GIFT Nifty" value={level(gift.last)} change={gift.change} changePct={gift.change_pct} note={`Near-month future, expires ${shortDate(gift.expiry)}`} />
            {nifty && <Tile label="Nifty 50" value={level(nifty.last)} change={nifty.change} changePct={nifty.change_pct} note={`${nifty.status ?? "Last"} · ${istDateTime(nifty.as_of) ?? ""}`} />}
            {gap !== null && nifty && (
              <Tile
                label="GIFT Nifty minus Nifty 50"
                value={`${points(gap)} pts`}
                note={`${((gap / nifty.last) * 100).toFixed(2)}% of the Nifty's level. A future usually trades a little above the index; the gap is not a forecast of the open.`}
              />
            )}
          </div>
        )}

        <section aria-labelledby="pre-open-heading" className="mt-10">
          <h2 id="pre-open-heading" className="text-xl font-semibold">F&amp;O stocks in the pre-open session</h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            {pre?.as_of ? `Session of ${istDateTime(pre.as_of)}. ` : ""}
            {pre?.payload.advances != null && pre.payload.declines != null
              ? `${pre.payload.advances} F&O stocks priced above their previous close, ${pre.payload.declines} below and ${pre.payload.unchanged ?? 0} unchanged. `
              : ""}
            Price is the opening price the session found; change is against the previous close.
          </p>
          {snaps.isLoading ? (
            <Skeleton className="mt-4 h-72 w-full" />
          ) : movers.length === 0 ? (
            <Card className="mt-4 p-8 text-center text-sm text-muted-foreground">No pre-open data yet. The session runs from 9:00 to 9:08 am on trading days.</Card>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="min-w-0">
                <h3 className="mb-2 text-sm font-semibold">Largest rises</h3>
                <MoverTable movers={risers} columns={["volume", "value"]} caption="F&O stocks with the largest pre-open rises" tracked={tracked.data} />
              </div>
              <div className="min-w-0">
                <h3 className="mb-2 text-sm font-semibold">Largest falls</h3>
                <MoverTable movers={fallers} columns={["volume", "value"]} caption="F&O stocks with the largest pre-open falls" tracked={tracked.data} />
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="about-heading" className="mt-10 max-w-prose space-y-3 text-sm text-muted-foreground">
          <h2 id="about-heading" className="text-xl font-semibold text-foreground">About these numbers</h2>
          <p>
            GIFT Nifty is a Nifty 50 futures contract traded on NSE International Exchange in GIFT City, Gandhinagar. It trades for most of the day and
            night, so it moves while the Indian market is shut, which is why people look at it before 9:15 am.
          </p>
          <p>
            In NSE's pre-open session, orders are collected from 9:00 to 9:08 am and matched to find each stock's opening price. Normal trading starts at 9:15 am.
          </p>
          <p className="text-xs">Source: NSE. Market data, not investment advice.</p>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default GiftNiftyPage;
