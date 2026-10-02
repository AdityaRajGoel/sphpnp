import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ExternalLink, PieChart, Search } from "lucide-react";
import Header from "@/components/Header";
import PageHeader, { HeaderStat } from "@/components/PageHeader";
import Footer from "@/components/Footer";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import SEOHead from "@/components/SEOHead";
import WhatsAppButton from "@/components/WhatsAppButton";
import FAQ from "@/components/FAQ";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { segmentItem, segmentTrack } from "@/components/ui/segmented";
import { shortDate } from "@/lib/market-data";
import { MF_GROUPS, cleanFundName, loadSchemes, median, normalizeCategory, type MfGroup, type MfScheme } from "@/lib/mutual-funds";

const PARASRAM_MF = "https://parasrammf.com";
const ARN = "ARN-35616";
type SortKey = "ret_1m" | "ret_6m" | "ret_1y" | "ret_3y" | "ret_5y";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "ret_1m", label: "1M" }, { key: "ret_6m", label: "6M" }, { key: "ret_1y", label: "1Y" }, { key: "ret_3y", label: "3Y" }, { key: "ret_5y", label: "5Y" },
];
const PAGE = 50;

const pct = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);
const tone = (v: number | null) => (v === null ? "text-muted-foreground" : v >= 0 ? "text-secondary" : "text-destructive");

/**
 * /mutual-funds: every open-ended growth scheme from AMFI's daily files, by
 * category, with returns over a month to five years, and investing through
 * Parasram's mutual fund platform. Returns are NAV-based: absolute up to a
 * year, annualised beyond.
 */
