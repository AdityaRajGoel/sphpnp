import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowUp, ArrowDown, RefreshCw, Loader2, Flame, Snowflake, Gauge } from "lucide-react";
import Header from "@/components/Header";
import ImageBanner, { BannerStat } from "@/components/ImageBanner";
import Footer from "@/components/Footer";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import SEOHead from "@/components/SEOHead";
import WhatsAppButton from "@/components/WhatsAppButton";
import ScrollProgress from "@/components/ScrollProgress";
import PageTransition from "@/components/PageTransition";
import StockTicker from "@/components/StockTicker";
import AnimatedNumber from "@/components/ui/animated-number";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useScreenerStocks, type ScreenerStock } from "@/hooks/useScreenerStocks";
import { useScreenerUniverse } from "@/hooks/useScreenerUniverse";
import { formatMetric, type MetricRow } from "@/lib/screener-metrics";

type Side = "high" | "low";

/** Distance thresholds: how close counts as "near", and what counts as "at" the extreme. */
const NEAR = { high: 10, low: 15 } as const;
const AT = 2;

type Row = { stock: ScreenerStock; distance: number; position: number; metrics: MetricRow | undefined };

const buildRows = (stocks: ScreenerStock[], universe: Map<string, MetricRow> | undefined, side: Side): Row[] =>
  stocks
    .filter((s) => s.high_52 > 0 && s.low_52 > 0 && s.price > 0 && s.high_52 > s.low_52)
    .map((s) => ({
      stock: s,
      distance: side === "high" ? ((s.high_52 - s.price) / s.high_52) * 100 : ((s.price - s.low_52) / s.low_52) * 100,
      position: ((s.price - s.low_52) / (s.high_52 - s.low_52)) * 100,
      metrics: universe?.get(s.symbol),
    }))
    .filter((r) => r.distance <= NEAR[side])
    .sort((a, b) => a.distance - b.distance);

function RangeBar({ position }: { position: number }) {
  return (
    <div className="relative h-1.5 w-28 rounded-full bg-gradient-to-r from-destructive/60 via-brand-gold/60 to-secondary/60" aria-hidden="true">
      <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-foreground bg-card" style={{ left: `${Math.min(100, Math.max(0, position))}%` }} />
    </div>
  );
}

