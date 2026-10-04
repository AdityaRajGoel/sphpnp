import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Gem } from "lucide-react";
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
import { CHART, EmptyState, SectionHeading, axisTick, divergingFill, tooltipStyle } from "@/components/markets/chart-kit";
import { globalHistory, shortDate, type GlobalBar } from "@/lib/market-data";
import { mcxSeries } from "@/lib/mcx-data";
import { annualised, monthTicks, yearRange } from "@/lib/index-performance";
import { correlation, maxDrawdown, seasonality, volatility } from "@/lib/commodity-research";
import { heatStep } from "@/lib/sector-heatmap";

const COMMODITIES = [
  { ticker: "GOLD.FUT", label: "Gold", unit: "$/oz", note: "COMEX front-month gold futures.", mcx: "GOLD", mcxUnit: "₹/10 g" },
  { ticker: "SILVER.FUT", label: "Silver", unit: "$/oz", note: "COMEX front-month silver futures.", mcx: "SILVER", mcxUnit: "₹/kg" },
  { ticker: "COPPER.FUT", label: "Copper", unit: "$/lb", note: "COMEX front-month copper futures.", mcx: "COPPER", mcxUnit: "₹/kg" },
  { ticker: "BRENT.SPOT", label: "Brent crude", unit: "$/bbl", note: "Brent spot price, US Energy Information Administration via FRED.", mcx: null, mcxUnit: "" },
  { ticker: "WTI.SPOT", label: "WTI crude", unit: "$/bbl", note: "WTI spot price, US Energy Information Administration via FRED.", mcx: "CRUDEOIL", mcxUnit: "₹/bbl" },
  { ticker: "NATGAS.SPOT", label: "Natural gas", unit: "$/mmBtu", note: "Henry Hub spot price, US Energy Information Administration via FRED.", mcx: "NATURALGAS", mcxUnit: "₹/mmBtu" },
] as const;
type Market = "intl" | "mcx";
const MCX_NOTE = "MCX's most-held futures contract each trading day, from MCX's own bhavcopy and market watch; a contract roll can move the series on its own.";
/** What each commodity is measured against for how-it-moves-with. */
const PEERS = [
  { ticker: "USDINR.FOREX", label: "US dollar in rupees" },
  { ticker: "GSPC.INDX", label: "S&P 500" },
  { ticker: "GOLD.FUT", label: "Gold" },
  { ticker: "BRENT.SPOT", label: "Brent crude" },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_CUTS = [0.5, 2, 5] as const;

const tenYearsAgo = () => new Date(Date.now() - 10.1 * 365.25 * 86_400_000).toISOString().slice(0, 10);
const pct = (v: number | null, d = 1) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(d)}%`);
const tone = (v: number | null) => (v === null ? "text-muted-foreground" : v >= 0 ? "text-secondary" : "text-destructive");
const dollars = (v: number) => `$${v.toLocaleString("en-US", { maximumFractionDigits: v < 20 ? 3 : 2 })}`;
const rupees = (v: number) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: v < 1000 ? 2 : 0 })}`;
const yearLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
const closes = (bars: GlobalBar[] | undefined) => (bars ?? []).map((b) => ({ trade_date: b.trade_date, close: b.close }));

/** A global ticker's last ten years, or with an "MCX:" prefix the MCX most-held-contract series since 2012. */
function useHistory(ticker: string) {
  return useQuery({
    queryKey: ["global-history-10y", ticker],
    queryFn: () => (ticker.startsWith("MCX:") ? mcxSeries(ticker.slice(4)) : globalHistory(ticker, tenYearsAgo())),
    staleTime: 6 * 60 * 60_000,
  });
}

/**
 * /commodity-research: ten years of gold, silver, copper, crude and natural
 * gas, with returns, volatility, the worst fall, how each month has tended to
 * go, and how the commodity moves with the rupee, US stocks and its peers.
 * Descriptions of the past from end-of-day closes, not forecasts.
 */
