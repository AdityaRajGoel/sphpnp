import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Header from "@/components/Header";
import PageHeader, { HeaderStat } from "@/components/PageHeader";
import Footer from "@/components/Footer";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import SEOHead from "@/components/SEOHead";
import WhatsAppButton from "@/components/WhatsAppButton";
import FAQ from "@/components/FAQ";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { segmentItem, segmentTrack } from "@/components/ui/segmented";
import { CHART, EmptyState, SectionHeading, axisTick, tooltipStyle } from "@/components/markets/chart-kit";
import { useLiveMarket } from "@/hooks/useLiveMarket";
import { globalMarkets, shortDate, type GlobalBar } from "@/lib/market-data";
import { alignRupees, monthTicks, trailingReturns, yearRange, GOLD_10G_PER_OZ, SILVER_KG_PER_OZ, type Close } from "@/lib/index-performance";

/** "₹1,47,724.00" -> 147724; "+1.10%" -> 1.1. The live feed sends display strings. */
const toNumber = (s: string | undefined) => {
  const n = Number((s ?? "").replace(/[^0-9.-]/g, ""));
  return s && Number.isFinite(n) ? n : null;
};
const pct = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);
const tone = (v: number | null) => (v === null ? "text-muted-foreground" : v >= 0 ? "text-secondary" : "text-destructive");
const rupees = (v: number) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: v < 1000 ? 2 : 0 })}`;
const dollars = (v: number) => `$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const monthLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });

const MCX_NOTES: Record<string, string> = {
  GOLD: "Per 10 grams", SILVER: "Per kilogram", "CRUDE OIL": "Per barrel", "NAT GAS": "Per mmBtu", COPPER: "Per kilogram", ALUMINIUM: "Per kilogram",
};

type SeriesKey = "gold_inr" | "silver_inr" | "gold_usd" | "silver_usd" | "brent" | "wti" | "natgas" | "usdinr";
type Series = { key: SeriesKey; label: string; note: string; format: (v: number) => string; data: Close[] };

const pick = (bars: GlobalBar[], ticker: string): Close[] => bars.filter((b) => b.ticker === ticker).map((b) => ({ trade_date: b.trade_date, close: b.close }));

function buildSeries(bars: GlobalBar[]): Series[] {
  const gold = pick(bars, "XAUUSD.FOREX");
  const silver = pick(bars, "XAGUSD.FOREX");
  const inr = pick(bars, "USDINR.FOREX");
  return [
    { key: "gold_inr", label: "Gold, ₹/10 g", note: "International spot gold converted at that day's USD/INR, before import duty and GST.", format: rupees, data: alignRupees(gold, inr, GOLD_10G_PER_OZ) },
    { key: "silver_inr", label: "Silver, ₹/kg", note: "International spot silver converted at that day's USD/INR, before import duty and GST.", format: rupees, data: alignRupees(silver, inr, SILVER_KG_PER_OZ) },
    { key: "gold_usd", label: "Gold, $/oz", note: "International spot gold, US dollars per troy ounce.", format: dollars, data: gold },
    { key: "silver_usd", label: "Silver, $/oz", note: "International spot silver, US dollars per troy ounce.", format: dollars, data: silver },
    { key: "brent", label: "Brent, $/bbl", note: "Brent crude spot price, US dollars per barrel. Source: US Energy Information Administration, via FRED.", format: dollars, data: pick(bars, "BRENT.SPOT") },
    { key: "wti", label: "WTI, $/bbl", note: "West Texas Intermediate crude spot price, US dollars per barrel. Source: US Energy Information Administration, via FRED.", format: dollars, data: pick(bars, "WTI.SPOT") },
    { key: "natgas", label: "Natural gas, $/mmBtu", note: "Henry Hub natural gas spot price, the benchmark MCX natural gas follows. Source: US Energy Information Administration, via FRED.", format: dollars, data: pick(bars, "NATGAS.SPOT") },
    { key: "usdinr", label: "USD/INR", note: "Rupees per US dollar. A weaker rupee raises the rupee price of every imported commodity.", format: (v) => `₹${v.toFixed(2)}`, data: inr },
  ];
}

/**
 * /commodities: MCX prices from the live feed, and a year of international
 * gold, silver, Brent and USD/INR closes with returns, ranges and the gold
 * to silver ratio. International prices are converted to rupees at parity so
 * they can be read beside MCX.
 */
