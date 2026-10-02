import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ExternalLink, Globe2 } from "lucide-react";
import Header from "@/components/Header";
import PageHeader from "@/components/PageHeader";
import Footer from "@/components/Footer";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import SEOHead from "@/components/SEOHead";
import WhatsAppButton from "@/components/WhatsAppButton";
import FAQ from "@/components/FAQ";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { segmentItem, segmentTrack } from "@/components/ui/segmented";
import WorldMarketsSection from "@/components/markets/WorldMarketsSection";
import GlobalCuesSection from "@/components/markets/GlobalCuesSection";
import { CHART, EmptyState, SectionHeading, axisTick, tooltipStyle } from "@/components/markets/chart-kit";
import { GLOBAL_TICKERS } from "../../supabase/functions/_shared/eodhd";
import { globalHistory, shortDate } from "@/lib/market-data";
import { annualised, monthTicks } from "@/lib/index-performance";
import { INXGA_BANK_GUIDES, INXGA_CHARGES, INXGA_CHECKED_ON, INXGA_CONTACT, INXGA_LINKS, INXGA_MEMBER_PAGE } from "@/lib/global-access";

const RANGES = [{ key: "1Y", years: 1 }, { key: "5Y", years: 5 }, { key: "10Y", years: 10 }] as const;
type RangeKey = (typeof RANGES)[number]["key"];
// Gold and silver are stored from Sep 2025 only, so they have no long-run view.
const LONG_RUN = GLOBAL_TICKERS.filter((t) => !t.ticker.startsWith("XA"));

const yearLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
const level = (v: number, unit: string) =>
  unit === "percent" ? `${v.toFixed(2)}%` : unit === "rupees" ? `₹${v.toFixed(2)}` : `${unit === "dollars" ? "$" : ""}${v.toLocaleString("en-US", { maximumFractionDigits: v < 100 ? 2 : 0 })}`;
const pct = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);
const tone = (v: number | null) => (v === null ? "text-muted-foreground" : v >= 0 ? "text-secondary" : "text-destructive");
const yearsAgo = (years: number) => new Date(Date.now() - years * 365.25 * 86_400_000).toISOString().slice(0, 10);