export default function CommodityResearchPage() {
  const [pick, setPick] = useState<(typeof COMMODITIES)[number]["ticker"]>("GOLD.FUT");
  const [market, setMarket] = useState<Market>("intl");
  const c = COMMODITIES.find((x) => x.ticker === pick)!;
  const onMcx = market === "mcx" && c.mcx !== null;
  const money = onMcx ? rupees : dollars;
  const unit = onMcx ? c.mcxUnit : c.unit;
  const main = useHistory(onMcx ? `MCX:${c.mcx}` : pick);
  const peers = [useHistory(PEERS[0].ticker), useHistory(PEERS[1].ticker), useHistory(PEERS[2].ticker), useHistory(PEERS[3].ticker)];

  const series = useMemo(() => closes(main.data), [main.data]);
  const stats = useMemo(() => {
    const range = yearRange(series);
    return {
      last: series.at(-1) ?? null,
      range,
      cagr: [1, 3, 5, 10].map((y) => ({ y, v: annualised(series, y) })),
      vol: volatility(series),
      dd: maxDrawdown(series),
      season: seasonality(series),
    };
  }, [series]);
  const corr = PEERS.filter((p) => onMcx || p.ticker !== pick).map((p) => ({ ...p, v: correlation(series, closes(peers[PEERS.indexOf(p)].data)) }));
  const years = series.length ? Math.round((Date.parse(series[series.length - 1].trade_date) - Date.parse(series[0].trade_date)) / (365.25 * 86_400_000)) : 0;

  const crumbs = [{ name: "Home", url: "/" }, { name: "Commodities", url: "/commodities" }, { name: "Research" }];
  const faq = [
    { q: "Where does this data come from?", a: "In US dollars: gold, silver and copper are COMEX front-month futures; Brent, WTI and Henry Hub natural gas are spot prices published by the US Energy Information Administration through FRED. In rupees: MCX's own daily bhavcopy since 2012, taking each day's most-held futures contract. All are end-of-day closes, collected each weekday." },
    { q: "What does volatility mean here?", a: "How widely the daily price has swung over the last year, as an annual figure: the standard deviation of daily returns, scaled to a year. A higher number means bigger day-to-day moves." },
    { q: "Does a strong month in the past mean it will repeat?", a: "No. The monthly averages describe what happened over the years shown, and a few large years can dominate them. They are not a forecast." },
    { q: "How do I trade these in India?", a: "Gold, silver, copper, crude oil and natural gas trade as futures on MCX. Parasram offers MCX trading with a commodity account; see the MCX prices page and margin calculator." },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Commodity Research: Gold, Silver, Crude Oil Trends & Data"
        description="Gold, silver, copper, crude and natural gas in US dollars and on MCX in rupees: annualised returns, volatility, worst falls, seasonality and correlations."
        breadcrumbs={crumbs}
        faqItems={faq.map((f) => ({ question: f.q, answer: f.a }))}
        jsonLd={{
          "@type": "Dataset",
          name: "Ten-year commodity price statistics: gold, silver, copper, crude oil, natural gas",
          description: "Annualised returns, one-year volatility, maximum drawdown, monthly seasonality and correlations from daily closes of COMEX gold, silver and copper futures and EIA Brent, WTI and Henry Hub spot prices.",
          url: "https://www.sphpnp.com/commodity-research",
          ...(stats.last ? { dateModified: stats.last.trade_date, temporalCoverage: `${series[0].trade_date}/${stats.last.trade_date}` } : {}),
          isBasedOn: ["https://fred.stlouisfed.org/series/DCOILBRENTEU", "https://fred.stlouisfed.org/series/DCOILWTICO", "https://fred.stlouisfed.org/series/DHHNGSP"],
          creator: { "@type": "Organization", name: "Shri Parasram Holdings Pvt. Ltd.", url: "https://www.sphpnp.com" },
          license: "https://www.sphpnp.com/terms",
          isAccessibleForFree: true,
          variableMeasured: ["Annualised return", "Volatility", "Maximum drawdown", "Monthly average return", "Correlation"],
        }}
      />
      <Header />
      <VisibleBreadcrumbs items={crumbs} />
      <main className="container mx-auto px-4 py-8" data-list-state={main.isLoading ? "loading" : "ready"}>
        <PageHeader
          className="mb-8"
          eyebrow={<><Gem className="h-3.5 w-3.5" aria-hidden /> Commodities</>}
          title="Commodity research"
          description="Ten years of the commodities India trades on MCX, measured: returns, volatility, the worst falls, how each month has tended to go, and what each moves with."
        >
          {stats.last && <HeaderStat label="Last close" value={shortDate(stats.last.trade_date)} />}
        </PageHeader>

        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Market" className={segmentTrack}>
            <button type="button" aria-pressed={market === "intl"} className={segmentItem(market === "intl")} onClick={() => setMarket("intl")}>International, US$</button>
            <button type="button" aria-pressed={market === "mcx"} className={segmentItem(market === "mcx")} onClick={() => { setMarket("mcx"); if (!c.mcx) setPick("WTI.SPOT"); }}>MCX, ₹</button>
          </div>
          <div role="group" aria-label="Commodity" className={`${segmentTrack} max-w-full overflow-x-auto`}>
            {COMMODITIES.map((x) => {
              const off = market === "mcx" && !x.mcx;
              return <button key={x.ticker} type="button" disabled={off} title={off ? "Not traded on MCX" : undefined} aria-pressed={pick === x.ticker} className={`${segmentItem(pick === x.ticker)} disabled:cursor-not-allowed disabled:opacity-40`} onClick={() => setPick(x.ticker)}>{market === "mcx" && x.ticker === "WTI.SPOT" ? "Crude oil" : x.label}</button>;
            })}
          </div>
        </div>

        {main.isLoading ? <Skeleton className="mt-6 h-[32rem] w-full" /> : series.length < 2 ? (
          <div className="mt-6"><EmptyState text={`No stored history for ${c.label} yet; it fills in after the next morning's sync.`} /></div>
        ) : (
          <>
            {stats.last && stats.cagr[3].v !== null && stats.dd && (
              <p className="mt-5 max-w-3xl text-[0.9375rem] leading-relaxed text-muted-foreground">
                {c.label} returned {pct(stats.cagr[3].v)} a year over the {years} years to {shortDate(stats.last.trade_date)}, {onMcx ? "on MCX in rupees" : "in US dollars"}. Its worst fall in that time was {pct(stats.dd.pct)}, from {shortDate(stats.dd.peakDate)} to {shortDate(stats.dd.troughDate)}
                {stats.vol !== null && <>, and over the last year its daily swings came to {stats.vol.toFixed(1)}% a year</>}.
              </p>
            )}
            <section aria-labelledby="overview" className="mt-6 grid gap-4 lg:grid-cols-3">
              <h2 id="overview" className="sr-only">{c.label} at a glance</h2>
              <Card className="p-5">
                <p className="text-sm text-muted-foreground">{onMcx ? `MCX ${c.mcx === "CRUDEOIL" ? "crude oil" : c.label.toLowerCase()}` : c.label}, {unit}</p>
                <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight">{stats.last ? money(stats.last.close) : "—"}</p>
                {stats.range && <p className="mt-1 text-sm text-muted-foreground">52-week range {money(stats.range.low)} – {money(stats.range.high)}</p>}
                <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 text-sm">
                  {stats.cagr.map(({ y, v }) => (
                    <div key={y}><dt className="text-xs text-muted-foreground">{y === 1 ? "1 year" : `${y} years, annualised`}</dt><dd className={`font-semibold tabular-nums ${tone(v)}`}>{pct(v)}</dd></div>
                  ))}
                  <div><dt className="text-xs text-muted-foreground">Volatility, 1 year</dt><dd className="font-semibold tabular-nums">{stats.vol === null ? "—" : `${stats.vol.toFixed(1)}%`}</dd></div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Worst fall, {years} years</dt>
                    <dd className="font-semibold tabular-nums text-destructive">{stats.dd ? pct(stats.dd.pct) : "—"}</dd>
                    {stats.dd && <dd className="text-[11px] text-muted-foreground">{shortDate(stats.dd.peakDate)} to {shortDate(stats.dd.troughDate)}</dd>}
                  </div>
                </dl>
                <p className="mt-4 text-xs text-muted-foreground">{onMcx ? MCX_NOTE : c.note}</p>
              </Card>
              <Card className="min-w-0 p-4 sm:p-5 lg:col-span-2">
                <h3 className="font-semibold">{onMcx ? "MCX " : ""}{c.label} over {years} years</h3>
                <div className="mt-3 h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="cr-fill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART.primary} stopOpacity={0.25} />
                          <stop offset="100%" stopColor={CHART.primary} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke={CHART.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="trade_date" ticks={monthTicks(series.map((d) => d.trade_date), 6)} tick={axisTick} tickFormatter={yearLabel} tickLine={false} axisLine={false} />
                      <YAxis domain={["auto", "auto"]} tick={axisTick} tickFormatter={(v: number) => money(v)} width={70} tickLine={false} axisLine={false} />
                      <Tooltip {...tooltipStyle} labelFormatter={(iso: string) => shortDate(iso)} formatter={(v: number) => [money(v), c.label]} />
                      <Area dataKey="close" type="monotone" stroke={CHART.primary} strokeWidth={1.75} fill="url(#cr-fill)" isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </section>

            <section aria-labelledby="season" className="mt-10">
              <SectionHeading id="season" title="How each month has gone" subtitle={`Average return in each calendar month across the last ${years} years, and how many of those years it rose.`} />
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-12">
                {stats.season.map((m) => (
                  <div key={m.month} className="rounded-md px-2 py-3 text-center" style={{ background: m.avg === null ? undefined : divergingFill(heatStep(m.avg, MONTH_CUTS)) }}>
                    {/* Page text, not muted grey: grey on the tinted cells measured 3.1:1. */}
                    <div className="text-xs font-semibold text-foreground">{MONTHS[m.month]}</div>
                    <div className="mt-1 text-sm font-semibold tabular-nums">{pct(m.avg)}</div>
                    <div className="text-[11px] text-foreground">{m.up} of {m.years} up</div>
                  </div>
                ))}
              </div>
            </section>

            <section aria-labelledby="moves" className="mt-10">
              <SectionHeading id="moves" title="What it moves with" subtitle="Correlation of daily returns over the last year: +1 moves in step, 0 unrelated, −1 opposite." />
              <Card className="mt-4 overflow-hidden p-0">
                <table className="w-full text-sm">
                  <tbody>
                    {corr.map((p) => (
                      <tr key={p.ticker} className="border-t first:border-t-0">
                        <th scope="row" className="px-5 py-3 text-left font-normal">{p.label}</th>
                        <td className="w-1/2 px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative h-1.5 flex-1 rounded-full bg-muted" aria-hidden>
                              <span className="absolute top-1/2 h-3 w-1 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-foreground/70" style={{ left: `${p.v === null ? 50 : ((p.v + 1) / 2) * 100}%` }} />
                              <span className="absolute left-1/2 top-0 h-full w-px bg-border" />
                            </div>
                            <span className="w-12 text-right font-semibold tabular-nums">{p.v === null ? "—" : p.v.toFixed(2)}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </section>
          </>
        )}

        <p className="mt-8 text-xs text-muted-foreground">
          End-of-day closes in US dollars from Yahoo Finance (COMEX futures) and the US EIA via FRED (spot energy); MCX series in rupees from MCX's own bhavcopy and market watch. Past behaviour, not a forecast or investment advice. See <Link to="/commodities" className="underline underline-offset-4 hover:text-secondary">MCX prices today</Link> and the <Link to="/margin-calculator" className="underline underline-offset-4 hover:text-secondary">MCX margin calculator</Link>.
        </p>
      </main>
      <FAQ title="Commodity research: common questions" subtitle="About the measures on this page." items={faq} />
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