function ExtremeTable({ rows, side }: { rows: Row[]; side: Side }) {
  if (rows.length === 0) return <Card className="p-8 text-center text-sm text-muted-foreground">No stocks within {NEAR[side]}% of their 52-week {side}.</Card>;
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">Stock</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Price</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Day</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">{side === "high" ? "Below high" : "Above low"}</th>
            <th scope="col" className="px-3 py-2.5 text-left font-medium">52W range</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium" title="One-year price change">1Y</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium" title="Distance from the 200-day average">vs 200DMA</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium" title="RSI (14)">RSI</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium" title="20-day delivery share">Delivery</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium" title="Latest volume against its 20-session norm">Volume</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ stock: s, distance, position, metrics: m }) => (
            <tr key={s.symbol} className="border-t hover:bg-muted/30">
              <td className="px-4 py-2">
                <Link to={`/stock/${encodeURIComponent(s.symbol)}`} className="font-semibold hover:text-primary">{s.symbol}</Link>
                {distance <= AT && <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold ${side === "high" ? "bg-secondary/15 text-secondary" : "bg-destructive/15 text-destructive"}`}>AT {side.toUpperCase()}</span>}
                <div className="max-w-[200px] truncate text-xs text-muted-foreground">{s.name} · {s.sector}</div>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">₹{s.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
              <td className={`px-3 py-2 text-right tabular-nums ${s.change_pct >= 0 ? "text-secondary" : "text-destructive"}`}>{s.change_pct >= 0 ? "+" : ""}{s.change_pct.toFixed(2)}%</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{distance.toFixed(1)}%</td>
              <td className="px-3 py-2"><div className="flex items-center gap-2"><RangeBar position={position} /><span className="text-xs tabular-nums text-muted-foreground">{position.toFixed(0)}</span></div></td>
              <td className={`px-3 py-2 text-right tabular-nums ${(m?.risk?.return_1y ?? 0) >= 0 ? "text-secondary" : "text-destructive"}`}>{formatMetric(m?.risk?.return_1y ?? null, "signed_pct")}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatMetric(m?.risk?.distance_from_200 ?? null, "signed_pct")}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatMetric(m?.risk?.rsi_14 ?? null, "number")}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatMetric(m?.risk?.delivery_recent ?? null, "pct")}</td>
              <td className={`px-4 py-2 text-right tabular-nums ${(m?.risk?.volume_zscore ?? 0) >= 2 ? "font-semibold text-brand-orange" : ""}`}>{formatMetric(m?.risk?.volume_zscore ?? null, "sigma")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

const Week52TrackerPage = () => {
  const { stocks, loading, updatedAt, refresh } = useScreenerStocks();
  const universe = useScreenerUniverse();
  const [refreshing, setRefreshing] = useState(false);
  const [side, setSide] = useState<Side>("high");
  const [sector, setSector] = useState("all");

  const sectors = useMemo(() => [...new Set(stocks.map((s) => s.sector))].sort(), [stocks]);
  const scoped = useMemo(() => (sector === "all" ? stocks : stocks.filter((s) => s.sector === sector)), [stocks, sector]);
  const highs = useMemo(() => buildRows(scoped, universe.data, "high"), [scoped, universe.data]);
  const lows = useMemo(() => buildRows(scoped, universe.data, "low"), [scoped, universe.data]);

  /** Per sector: how many sit near each extreme - where the new highs and lows are clustering. */
  const sectorSplit = useMemo(() => {
    const map = new Map<string, { high: number; low: number; total: number }>();
    for (const s of stocks) map.set(s.sector, { ...(map.get(s.sector) ?? { high: 0, low: 0, total: 0 }), total: (map.get(s.sector)?.total ?? 0) + 1 });
    for (const r of buildRows(stocks, undefined, "high")) map.get(r.stock.sector)!.high++;
    for (const r of buildRows(stocks, undefined, "low")) map.get(r.stock.sector)!.low++;
    return [...map.entries()].filter(([, v]) => v.high + v.low > 0).sort((a, b) => b[1].high - b[1].low - (a[1].high - a[1].low));
  }, [stocks]);

  const priced = scoped.filter((s) => s.high_52 > s.low_52 && s.price > 0);
  const avgPosition = priced.length ? priced.reduce((sum, s) => sum + ((s.price - s.low_52) / (s.high_52 - s.low_52)) * 100, 0) / priced.length : null;
  const atHigh = highs.filter((r) => r.distance <= AT).length;
  const atLow = lows.filter((r) => r.distance <= AT).length;
  const maxSplit = Math.max(1, ...sectorSplit.map(([, v]) => Math.max(v.high, v.low)));

  const handleRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };

  return (
    <PageTransition>
    <div className="min-h-screen bg-background">
      <SEOHead
        title="52-Week High Low Tracker for NSE Stocks | Parasram India"
        description="NSE stocks at and near their 52-week highs and lows, with the sectors they cluster in, one-year return, 200-day trend, RSI, delivery and volume spikes."
        breadcrumbs={[{ name: "Home", url: "/" }, { name: "52-Week High/Low Tracker" }]}
        jsonLd={{
          "@type": "WebApplication",
          name: "52-Week High/Low Tracker - Parasram India",
          applicationCategory: "FinanceApplication",
          operatingSystem: "Web Browser",
          url: "https://www.sphpnp.com/52-week-tracker",
          offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
          featureList: ["Stocks at and near 52-week highs and lows", "Sector clustering of new highs and lows", "One-year return, 200-day trend, RSI, delivery and volume beside each stock", "Sector filter"],
        }}
      />
      <ScrollProgress />
      <Header />
      <StockTicker />
      <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "52-Week Tracker" }]} />
      <main className="container mx-auto px-4 py-8">
        <ImageBanner
          slug="figure-line"
          className="mb-6"
          focus={{ mobile: "22% 60%", desktop: "30% 58%" }}
          eyebrow="Yearly extremes"
          title="52-Week High / Low Tracker"
          description="Which stocks sit at their yearly extremes, which sectors they cluster in, and what their trend, momentum and participation look like."
        >
          {updatedAt && <BannerStat label="Updated" value={new Date(updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} />}
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="h-9 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}<span className="ml-1.5">Refresh</span>
          </Button>
        </ImageBanner>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { icon: Flame, label: `Within ${AT}% of 52W high`, value: atHigh, note: `${highs.length} within ${NEAR.high}%`, tone: "text-secondary" },
            { icon: Snowflake, label: `Within ${AT}% of 52W low`, value: atLow, note: `${lows.length} within ${NEAR.low}%`, tone: "text-destructive" },
            { icon: Gauge, label: "Average range position", value: avgPosition === null ? "—" : avgPosition.toFixed(0), note: "0 = at the low, 100 = at the high", tone: "" },
            { icon: ArrowUp, label: "Highs vs lows", value: lows.length ? (highs.length / lows.length).toFixed(2) : "—", note: "Near-high count over near-low count", tone: "" },
          ].map((c) => (
            <Card key={c.label} className="p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><c.icon className="h-4 w-4" aria-hidden="true" />{c.label}</div>
              <div className={`mt-1 text-2xl font-bold tabular-nums ${c.tone}`}>
                {loading ? "…" : typeof c.value === "number" ? <AnimatedNumber value={c.value} /> : c.value}
              </div>
              <div className="text-xs text-muted-foreground">{c.note}</div>
            </Card>
          ))}
        </div>

        {sectorSplit.length > 0 && (
          <Card className="p-4 mb-6">
            <h2 className="text-sm font-semibold mb-3">Where the extremes cluster</h2>
            <ul className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
              {sectorSplit.slice(0, 14).map(([name, v]) => (
                <li key={name}>
                  <button type="button" onClick={() => setSector(sector === name ? "all" : name)} aria-pressed={sector === name} className={`grid w-full grid-cols-[7rem_1fr_1fr] items-center gap-2 rounded px-1 text-xs hover:bg-muted/40 ${sector === name ? "bg-muted" : ""}`}>
                    <span className="truncate text-left font-medium">{name}</span>
                    <span className="flex justify-end" title={`${v.low} near low`}><span className="h-2 rounded-l bg-destructive/70" style={{ width: `${(v.low / maxSplit) * 100}%` }} /></span>
                    <span className="flex" title={`${v.high} near high`}><span className="h-2 rounded-r bg-secondary/70" style={{ width: `${(v.high / maxSplit) * 100}%` }} /></span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">Red: stocks near the 52-week low. Green: near the high. Click a sector to filter.</p>
          </Card>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div role="tablist" aria-label="Extreme" className="flex gap-1 rounded-lg bg-muted p-1">
            {(["high", "low"] as Side[]).map((s) => (
              <button key={s} type="button" role="tab" aria-selected={side === s} onClick={() => setSide(s)} className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${side === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {s === "high" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />} Near 52W {s} ({loading ? "…" : (s === "high" ? highs : lows).length})
              </button>
            ))}
          </div>
          <Select value={sector} onValueChange={setSector}>
            <SelectTrigger aria-label="Sector" className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sectors</SelectItem>
              {sectors.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? <Skeleton className="h-96 w-full" /> : <ExtremeTable rows={side === "high" ? highs : lows} side={side} />}

        <p className="text-xs text-muted-foreground mt-4">
          Prices refresh every five minutes; the 52-week range is from the quote feed. 1Y return, 200-day trend, RSI, delivery and volume are
          computed daily from each stock's own bars. Open the <Link to={`/screener?scan=${side === "high" ? "52w_high" : "52w_low"}`} className="text-primary hover:underline">screener scan</Link> to combine this with other filters. Not investment advice.
        </p>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  </PageTransition>
  );
};

export default Week52TrackerPage;