/** Ten years of one market, with its annualised return over 1, 3, 5 and 10 years. */
function LongRunChart() {
  const [ticker, setTicker] = useState("GSPC.INDX");
  const [range, setRange] = useState<RangeKey>("5Y");
  const pick = LONG_RUN.find((t) => t.ticker === ticker) ?? LONG_RUN[0];
  const history = useQuery({ queryKey: ["global-history", ticker], queryFn: () => globalHistory(ticker, yearsAgo(10.1)), staleTime: 6 * 60 * 60_000 });
  const all = useMemo(() => (history.data ?? []).map((b) => ({ trade_date: b.trade_date, close: b.close })), [history.data]);
  const shown = useMemo(() => {
    const cutoff = yearsAgo(RANGES.find((r) => r.key === range)!.years);
    return all.filter((b) => b.trade_date >= cutoff);
  }, [all, range]);
  // Rates are levels, not prices: a "return" on a yield would mislead.
  const isRate = pick.unit === "percent";
  const cagr = isRate ? [] : [1, 3, 5, 10].map((y) => ({ years: y, pct: annualised(all, y) }));

  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Market</span>
          <select value={ticker} onChange={(e) => setTicker(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm font-medium">
            {LONG_RUN.map((t) => <option key={t.ticker} value={t.ticker}>{t.name}</option>)}
          </select>
        </label>
        <div role="group" aria-label="Chart range" className={segmentTrack}>
          {RANGES.map((r) => (
            <button key={r.key} type="button" aria-pressed={range === r.key} className={segmentItem(range === r.key)} onClick={() => setRange(r.key)}>{r.key}</button>
          ))}
        </div>
      </div>
      {history.isLoading ? <Skeleton className="mt-4 h-72 w-full" /> : shown.length < 2 ? (
        <div className="mt-4"><EmptyState text={`No stored history for ${pick.name} yet.`} /></div>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted-foreground">
            <span className="text-2xl font-bold tabular-nums text-foreground">{level(shown[shown.length - 1].close, pick.unit)}</span>
            <span className="ml-2">close {shortDate(shown[shown.length - 1].trade_date)}</span>
          </p>
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={shown} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="global-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART.primary} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={CHART.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={CHART.grid} strokeDasharray="3 3" />
                <XAxis dataKey="trade_date" ticks={monthTicks(shown.map((d) => d.trade_date))} tick={axisTick} tickFormatter={yearLabel} tickLine={false} axisLine={false} />
                <YAxis domain={["auto", "auto"]} tick={axisTick} tickFormatter={(v: number) => level(v, pick.unit)} width={72} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle} labelFormatter={(iso: string) => shortDate(iso)} formatter={(v: number) => [level(v, pick.unit), pick.name]} />
                <Area dataKey="close" type="monotone" stroke={CHART.primary} strokeWidth={2} fill="url(#global-fill)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {cagr.length > 0 && (
            <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Annualised returns">
              {cagr.map((c) => (
                <li key={c.years} className="rounded-md border px-3 py-2 text-center">
                  <span className="block text-[0.6875rem] text-muted-foreground">{c.years === 1 ? "1 year" : `${c.years} years, annualised`}</span>
                  <span className={`block text-sm font-semibold tabular-nums ${tone(c.pct)}`}>{pct(c.pct)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted-foreground">In the market's own currency, before dividends. Past returns say nothing certain about future ones.</p>
        </>
      )}
    </Card>
  );
}

/** Investing abroad through India INX Global Access, with Parasram as the referrer. */
function InvestAbroad() {
  return (
    <section aria-labelledby="invest-abroad" className="mt-14 scroll-mt-28" id="invest-abroad">
      <SectionHeading id="invest-abroad" title="Invest in US stocks and ETFs from India" subtitle="Through India INX Global Access in GIFT City, regulated by IFSCA. Parasram refers you; the international broker holds your account." />
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card className="p-5">
          <ol className="space-y-4">
            {[
              { title: "Open your account and complete KYC", body: <>Online and paperless, with DigiLocker KYC for resident Indians. Guides for <a className="underline underline-offset-4 hover:text-secondary" href={INXGA_LINKS.residentManual} target="_blank" rel="noopener noreferrer">residents</a> and <a className="underline underline-offset-4 hover:text-secondary" href={INXGA_LINKS.nriManual} target="_blank" rel="noopener noreferrer">non-residents</a>.</> },
              { title: "Fund it from your Indian bank under LRS", body: <>Any bank that allows foreign remittance under the Liberalised Remittance Scheme, or Form A2 at a branch with purpose code S0001. <a className="underline underline-offset-4 hover:text-secondary" href={INXGA_LINKS.funding} target="_blank" rel="noopener noreferrer">Beneficiary details</a>; guides for {INXGA_BANK_GUIDES.map((g, i) => <span key={g.bank}>{i > 0 && ", "}<a className="underline underline-offset-4 hover:text-secondary" href={g.href} target="_blank" rel="noopener noreferrer">{g.bank}</a></span>)}.</> },
              { title: "Trade on the app or in the browser", body: <>Free platforms, US stocks and ETFs, including fractional shares. Apps for <a className="underline underline-offset-4 hover:text-secondary" href={INXGA_LINKS.android} target="_blank" rel="noopener noreferrer">Android</a> and <a className="underline underline-offset-4 hover:text-secondary" href={INXGA_LINKS.ios} target="_blank" rel="noopener noreferrer">iOS</a>.</> },
            ].map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-sm font-bold text-secondary">{i + 1}</span>
                <div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
              <a href={INXGA_MEMBER_PAGE} target="_blank" rel="noopener noreferrer">Open a global account with Parasram <ExternalLink className="ml-1.5 h-4 w-4" aria-hidden /></a>
            </Button>
            <Button asChild variant="outline">
              <a href={INXGA_LINKS.login} target="_blank" rel="noopener noreferrer">Log in</a>
            </Button>
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <caption className="px-5 pb-1 pt-4 text-left font-semibold">Charges</caption>
            <tbody>
              {INXGA_CHARGES.map((c) => (
                <tr key={c.item} className="border-t first:border-t-0">
                  <th scope="row" className="px-5 py-2.5 text-left font-normal text-muted-foreground">{c.item}</th>
                  <td className="px-5 py-2.5 text-right font-medium">{c.charge}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t px-5 py-3 text-xs text-muted-foreground">
            As published on <a className="underline underline-offset-4 hover:text-foreground" href={INXGA_MEMBER_PAGE} target="_blank" rel="noopener noreferrer">Parasram's India INX GA page</a>, checked {INXGA_CHECKED_ON}. Event-specific charges may apply separately.
          </p>
        </Card>
      </div>

      <div className="mt-5 rounded-lg border border-border bg-muted/40 p-5 text-sm leading-relaxed">
        <h3 className="font-semibold">Before you invest abroad</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Shri Parasram Holdings acts only as a referrer. India INX GA introduces you to an international broker such as Interactive Brokers or ViewTrade IFSC, which holds your funds and securities and executes your orders.</li>
          <li>Indian and GIFT City investor protection funds, exchange dispute resolution and grievance redressal do not cover these accounts.</li>
          <li>Orders are your own decisions; neither Parasram nor India INX GA gives investment advice on global products. Tax applies as per your jurisdiction.</li>
        </ul>
        <p className="mt-3 text-muted-foreground">
          Questions: <a className="font-medium text-foreground underline underline-offset-4" href={`tel:${INXGA_CONTACT.phone.replace(/-/g, "")}`}>{INXGA_CONTACT.phone}</a>, <a className="font-medium text-foreground underline underline-offset-4" href={`tel:+91${INXGA_CONTACT.mobile}`}>{INXGA_CONTACT.mobile}</a> or <a className="font-medium text-foreground underline underline-offset-4" href={`mailto:${INXGA_CONTACT.email}`}>{INXGA_CONTACT.email}</a>. <a className="underline underline-offset-4 hover:text-foreground" href={INXGA_LINKS.faq} target="_blank" rel="noopener noreferrer">India INX GA FAQ</a>.
        </p>
      </div>
    </section>
  );
}

/**
 * /global-markets: world indices by region (local or dollar returns), the
 * rates, currencies and commodities an Indian desk watches, a ten-year chart,
 * and how a Parasram client invests abroad.
 */
export default function GlobalMarketsPage() {
  const crumbs = [{ name: "Home", url: "/" }, { name: "Markets", url: "/market-pulse" }, { name: "Global markets" }];
  const faq = [
    { q: "How can I invest in US stocks from India?", a: "Through India INX Global Access in GIFT City: open an account online through Parasram's referral link, fund it from your Indian bank under the Liberalised Remittance Scheme, and trade US stocks and ETFs on its app or browser platform. The international broker holds the account." },
    { q: "What does it cost?", a: "No monthly charge; brokerage of 0.25% of trade value with a minimum of USD 1 per executed order on US-listed stocks and ETFs; withdrawals free for resident Indians and USD 10 for non-residents; plus small regulatory fees and GST for residents." },
    { q: "Why look at world markets before the Indian open?", a: "US markets close after India does, and Asian markets open before it, so their moves, the dollar, US yields and oil are the overnight news an Indian session opens on." },
    { q: "Are these prices live?", a: "No. They are the latest closes, collected each morning, and the world board refreshes through the day. They are for information, not trading." },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Global Markets Today: World Indices, Dollar, Oil and Yields"
        description="World stock indices by region in local or dollar terms, US yields, the rupee, oil and gold, ten-year charts, and how to invest in US stocks from India."
        breadcrumbs={crumbs}
        faqItems={faq.map((f) => ({ question: f.q, answer: f.a }))}
      />
      <Header />
      <VisibleBreadcrumbs items={crumbs} />
      <main className="container mx-auto px-4 py-8" data-list-state="ready">
        <PageHeader
          className="mb-8"
          eyebrow={<><Globe2 className="h-3.5 w-3.5" aria-hidden /> Markets</>}
          title="Global markets today"
          description="How the world's stock markets, the dollar, US yields, oil and gold closed, and how to invest in US stocks from India."
        >
          <Button asChild variant="outline" size="sm"><a href="#invest-abroad">Invest abroad</a></Button>
        </PageHeader>

        <WorldMarketsSection />

        <div className="mt-12"><GlobalCuesSection /></div>

        <section aria-labelledby="long-run" className="mt-12">
          <SectionHeading id="long-run" title="The long run" subtitle="Up to ten years of daily closes, with the annualised change." />
          <div className="mt-4"><LongRunChart /></div>
        </section>

        <InvestAbroad />

        <p className="mt-8 text-xs text-muted-foreground">
          Index and price data from Yahoo Finance, EODHD and FRED. Market data, not investment advice. See also <Link to="/indices" className="underline underline-offset-4 hover:text-secondary">NSE indices</Link> and <Link to="/commodities" className="underline underline-offset-4 hover:text-secondary">commodities</Link>.
        </p>
      </main>
      <FAQ title="Global markets: common questions" subtitle="Answered from the figures and terms on this page." items={faq} />
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