export default function MutualFundsPage() {
  const [plan, setPlan] = useState<"direct" | "regular">("direct");
  const [group, setGroup] = useState<MfGroup>("Equity");
  const [category, setCategory] = useState("Flexi Cap");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("ret_3y");
  const [shown, setShown] = useState(PAGE);
  const schemes = useQuery({ queryKey: ["mf-schemes", plan], queryFn: () => loadSchemes(plan), staleTime: 60 * 60_000 });

  const tagged = useMemo(() => (schemes.data ?? []).map((s) => ({ ...s, cat: normalizeCategory(s.category), name: cleanFundName(s.scheme_name) })), [schemes.data]);
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of tagged) if (s.cat.group === group) counts.set(s.cat.name, (counts.get(s.cat.name) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [tagged, group]);
  const activeCategory = categories.some(([c]) => c === category) ? category : categories[0]?.[0] ?? "";

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? tagged.filter((s) => s.name.toLowerCase().includes(q) || (s.amc ?? "").toLowerCase().includes(q))
      : tagged.filter((s) => s.cat.group === group && s.cat.name === activeCategory);
    return [...list].sort((a, b) => (b[sort] ?? -Infinity) - (a[sort] ?? -Infinity) || a.name.localeCompare(b.name));
  }, [tagged, query, group, activeCategory, sort]);

  // The most common NAV date, not the latest: overnight funds publish NAVs dated
  // ahead over a weekend, which made the page read "as of" a future day.
  const navDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of tagged) counts.set(s.nav_date, (counts.get(s.nav_date) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  }, [tagged]);
  const summary = { count: rows.length, m1y: median(rows.map((r) => r.ret_1y)), m3y: median(rows.map((r) => r.ret_3y)), m5y: median(rows.map((r) => r.ret_5y)) };
  const crumbs = [{ name: "Home", url: "/" }, { name: "Mutual funds" }];
  const faq = [
    { q: "Where does this data come from?", a: "AMFI, the Association of Mutual Funds in India: its daily NAV file for every scheme, and its NAV history report for the NAVs used to work out returns. It covers open-ended schemes in their growth option." },
    { q: "How are the returns worked out?", a: "From NAVs only: the change in NAV up to one year, and the compound annual return over three and five years. They are before tax and exit loads, and include the scheme's expenses, which is why direct plans show higher returns than regular plans of the same fund." },
    { q: "What is the difference between direct and regular plans?", a: "The same portfolio, with a lower expense ratio in the direct plan because no distributor commission is paid. Regular plans pay the distributor, who in return helps you choose and service your investments. Parasram's published trail commission, paid by the fund house from the scheme's expenses, is 0.60% to 1.30% a year on equity and hybrid funds, 0.10% to 0.60% on debt funds and 0.05% to 0.50% on liquid funds." },
    { q: "How do I invest through Parasram?", a: `Through Parasram's mutual fund platform at parasrammf.com or its app. Shri Parasram Holdings is an AMFI-registered mutual fund distributor, ${ARN}.` },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Mutual Fund Returns India: Compare Funds by Category"
        description="Every open-ended mutual fund by category, with 1-month to 5-year returns from AMFI's daily NAVs. Compare large cap, flexi cap, ELSS, debt and index funds."
        breadcrumbs={crumbs}
        faqItems={faq.map((f) => ({ question: f.q, answer: f.a }))}
      />
      <Header />
      <VisibleBreadcrumbs items={crumbs} />
      <main className="container mx-auto px-4 py-8" data-list-state={schemes.isLoading ? "loading" : "ready"}>
        <PageHeader
          className="mb-8"
          eyebrow={<><PieChart className="h-3.5 w-3.5" aria-hidden /> Mutual funds</>}
          title="Mutual fund research"
          description="Every open-ended scheme, grouped by SEBI category, with returns from AMFI's daily NAVs. Compare funds here; invest through Parasram's mutual fund platform."
        >
          {navDate && <HeaderStat label="NAVs as of" value={shortDate(navDate)} />}
          {tagged.length > 0 && <HeaderStat label={`${plan === "direct" ? "Direct" : "Regular"} plans`} value={tagged.length.toLocaleString("en-IN")} />}
        </PageHeader>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div role="group" aria-label="Fund group" className={`${segmentTrack} max-w-full overflow-x-auto`}>
            {MF_GROUPS.filter((g) => g !== "Other").map((g) => (
              <button key={g} type="button" aria-pressed={!query && group === g} className={segmentItem(!query && group === g)} onClick={() => { setGroup(g); setQuery(""); setShown(PAGE); }}>{g}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div role="group" aria-label="Plan" className={segmentTrack}>
              {(["direct", "regular"] as const).map((p) => (
                <button key={p} type="button" aria-pressed={plan === p} className={segmentItem(plan === p)} onClick={() => setPlan(p)}>{p === "direct" ? "Direct" : "Regular"}</button>
              ))}
            </div>
            <label className="relative">
              <span className="sr-only">Search funds or fund houses</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }} placeholder="Search a fund or fund house" className="h-9 w-64 max-w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm" />
            </label>
          </div>
        </div>

        {!query && (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Categories">
            {categories.map(([c, n]) => (
              <li key={c}>
                <button type="button" aria-pressed={activeCategory === c} onClick={() => { setCategory(c); setShown(PAGE); }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${activeCategory === c ? "border-secondary bg-secondary/10 text-secondary" : "border-border text-muted-foreground hover:border-secondary/40 hover:text-foreground"}`}>
                  {c} <span className="tabular-nums opacity-70">{n}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <section aria-labelledby="funds" className="mt-6">
          <h2 id="funds" className="sr-only">{query ? `Funds matching ${query}` : `${activeCategory} funds`}</h2>
          {schemes.isLoading ? <Skeleton className="h-96 w-full" /> : schemes.isError ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">Fund data could not be loaded. Please try again shortly.</Card>
          ) : (
            <>
              <dl className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[["Funds", summary.count.toLocaleString("en-IN")], ["Median 1-year return", pct(summary.m1y)], ["Median 3-year, annualised", pct(summary.m3y)], ["Median 5-year, annualised", pct(summary.m5y)]].map(([k, v]) => (
                  <div key={k} className="rounded-lg border bg-card px-4 py-3">
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
              {/* Phones see one return column, the one sorted on; this picks it. */}
              <div role="group" aria-label="Sort by" className={`${segmentTrack} mb-3 sm:hidden`}>
                {SORTS.map((s) => <button key={s.key} type="button" aria-pressed={sort === s.key} className={segmentItem(sort === s.key)} onClick={() => setSort(s.key)}>{s.label}</button>)}
              </div>
              <Card className="overflow-x-auto p-0">
                <table className="w-full text-sm sm:min-w-[760px]">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 text-left font-medium">Fund</th>
                      <th scope="col" className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">NAV (₹)</th>
                      {SORTS.map((s) => (
                        <th key={s.key} scope="col" aria-sort={sort === s.key ? "descending" : undefined} className={`px-3 py-2.5 text-right font-medium ${sort === s.key ? "" : "hidden sm:table-cell"}`}>
                          <button type="button" onClick={() => setSort(s.key)} className={`-my-1 inline-flex min-h-8 items-center gap-0.5 hover:text-foreground ${sort === s.key ? "text-foreground" : ""}`}>
                            {s.label}{sort === s.key && <ArrowDown className="h-3 w-3" aria-hidden />}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, shown).map((s: MfScheme & { name: string; cat: { name: string } }) => (
                      <tr key={s.scheme_code} className="border-t hover:bg-muted/30">
                        <th scope="row" className="px-4 py-2.5 text-left font-normal">
                          <span className="font-medium">{s.name}</span>
                          <span className="block text-xs text-muted-foreground">{s.amc ?? ""}{query ? ` · ${s.cat.name}` : ""}</span>
                        </th>
                        <td className="hidden px-3 py-2.5 text-right tabular-nums sm:table-cell">{s.nav.toLocaleString("en-IN", { maximumFractionDigits: 4 })}</td>
                        {SORTS.map((k) => <td key={k.key} className={`px-3 py-2.5 text-right tabular-nums ${tone(s[k.key])} ${sort === k.key ? "font-semibold" : "hidden sm:table-cell"}`}>{pct(s[k.key])}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No funds match.</p>}
              </Card>
              {rows.length > shown && (
                <Button variant="outline" className="mt-3" onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, rows.length - shown)} more of {rows.length}</Button>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Growth option, NAV-based. 1M to 1Y are absolute; 3Y and 5Y are annualised. Before tax and exit loads. Sorted by {SORTS.find((s) => s.key === sort)?.label}; a dash means the fund is younger than the period.
              </p>
            </>
          )}
        </section>

        <section aria-labelledby="invest-mf" className="mt-12 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card className="p-6">
            <h2 id="invest-mf" className="text-xl font-bold">Invest through Parasram</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Parasram's mutual fund platform gives you every fund house under one login, ready-made SIP baskets, paperless transactions and one view of all your folios. Shri Parasram Holdings is an AMFI-registered mutual fund distributor, {ARN}.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                <a href={`${PARASRAM_MF}/new-user.asp`} target="_blank" rel="noopener noreferrer">Open a mutual fund account <ExternalLink className="ml-1.5 h-4 w-4" aria-hidden /></a>
              </Button>
              <Button asChild variant="outline"><a href={`${PARASRAM_MF}/login.html`} target="_blank" rel="noopener noreferrer">Log in</a></Button>
              <Button asChild variant="outline"><a href={`${PARASRAM_MF}/basket/`} target="_blank" rel="noopener noreferrer">SIP baskets</a></Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              App for <a className="underline underline-offset-4" href="https://play.google.com/store/apps/details?id=com.parasrammf" target="_blank" rel="noopener noreferrer">Android</a> and <a className="underline underline-offset-4" href="https://apps.apple.com/in/app/parasram-mutual-fund/id6452803270" target="_blank" rel="noopener noreferrer">iOS</a> · <a className="underline underline-offset-4" href={`${PARASRAM_MF}/downloads/`} target="_blank" rel="noopener noreferrer">forms</a> · <a className="underline underline-offset-4" href={`${PARASRAM_MF}/disclosure.html`} target="_blank" rel="noopener noreferrer">commission disclosure</a>
            </p>
          </Card>
          <Card className="p-6">
            <h2 className="text-lg font-semibold">Plan before you pick</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link to="/sip-calculator" className="font-medium text-secondary hover:underline">SIP calculator</Link><span className="text-muted-foreground"> and a backtest on a fund's real NAV history</span></li>
              <li><Link to="/tax-saving-investments" className="font-medium text-secondary hover:underline">Tax-saving investments</Link><span className="text-muted-foreground">: ELSS against PPF, NPS and the rest</span></li>
              <li><Link to="/learn/mutual-funds-guide" className="font-medium text-secondary hover:underline">Mutual funds explained</Link><span className="text-muted-foreground">: categories, NAV and expense ratios</span></li>
            </ul>
          </Card>
        </section>

        <p className="mt-8 rounded-md bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
          Mutual fund investments are subject to market risks, read all scheme related documents carefully. Past performance may or may not be sustained in future and is not a guarantee of future returns. Data from AMFI; not investment advice.
        </p>
      </main>
      <FAQ title="Mutual funds: common questions" subtitle="About the data on this page and investing through Parasram." items={faq} />
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