export default function CommoditiesPage() {
  const { commodities, fetchedAt } = useLiveMarket();
  const history = useQuery({ queryKey: ["global-markets"], queryFn: globalMarkets, staleTime: 30 * 60_000 });
  const [selected, setSelected] = useState<SeriesKey>("gold_inr");

  const mcx = commodities.filter((c) => c.unit?.startsWith("₹/"));
  const series = useMemo(() => buildSeries(history.data ?? []), [history.data]);
  const chosen = series.find((s) => s.key === selected) ?? series[0];
  const chosenRange = useMemo(() => yearRange(chosen.data), [chosen]);
  const chosenReturns = useMemo(() => trailingReturns(chosen.data).filter((r) => r.key !== "2Y"), [chosen]);

  const ratio = useMemo(() => {
    const silver = new Map(pick(history.data ?? [], "XAGUSD.FOREX").map((b) => [b.trade_date, b.close]));
    return pick(history.data ?? [], "XAUUSD.FOREX").flatMap((g) => {
      const s = silver.get(g.trade_date);
      return g.close && s ? [{ trade_date: g.trade_date, close: g.close / s }] : [];
    });
  }, [history.data]);
  const ratioRange = useMemo(() => yearRange(ratio), [ratio]);

  const goldParity = series[0].data.at(-1) ?? null;
  const mcxGold = toNumber(mcx.find((c) => c.name === "GOLD")?.price);
  const premium = goldParity && mcxGold ? (mcxGold / goldParity.close - 1) * 100 : null;

  const crumbs = [{ name: "Home", url: "/" }, { name: "Markets", url: "/market-pulse" }, { name: "Commodities" }];
  const faq = [
    { q: "Where do these commodity prices come from?", a: "The MCX prices are the latest quotes on the Multi Commodity Exchange of India, refreshed through the trading day. The charts use international end-of-day closes for spot gold and silver, Brent, WTI and Henry Hub natural gas spot prices from the US Energy Information Administration, and USD/INR." },
    { q: "Why is MCX gold higher than the international price in rupees?", a: `The rupee figure converts spot gold at USD/INR and stops there. MCX gold also carries import duty, GST and the cost of holding a futures contract to expiry${premium !== null ? `, which together put it ${premium.toFixed(1)}% above parity on the latest figures` : ""}. The two are also quoted at different times of day.` },
    { q: "What are MCX trading hours?", a: "Metals and energy trade from 9:00 am to 11:30 pm IST, extended to 11:55 pm while US daylight saving time is in force. Agricultural contracts close earlier." },
    { q: "What is the gold to silver ratio?", a: `How many ounces of silver one ounce of gold buys${ratioRange ? `: ${ratioRange.last.toFixed(1)} on the latest close, against a 52-week range of ${ratioRange.low.toFixed(1)} to ${ratioRange.high.toFixed(1)}` : ""}. It is a measure of the two metals' relative price, not a signal.` },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Commodity Prices Today: MCX Gold, Silver, Crude Oil"
        description="MCX gold, silver, crude oil, natural gas, copper and aluminium prices today, with a year of international gold, silver, Brent and natural gas prices."
        breadcrumbs={crumbs}
        faqItems={faq.map((f) => ({ question: f.q, answer: f.a }))}
      />
      <Header />
      <VisibleBreadcrumbs items={crumbs} />
      <main className="container mx-auto px-4 py-8" data-list-state={history.isLoading ? "loading" : "ready"}>
        <PageHeader
          className="mb-6"
          eyebrow="Markets"
          title="Commodity prices today"
          description="Gold, silver, crude oil, natural gas and base metals on MCX, with a year of international prices in rupees and dollars."
        >
          {fetchedAt && <HeaderStat label="MCX quotes as of" value={new Date(fetchedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })} />}
        </PageHeader>

        <section aria-labelledby="mcx-heading">
          <SectionHeading id="mcx-heading" title="MCX prices" subtitle="Near-month futures on the Multi Commodity Exchange, change on the previous close." />
          {mcx.length === 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {mcx.map((c) => {
                const change = toNumber(c.change);
                return (
                  <li key={c.name}>
                    <Card className="h-full p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{c.name}</p>
                      <p className="mt-1 text-xl font-semibold tabular-nums">{c.price}</p>
                      <p className={`text-sm font-medium tabular-nums ${tone(change)}`}>{pct(change)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{MCX_NOTES[c.name] ?? c.unit}</p>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="history-heading" className="mt-10">
          <SectionHeading id="history-heading" title="International prices, one year" subtitle="End-of-day closes, collected each weekday morning." />
          {history.isLoading ? <Skeleton className="mt-4 h-96 w-full" /> : chosen.data.length === 0 ? (
            <div className="mt-4"><EmptyState text="International prices are collected each weekday morning." /></div>
          ) : (
            <Card className="mt-4 min-w-0 p-4 sm:p-5">
              <div role="group" aria-label="Series" className={`${segmentTrack} max-w-full overflow-x-auto`}>
                {series.map((s) => (
                  <button key={s.key} type="button" aria-pressed={selected === s.key} className={segmentItem(selected === s.key)} onClick={() => setSelected(s.key)}>{s.label}</button>
                ))}
              </div>
              {chosenRange && (
                <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
                  <p className="text-3xl font-bold tabular-nums">{chosen.format(chosenRange.last)}</p>
                  <p className="text-sm text-muted-foreground">
                    Close {shortDate(chosen.data.at(-1)?.trade_date ?? null)} · 52-week range {chosen.format(chosenRange.low)} – {chosen.format(chosenRange.high)}
                  </p>
                </div>
              )}
              <p className="mt-1 max-w-prose text-xs text-muted-foreground">{chosen.note}</p>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chosen.data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="commodity-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART.primary} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={CHART.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={CHART.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="trade_date" ticks={monthTicks(chosen.data.map((d) => d.trade_date))} tick={axisTick} tickFormatter={monthLabel} tickLine={false} axisLine={false} />
                    <YAxis domain={["auto", "auto"]} tick={axisTick} tickFormatter={(v: number) => chosen.format(v)} width={84} tickLine={false} axisLine={false} />
                    <Tooltip {...tooltipStyle} labelFormatter={(iso: string) => shortDate(iso)} formatter={(v: number) => [chosen.format(v), chosen.label]} />
                    <Area dataKey="close" type="monotone" stroke={CHART.primary} strokeWidth={2} fill="url(#commodity-fill)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5" aria-label="Returns">
                {chosenReturns.map((r) => (
                  <li key={r.key} className="rounded-md border px-2 py-1.5 text-center">
                    <span className="block text-[0.6875rem] text-muted-foreground">{r.label}</span>
                    <span className={`block text-sm font-semibold tabular-nums ${tone(r.pct)}`}>{pct(r.pct)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>

        {(premium !== null || ratioRange) && (
          <section aria-labelledby="read-heading" className="mt-10 grid gap-4 md:grid-cols-2">
            <h2 id="read-heading" className="sr-only">Reading the numbers</h2>
            {premium !== null && goldParity && mcxGold && (
              <Card className="p-5">
                <h3 className="font-semibold">MCX gold against international parity</h3>
                <p className="mt-2 text-3xl font-bold tabular-nums">{premium >= 0 ? "+" : ""}{premium.toFixed(1)}%</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  MCX gold at {rupees(mcxGold)} per 10 g against {rupees(goldParity.close)} for spot gold converted at USD/INR on {shortDate(goldParity.trade_date)}.
                  The gap is import duty, GST and futures carry, and the two quotes are from different times of day.
                </p>
              </Card>
            )}
            {ratioRange && (
              <Card className="p-5">
                <h3 className="font-semibold">Gold to silver ratio</h3>
                <p className="mt-2 text-3xl font-bold tabular-nums">{ratioRange.last.toFixed(1)}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Ounces of silver one ounce of gold buys. 52-week range {ratioRange.low.toFixed(1)} ({shortDate(ratioRange.lowDate)}) to {ratioRange.high.toFixed(1)} ({shortDate(ratioRange.highDate)}).
                </p>
              </Card>
            )}
          </section>
        )}

        <p className="mt-8 text-xs text-muted-foreground">
          MCX quotes via Economic Times; international closes from EODHD and Yahoo Finance; energy spot prices from the US EIA via FRED. Market data, not investment advice. See also{" "}
          <Link to="/commodity-research" className="underline underline-offset-4 hover:text-secondary">ten-year commodity research</Link>,{" "}
          <Link to="/indices" className="underline underline-offset-4 hover:text-secondary">NSE indices</Link> and{" "}
          <Link to="/market-pulse#global" className="underline underline-offset-4 hover:text-secondary">global cues</Link>.
        </p>
      </main>
      <FAQ title="Commodity prices: common questions" subtitle="Answered from the figures on this page." items={faq} />
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
