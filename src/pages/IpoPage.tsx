import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, CalendarDays, LayoutGrid, Rocket, Table2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import PageTransition from "@/components/PageTransition";
import ScrollProgress from "@/components/ScrollProgress";
import WhatsAppButton from "@/components/WhatsAppButton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import IPOFilterBar from "@/components/ipo/IPOFilterBar";
import IPOTable from "@/components/ipo/IPOTable";
import IPOCompareBar from "@/components/ipo/IPOCompareBar";
import IPOCompareDialog from "@/components/ipo/IPOCompareDialog";
import { formatGmp, getIpos, type Ipo } from "@/lib/ipo";
import {
  compareSlugsToParam,
  filterIpos,
  ipoFiltersFromSearchParams,
  ipoFiltersToSearchParams,
  MAX_COMPARE,
  parseCompareSlugs,
  sortIpos,
  toggleCompareSlug,
  type IpoFilters,
  type SortDir,
  type SortKey,
} from "@/lib/ipo-filters";

/**
 * Lifecycle order - open issues first, recent listings newest first - rather
 * than open_date ascending, which put issues from April at the top of the page.
 */
const DEFAULT_SORT: SortKey = "status";

const statusLabel: Record<Ipo["status"], string> = { upcoming: "Upcoming", open: "Open now", closed: "Closed", listed: "Listed" };
type ViewMode = "cards" | "table";

export default function IpoPage() {
  const [ipos, setIpos] = useState<Ipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<IpoFilters>(() => ipoFiltersFromSearchParams(searchParams));
  const [view, setView] = useState<ViewMode>(searchParams.get("view") === "table" ? "table" : "cards");
  const [sortKey, setSortKey] = useState<SortKey>((searchParams.get("sort") as SortKey) || DEFAULT_SORT);
  const [sortDir, setSortDir] = useState<SortDir>(searchParams.get("dir") === "desc" ? "desc" : "asc");
  const [compareSlugs, setCompareSlugs] = useState<string[]>(() => parseCompareSlugs(searchParams.get("compare")));
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => { getIpos().then(setIpos).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)); }, []);

  // Filters, view and comparison state all live in the URL — a filtered,
  // sorted or compared view is a link a visitor can share.
  useEffect(() => {
    const params = ipoFiltersToSearchParams(filters);
    if (view !== "cards") params.set("view", view); else params.delete("view");
    if (sortKey !== DEFAULT_SORT) params.set("sort", sortKey); else params.delete("sort");
    if (sortDir !== "asc") params.set("dir", sortDir); else params.delete("dir");
    const compareParam = compareSlugsToParam(compareSlugs);
    if (compareParam) params.set("compare", compareParam); else params.delete("compare");
    setSearchParams(params, { replace: true });
  }, [filters, view, sortKey, sortDir, compareSlugs, setSearchParams]);

  const filtered = useMemo(() => filterIpos(ipos, filters), [ipos, filters]);
  const sorted = useMemo(() => sortIpos(filtered, sortKey, sortDir), [filtered, sortKey, sortDir]);
  const statusCounts = useMemo(() => {
    const counts: Partial<Record<Ipo["status"], number>> = {};
    for (const ipo of ipos) counts[ipo.status] = (counts[ipo.status] ?? 0) + 1;
    return counts;
  }, [ipos]);

  const compareIpos = useMemo(
    () => compareSlugs.map((slug) => ipos.find((ipo) => ipo.slug === slug)).filter((ipo): ipo is Ipo => Boolean(ipo)),
    [compareSlugs, ipos],
  );

  const toggleCompare = (slug: string) => setCompareSlugs((current) => toggleCompareSlug(current, slug));
  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  return <PageTransition>
    <ScrollProgress /><SEOHead title="IPO Tracker & GMP History" description="Track Indian mainboard and SME IPO dates, price bands and recorded grey market premium history. Information only; not investment advice." breadcrumbs={[{ name: "Home", url: "/" }, { name: "IPO Tracker" }]} />
    <Header />
    <main>
      <section className="bg-hero text-primary-foreground py-16 md:py-24"><div className="container mx-auto px-4 max-w-6xl">
        <Badge className="bg-brand-gold/20 text-brand-gold border-brand-gold/30 mb-5"><Rocket className="w-3.5 h-3.5 mr-1.5" />IPO Central</Badge>
        <h1 className="font-heading text-4xl md:text-6xl font-bold max-w-3xl leading-tight">IPO decisions, grounded in the details.</h1>
        <p className="mt-5 max-w-2xl text-primary-foreground/70 text-base md:text-lg">Issue dates, price bands and a transparent record of observed GMP—not a recommendation to apply, buy or sell.</p>
      </div></section>
      <section className="container mx-auto px-4 max-w-6xl py-10 md:py-14 pb-28">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground"><strong>Important:</strong> Grey market premium (GMP) is unofficial, unregulated and can change quickly. It is shown for information only and is not investment advice or a prediction of listing performance.</div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-10 mb-4">
          <div><h2 className="font-heading text-2xl font-bold">IPO calendar</h2><p className="text-sm text-muted-foreground mt-1">Mainboard and SME issues tracked by our scheduled data service. Select up to {MAX_COMPARE} to compare side by side.</p></div>
          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            <button onClick={() => setView("cards")} aria-pressed={view === "cards"} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${view === "cards" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"}`}><LayoutGrid className="w-3.5 h-3.5" />Cards</button>
            <button onClick={() => setView("table")} aria-pressed={view === "table"} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${view === "table" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"}`}><Table2 className="w-3.5 h-3.5" />Table</button>
          </div>
        </div>

        <IPOFilterBar filters={filters} onChange={setFilters} counts={statusCounts} />

        <div className="mt-6">
          {loading ? (
            <div className="grid md:grid-cols-2 gap-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-56 animate-pulse rounded-xl bg-muted" />)}</div>
          ) : error ? (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">{error}. Please try again shortly.</CardContent></Card>
          ) : ipos.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No IPOs are published yet. The next scheduled sync will populate the calendar.</CardContent></Card>
          ) : sorted.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No IPOs match these filters. Try widening the status, board or GMP band.</CardContent></Card>
          ) : view === "table" ? (
            <IPOTable ipos={sorted} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} compareSlugs={compareSlugs} onToggleCompare={toggleCompare} />
          ) : (
            <div className="grid md:grid-cols-2 gap-4">{sorted.map((ipo) => (
              <IpoCard key={ipo.id} ipo={ipo} selected={compareSlugs.includes(ipo.slug)} compareDisabled={!compareSlugs.includes(ipo.slug) && compareSlugs.length >= MAX_COMPARE} onToggleCompare={() => toggleCompare(ipo.slug)} />
            ))}</div>
          )}
        </div>
      </section>
    </main>
    <IPOCompareBar count={compareIpos.length} onCompare={() => setCompareOpen(true)} onClear={() => setCompareSlugs([])} />
    <IPOCompareDialog open={compareOpen} onOpenChange={setCompareOpen} ipos={compareIpos} onRemove={toggleCompare} />
    <WhatsAppButton /><Footer />
  </PageTransition>;
}

