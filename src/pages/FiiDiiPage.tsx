import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Landmark } from "lucide-react";
import Header from "@/components/Header";
import PageHeader, { HeaderStat } from "@/components/PageHeader";
import Footer from "@/components/Footer";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import SEOHead from "@/components/SEOHead";
import WhatsAppButton from "@/components/WhatsAppButton";
import FAQ from "@/components/FAQ";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CHART, EmptyState, SectionHeading, axisTick, tooltipStyle } from "@/components/markets/chart-kit";
import { fiiIndexFutures, flowHistory, shortDate } from "@/lib/market-data";
import { fiiIndexLongShare, monthlyTotals, netOver, streak, toSessions, type Side } from "@/lib/fii-dii";
import { monthTicks } from "@/lib/index-performance";
import FiiDerivativesSection from "@/components/markets/FiiDerivativesSection";

const DAY_MS = 86_400_000;
const isoDaysAgo = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10);
const CHART_SESSIONS = 60;
const WINDOWS = [5, 20, 60] as const;

const crore = (v: number) => `₹${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr`;
const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${crore(v)}`;
const tone = (v: number) => (v > 0 ? "text-secondary" : v < 0 ? "text-destructive" : "text-muted-foreground");
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const role = (net: number) => (net >= 0 ? "net buyers" : "net sellers");

function streakText(n: number, who: string) {
  if (n === 0) return null;
  const sessions = Math.abs(n);
  return `${who} have been ${n > 0 ? "net buyers" : "net sellers"} ${sessions === 1 ? "in the latest session" : `for ${sessions} sessions in a row`}.`;
}

function SideCard({ title, sub, side, streakLine }: { title: string; sub: string; side: Side | null; streakLine: string | null }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
      {side ? (
        <>
          <p className={`mt-3 text-3xl font-bold tabular-nums tracking-tight ${tone(side.net)}`}>{signed(side.net)}</p>
          <p className="text-xs text-muted-foreground">Net, {role(side.net)}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-3 text-sm">
            <div><dt className="text-xs text-muted-foreground">Bought</dt><dd className="font-semibold tabular-nums">{crore(side.buy)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Sold</dt><dd className="font-semibold tabular-nums">{crore(side.sell)}</dd></div>
          </dl>
          {streakLine && <p className="mt-3 text-xs text-muted-foreground">{streakLine}</p>}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Not published for this session.</p>
      )}
    </Card>
  );
}

/**
 * /fii-dii-data: NSE's provisional FII and DII cash-market buying and selling,
 * as stored each evening, with rolling and monthly totals, and FII positioning
 * in index futures from the participant-wise open interest.
 */
export default function FiiDiiPage() {
  const flows = useQuery({ queryKey: ["fii-dii-history"], queryFn: () => flowHistory(isoDaysAgo(800)), staleTime: 30 * 60_000 });
  const oi = useQuery({ queryKey: ["fii-index-futures"], queryFn: () => fiiIndexFutures(isoDaysAgo(400)), staleTime: 60 * 60_000 });

  const sessions = useMemo(() => toSessions(flows.data ?? []), [flows.data]);
  const latest = sessions[0];
  const months = useMemo(() => monthlyTotals(sessions), [sessions]);
  const windows = WINDOWS.map((n) => ({ n, ...netOver(sessions, n) })).filter((w) => w.sessions === w.n);
  const chart = useMemo(() => sessions.slice(0, CHART_SESSIONS).reverse().map((s) => ({ date: s.date, FII: s.fii?.net ?? null, DII: s.dii?.net ?? null })), [sessions]);
  const longShare = useMemo(() => fiiIndexLongShare(oi.data ?? []), [oi.data]);
  const lastLong = longShare.at(-1);
  const twenty = netOver(sessions, 20);

  const crumbs = [{ name: "Home", url: "/" }, { name: "Market Pulse", url: "/market-pulse" }, { name: "FII & DII data" }];
  const faq = [
    { q: "What is FII and DII data?", a: "The value of Indian shares that foreign institutional investors (FIIs, now registered as foreign portfolio investors) and domestic institutional investors (DIIs: mutual funds, insurers, banks and pension funds) bought and sold in the cash market on a trading day, and the difference, their net buying or selling." },
    { q: "When is FII DII data released?", a: "NSE publishes provisional figures for the day's trading on NSE, BSE and MSEI each trading evening, usually between 6 and 8 pm IST. This page stores them as they are published; final FPI figures from NSDL can differ slightly." },
    { q: "What does net selling by FIIs mean?", a: "That foreign institutions sold more Indian shares than they bought that day. It describes flows, not where prices go next: domestic institutions are often on the other side, and the two can offset each other." },
    { q: "What is the FII long share in index futures?", a: "FII long contracts as a share of all their open index-futures positions, from NSE's participant-wise open interest. Above 50% they hold more long than short index futures; below 50%, more short." },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="FII DII Data Today: FII & DII Buy, Sell and Net Flows"
        description="Daily FII and DII buying and selling in Indian shares from NSE's provisional data, with 5, 20 and 60-session totals, monthly flows and FII futures."
        breadcrumbs={crumbs}
        faqItems={faq.map((f) => ({ question: f.q, answer: f.a }))}
        jsonLd={{
          "@type": "Dataset",
          name: "FII and DII cash market activity in India",
          description: "Daily gross buying, selling and net value of Indian equities traded by foreign and domestic institutional investors, from NSE's provisional figures, with FII index-futures open interest.",
          url: "https://www.sphpnp.com/fii-dii-data",
          ...(latest ? { dateModified: latest.date, temporalCoverage: `${sessions[sessions.length - 1].date}/${latest.date}` } : {}),
          isBasedOn: "https://www.nseindia.com/reports/fii-dii",
          creator: { "@type": "Organization", name: "Shri Parasram Holdings Pvt. Ltd.", url: "https://www.sphpnp.com" },
          spatialCoverage: "India",
          variableMeasured: ["FII gross purchase", "FII gross sales", "FII net", "DII gross purchase", "DII gross sales", "DII net", "FII index futures long share"],
        }}
      />
      <Header />
      <VisibleBreadcrumbs items={crumbs} />
      <main className="container mx-auto px-4 py-8" data-list-state={flows.isLoading ? "loading" : "ready"}>
        <PageHeader
          className="mb-6"
          eyebrow={<><Landmark className="h-3.5 w-3.5" aria-hidden /> Institutional flows</>}
          title="FII & DII data"
          description="What foreign and domestic institutions bought and sold in Indian shares each trading day, from NSE's provisional figures, kept as a running history."
        >
          {latest && <HeaderStat label="Latest session" value={shortDate(latest.date)} />}
          {sessions.length > 0 && <HeaderStat label="Sessions stored" value={sessions.length} />}
        </PageHeader>

        {flows.isLoading ? <Skeleton className="h-96 w-full" /> : !latest ? (
          <EmptyState text="FII and DII figures are not available right now. They are published each trading evening." />
        ) : (
          <>
            <p className="max-w-3xl text-[0.9375rem] leading-relaxed text-muted-foreground">
              On {shortDate(latest.date)}, {latest.fii && <>foreign institutional investors were {role(latest.fii.net)} of {crore(latest.fii.net)} in Indian equities</>}
              {latest.fii && latest.dii && " and "}
              {latest.dii && <>domestic institutions {role(latest.dii.net)} of {crore(latest.dii.net)}</>} (NSE provisional, NSE, BSE and MSEI combined).
              {twenty.sessions === 20 && <> Over the last 20 sessions FIIs were {role(twenty.fii)} of {crore(twenty.fii)} and DIIs {role(twenty.dii)} of {crore(twenty.dii)}.</>}
            </p>

            <section aria-labelledby="latest" className="mt-6">
              <h2 id="latest" className="sr-only">Latest session</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <SideCard title="Foreign institutions (FII / FPI)" sub={`Cash market, ${shortDate(latest.date)}`} side={latest.fii} streakLine={streakText(streak(sessions, "fii"), "FIIs")} />
                <SideCard title="Domestic institutions (DII)" sub={`Cash market, ${shortDate(latest.date)}`} side={latest.dii} streakLine={streakText(streak(sessions, "dii"), "DIIs")} />
                {windows.length > 0 && (
                  <Card className="p-5 md:col-span-2 lg:col-span-1">
                    <p className="text-sm font-medium">Net over recent sessions</p>
                    <table className="mt-3 w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground">
                          <th scope="col" className="pb-2 font-medium">Sessions</th>
                          <th scope="col" className="pb-2 text-right font-medium">FII</th>
                          <th scope="col" className="pb-2 text-right font-medium">DII</th>
                        </tr>
                      </thead>
                      <tbody>
                        {windows.map((w) => (
                          <tr key={w.n} className="border-t">
                            <th scope="row" className="py-2 text-left font-normal">Last {w.n}</th>
                            <td className={`py-2 text-right font-semibold tabular-nums ${tone(w.fii)}`}>{signed(w.fii)}</td>
                            <td className={`py-2 text-right font-semibold tabular-nums ${tone(w.dii)}`}>{signed(w.dii)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                )}
              </div>
            </section>

            <section aria-labelledby="trend" className="mt-10">
              <SectionHeading id="trend" title="Daily net flows" subtitle={`FII and DII net buying (above zero) or selling (below), last ${chart.length} sessions, ₹ crore.`} />
              <Card className="mt-4 min-w-0 p-4 sm:p-5">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={1}>
                      <CartesianGrid vertical={false} stroke={CHART.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="date" ticks={monthTicks(chart.map((d) => d.date), 4)} tick={axisTick} tickFormatter={dayLabel} tickLine={false} axisLine={false} />
                      <YAxis tick={axisTick} tickFormatter={(v: number) => `${(v / 1000).toLocaleString("en-IN")}k`} width={44} tickLine={false} axisLine={false} />
                      <ReferenceLine y={0} stroke={CHART.axis} />
                      <Tooltip {...tooltipStyle} labelFormatter={(iso: string) => shortDate(iso)} formatter={(v: number, name: string) => [signed(v), name]} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="FII" fill={CHART.series[0]} isAnimationActive={false} />
                      <Bar dataKey="DII" fill={CHART.series[1]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </section>

            <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
              <section aria-labelledby="monthly" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
                <SectionHeading id="monthly" title="By month" subtitle="Net buying or selling in each calendar month." />
                <Card className="mt-4 overflow-hidden p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-4 py-2.5 text-left font-medium">Month</th>
                        <th scope="col" className="px-4 py-2.5 text-right font-medium">FII net</th>
                        <th scope="col" className="px-4 py-2.5 text-right font-medium">DII net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {months.map((m) => (
                        <tr key={m.month} className="border-t">
                          <th scope="row" className="px-4 py-2.5 text-left font-normal">{monthLabel(m.month)}<span className="block text-[11px] text-muted-foreground">{m.sessions} session{m.sessions === 1 ? "" : "s"}</span></th>
                          <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${tone(m.fii)}`}>{signed(m.fii)}</td>
                          <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${tone(m.dii)}`}>{signed(m.dii)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </section>

              <section aria-labelledby="daily" className="min-w-0">
                <SectionHeading id="daily" title="Every session" subtitle="Gross buying and selling, and the net, ₹ crore." />
                <Card className="mt-4 max-h-[34rem] overflow-auto p-0 [contain:paint]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-muted text-xs text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-3 py-2.5 text-left font-medium">Date</th>
                        <th scope="col" className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">FII buy</th>
                        <th scope="col" className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">FII sell</th>
                        <th scope="col" className="px-3 py-2.5 text-right font-medium">FII net</th>
                        <th scope="col" className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">DII buy</th>
                        <th scope="col" className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">DII sell</th>
                        <th scope="col" className="px-3 py-2.5 text-right font-medium">DII net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((s) => (
                        <tr key={s.date} className="border-t">
                          <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-normal">{shortDate(s.date)}</th>
                          <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">{s.fii ? crore(s.fii.buy) : "—"}</td>
                          <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">{s.fii ? crore(s.fii.sell) : "—"}</td>
                          <td className={`px-3 py-2 text-right font-semibold tabular-nums ${s.fii ? tone(s.fii.net) : ""}`}>{s.fii ? signed(s.fii.net) : "—"}</td>
                          <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">{s.dii ? crore(s.dii.buy) : "—"}</td>
                          <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">{s.dii ? crore(s.dii.sell) : "—"}</td>
                          <td className={`px-3 py-2 text-right font-semibold tabular-nums ${s.dii ? tone(s.dii.net) : ""}`}>{s.dii ? signed(s.dii.net) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </section>
            </div>
          </>
        )}

        <FiiDerivativesSection />

        {longShare.length > 1 && lastLong && (
          <section aria-labelledby="futures" className="mt-10">
            <SectionHeading id="futures" title="FII positions in index futures" subtitle="FII long contracts as a share of their index-futures open interest, from NSE's participant-wise data." />
            <div className="mt-4 grid gap-4 lg:grid-cols-[18rem_1fr]">
              <Card className="p-5">
                <p className="text-sm text-muted-foreground">Long share, {shortDate(lastLong.date)}</p>
                <p className="mt-1 text-3xl font-bold tabular-nums">{lastLong.longPct.toFixed(1)}%</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-3 text-sm">
                  <div><dt className="text-xs text-muted-foreground">Long contracts</dt><dd className="font-semibold tabular-nums">{lastLong.long.toLocaleString("en-IN")}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Short contracts</dt><dd className="font-semibold tabular-nums">{lastLong.short.toLocaleString("en-IN")}</dd></div>
                </dl>
              </Card>
              <Card className="min-w-0 p-4 sm:p-5">
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={longShare} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <CartesianGrid vertical={false} stroke={CHART.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="date" ticks={monthTicks(longShare.map((d) => d.date), 6)} tick={axisTick} tickFormatter={(iso: string) => monthLabel(iso.slice(0, 7))} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 100]} tick={axisTick} tickFormatter={(v: number) => `${v}%`} width={40} tickLine={false} axisLine={false} />
                      <ReferenceLine y={50} stroke={CHART.axis} strokeDasharray="4 4" />
                      <Tooltip {...tooltipStyle} labelFormatter={(iso: string) => shortDate(iso)} formatter={(v: number) => [`${v.toFixed(1)}%`, "FII long share"]} />
                      <Line dataKey="longPct" type="monotone" stroke={CHART.primary} strokeWidth={1.75} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          </section>
        )}

        <p className="mt-8 text-xs text-muted-foreground">
          Provisional figures published by NSE for NSE, BSE and MSEI combined, stored as released; participant-wise open interest from NSE's end-of-day files. Flows describe what happened, not where prices go next. See also <Link to="/market-pulse" className="underline underline-offset-4 hover:text-secondary">Market Pulse</Link> and the <Link to="/fno" className="underline underline-offset-4 hover:text-secondary">F&amp;O dashboard</Link>.
        </p>
      </main>
      <FAQ title="FII and DII data: common questions" subtitle="About the figures on this page." items={faq} />
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
