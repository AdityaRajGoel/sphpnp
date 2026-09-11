import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, ExternalLink, FileText, Search } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import PageTransition from "@/components/PageTransition";
import ScrollProgress from "@/components/ScrollProgress";
import WhatsAppButton from "@/components/WhatsAppButton";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  FILING_LABEL,
  STAGE_LABEL,
  filterPipeline,
  getPipeline,
  isSebiUrl,
  pipelineCounts,
  type PipelineCompany,
  type PipelineStage,
  type PipelineView,
} from "@/lib/ipo-pipeline";

const VIEWS: { id: PipelineView; label: string }[] = [
  { id: "pipeline", label: "In the pipeline" },
  { id: "launched", label: "Launched" },
  { id: "all", label: "All filings" },
];

const STAGE_TONE: Record<PipelineStage, string> = {
  drhp_filed: "bg-muted text-foreground",
  udrhp_filed: "bg-brand-gold/15 text-foreground",
  rhp_filed: "bg-secondary/15 text-secondary",
  launched: "bg-primary/10 text-primary",
};

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

function CompanyRow({ company }: { company: PipelineCompany }) {
  const [open, setOpen] = useState(false);
  const latest = company.filings[0];
  return (
    <Card>
      <CardContent className="p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-heading text-lg font-bold leading-snug">{company.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              First filed {formatDate(company.first_filed_on)} · Latest filing {formatDate(company.latest_filed_on)}
              {latest?.detail ? ` (${latest.detail})` : ""}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STAGE_TONE[company.stage]}`}>{STAGE_LABEL[company.stage]}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {company.ipo_slug && (
            <Link to={`/ipo/${company.ipo_slug}`} className="inline-flex items-center gap-1 font-semibold text-secondary hover:underline">
              View IPO details <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
          {latest && isSebiUrl(latest.url) && (
            <a href={latest.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-secondary hover:underline">
              <FileText className="h-3.5 w-3.5" />{FILING_LABEL[latest.kind]} on SEBI<ExternalLink className="h-3 w-3" />
            </a>
          )}
          {company.filings.length > 1 && (
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
              {open ? "Hide" : "Show"} all {company.filings.length} filings
            </button>
          )}
        </div>
        {open && (
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border text-sm">
            {company.filings.map((f) => (
              <li key={f.url} className="flex flex-wrap items-center justify-between gap-2 p-2.5">
                <span>
                  <span className="font-medium">{f.detail || FILING_LABEL[f.kind]}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{formatDate(f.filed_on)}</span>
                </span>
                <span className="flex flex-wrap gap-3">
                  {isSebiUrl(f.url) && <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-secondary hover:underline">Filing</a>}
                  {f.extra_links.filter((x) => isSebiUrl(x.url)).map((x) => (
                    <a key={x.url} href={x.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-secondary hover:underline">{x.label}</a>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Companies that have filed offer documents with SEBI, from the first draft
 * (DRHP) through the red herring prospectus to the issue itself - months of
 * notice before an IPO reaches the calendar.
 */
export default function IpoPipelinePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [companies, setCompanies] = useState<PipelineCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialView = searchParams.get("view");
  const [view, setView] = useState<PipelineView>(initialView === "launched" || initialView === "all" ? initialView : "pipeline");
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  useEffect(() => { getPipeline().then(setCompanies).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)); }, []);

  // A filtered view is a link a visitor can share.
  useEffect(() => {
    const params = new URLSearchParams();
    if (view !== "pipeline") params.set("view", view);
    if (query.trim()) params.set("q", query.trim());
    setSearchParams(params, { replace: true });
  }, [view, query, setSearchParams]);

  const shown = useMemo(() => filterPipeline(companies, view, query), [companies, view, query]);
  const counts = useMemo(() => pipelineCounts(companies), [companies]);
  const breadcrumbs = [{ name: "Home", url: "/" }, { name: "IPO Tracker", url: "/ipo" }, { name: "IPO Pipeline" }];

  return (
    <PageTransition>
      <ScrollProgress />
      <SEOHead
        title="IPO Pipeline: Companies That Have Filed a DRHP with SEBI"
        description="Upcoming IPOs before they open: every company that has filed a draft or red herring prospectus with SEBI, with links to the filings. Information only; not investment advice."
        breadcrumbs={breadcrumbs}
      />
      <Header />
      <main className="container mx-auto max-w-5xl px-4 py-8 md:py-12">
        <VisibleBreadcrumbs items={breadcrumbs} />
        <section className="mt-6">
          <Badge variant="outline">From SEBI filings</Badge>
          <h1 className="mt-4 font-heading text-3xl md:text-5xl font-bold">IPO pipeline</h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Companies that have filed offer documents with SEBI - usually months before an issue opens. A draft (DRHP)
            is followed by SEBI's observations, often an updated draft, and then the red herring prospectus (RHP) days
            before the issue opens.
          </p>
        </section>
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <strong>Note:</strong> Filing a draft does not mean an IPO will happen - SEBI may return it, and companies
          withdraw or let drafts lapse. Dates and prices are set only in the RHP. Information only; not investment advice.
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter the pipeline">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                aria-pressed={view === v.id}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${view === v.id ? "border-secondary bg-secondary text-secondary-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                {v.label} <span className="ml-1 text-xs opacity-80">{counts[v.id]}</span>
              </button>
            ))}
          </div>
          <label className="relative w-full sm:w-64">
            <span className="sr-only">Search companies</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search companies" className="pl-9" />
          </label>
        </div>

        {/* The prerender waits for "ready" before capturing - see scripts/lib/ipo-routes.mjs. */}
        <div className="mt-6 space-y-3" data-ipo-state={loading ? "loading" : error ? "error" : "ready"}>
          {loading ? (
            [1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)
          ) : error ? (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">{error}. Please try again shortly.</CardContent></Card>
          ) : shown.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No companies match.</CardContent></Card>
          ) : (
            shown.map((c) => <CompanyRow key={c.key} company={c} />)
          )}
        </div>
      </main>
      <WhatsAppButton />
      <Footer />
    </PageTransition>
  );
}