type IpoCardProps = { ipo: Ipo; selected: boolean; compareDisabled: boolean; onToggleCompare: () => void };

function IpoCard({ ipo, selected, compareDisabled, onToggleCompare }: IpoCardProps) {
  return <Card className="h-full border-border/70 transition-[border-color,box-shadow] hover:border-secondary/50 hover:shadow-lg relative">
    <label
      className={`absolute top-4 right-4 z-10 flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground ${compareDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
      onClick={(e) => { e.preventDefault(); if (!compareDisabled) onToggleCompare(); }}
    >
      <Checkbox checked={selected} disabled={compareDisabled} aria-label={`Add ${ipo.name} to comparison`} tabIndex={-1} />
      Compare
    </label>
    <Link to={`/ipo/${ipo.slug}`} className="group block"><CardContent className="p-5">
      <div className="flex items-start justify-between gap-3 pr-16"><div><div className="flex gap-2 items-center"><Badge variant="outline">{ipo.type}</Badge><span className="text-xs font-semibold text-muted-foreground">{statusLabel[ipo.status]}</span></div><h3 className="mt-3 font-heading text-xl font-bold group-hover:text-secondary transition-colors">{ipo.name}</h3></div><ArrowRight className="w-5 h-5 mt-1 text-muted-foreground group-hover:text-secondary group-hover:translate-x-1 transition-[color,transform] shrink-0" /></div>
      <div className="grid grid-cols-2 gap-4 mt-6 text-sm"><div><span className="text-muted-foreground">Price band</span><p className="font-semibold mt-1">{ipo.price}</p></div><div><span className="text-muted-foreground">Latest GMP</span><p className={`font-semibold mt-1 ${ipo.gmp === null ? "text-muted-foreground" : ipo.gmp >= 0 ? "text-secondary" : "text-destructive"}`}>{formatGmp(ipo.gmp)}</p></div><div className="col-span-2 flex items-center gap-2 text-muted-foreground"><CalendarDays className="w-4 h-4" />{ipo.date}</div></div>
    </CardContent></Link>
  </Card>;
}
