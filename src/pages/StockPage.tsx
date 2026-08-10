import { lazy, Suspense, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "motion/react";
import { Bot } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import PageTransition from "@/components/PageTransition";
import ScrollProgress from "@/components/ScrollProgress";
import WhatsAppButton from "@/components/WhatsAppButton";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import NotFound from "@/pages/NotFound";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { StockForAnalysis } from "@/components/AIAnalysisModal";
import { revealSection } from "@/lib/motion";
import { formatCrore } from "@/lib/fundamentals";
import { useStockFundamentals } from "@/hooks/useStockFundamentals";
import IncomeStatementTable from "@/components/stock/IncomeStatementTable";
import RatiosPanel from "@/components/stock/RatiosPanel";
import CorporateActionsList from "@/components/stock/CorporateActionsList";
import StockProvenance from "@/components/stock/StockProvenance";
import SymbolSwitcher from "@/components/stock/SymbolSwitcher";

// Same split the screener, comparison and search surfaces make: the modal drags
// in recharts and react-markdown, which is more JS than this whole page ships.
const AIAnalysisModal = lazy(() => import("@/components/AIAnalysisModal"));

export default function StockPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const s = useStockFundamentals(symbol);
  const [askingAI, setAskingAI] = useState(false);

  // `synced` and `basis` are set together by selectBasis() inside the hook
  // (basis is non-null exactly when there are income rows), but that link lives
  // in another file. Guarding on both here - instead of asserting `s.basis!` -
  // means a future change that breaks the invariant falls back to the unsynced
  // card rather than silently mislabelling the table's basis badge.
  const basis = s.synced ? s.basis : null;
  const hasFinancials = basis !== null;

  // The modal wants a live quote; this page holds a filings-first subset of one,
  // so only the fields that genuinely exist here are handed over. Price is
  // required by StockForAnalysis and anchors everything the report derives from
  // it, so a header without one has nothing to be asked about. P/E, the 52-week
  // and day ranges, volume and debt/equity are screener columns this page never
  // loads: they are left absent rather than approximated, because the modal
  // forwards them untouched to the model and a stand-in comes back as a
  // confident wrong answer about a real company.
  //
  // ROE is absent for the same reason even though s.derived carries one. Those
  // rows are per-quarter (one quarter's profit after tax over equity), while the
  // modal's roe slot is read as a trailing-twelve-month figure - bucketed at
  // >15% as "excellent capital efficiency" and benchmarked server-side against
  // an annual sector average. The honest number in the wrong slot still reads
  // about four times too low.
  const aiStock: StockForAnalysis | null =
    s.header && s.header.price !== null
      ? {
          symbol: s.header.symbol,
          name: s.header.name,
          price: s.header.price,
          change_pct: s.header.change_pct,
          // 0 is the ingest's "unknown" sentinel, same as the display below.
          market_cap: s.header.market_cap || null,
          sector: s.header.sector,
        }
      : null;

  // An unknown ticker must be a real 404, not an empty shell - /stock/:symbol
  // is an open namespace and would otherwise become a soft-404 farm.
  if (s.notFound) return <NotFound />;

  const title = s.header
    ? `${s.header.name} (${s.header.symbol}) financials`
    : `${symbol?.toUpperCase() ?? "Stock"} financials`;

  // Header may not be loaded yet (loading/error states) - fall back to the
  // route param rather than rendering "undefined" in the breadcrumb trail.
  const breadcrumbLabel = s.header
    ? `${s.header.name} (${s.header.symbol})`
    : symbol?.toUpperCase() ?? "Stock";

  return (
    <PageTransition>
      <ScrollProgress />
      <SEOHead
        title={`${title} | Shri Parasram Holdings Panipat`}
        description={
          s.header
            ? `Quarterly results, EPS and corporate actions for ${s.header.name} (${s.header.symbol}), sourced from NSE XBRL filings.`
            : `Quarterly financial results and corporate actions.`
        }
      />
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <VisibleBreadcrumbs
          items={[
            { name: "Home", url: "/" },
            { name: "Stock Screener", url: "/screener" },
            { name: breadcrumbLabel },
          ]}
        />

        {s.loading ? (
          <div className="space-y-4" aria-busy="true" data-stock-state="loading">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : s.error ? (
          <Card className="p-6" data-stock-state="error">
            <h1 className="text-xl font-bold mb-2">Could not load financials</h1>
            <p className="text-sm text-muted-foreground">{s.error}</p>
          </Card>
        ) : (
          // One page, one state marker. `ready` used to sit on this wrapper for
          // every non-loading render with `unsynced` nested inside it, which
          // made the unsynced arm unreachable and reduced the prerender
          // assertion to "not a skeleton" - it could not detect the empty-table
          // regression it was written to catch.
          <div
            className="space-y-10"
            data-stock-state={hasFinancials ? "ready" : "unsynced"}
          >
            <motion.header {...revealSection}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                    {s.header?.name}
                  </h1>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary">{s.header?.symbol}</Badge>
                    {s.header?.sector && (
                      <span className="text-sm text-muted-foreground">{s.header.sector}</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {s.header?.price !== null && s.header?.price !== undefined && (
                    <div className="text-2xl font-bold tabular-nums">
                      ₹{s.header.price.toFixed(2)}
                    </div>
                  )}
                  {s.header?.updated_at && (
                    <div className="text-xs text-muted-foreground">
                      price as of{" "}
                      {new Date(s.header.updated_at).toLocaleString("en-IN")}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                    <SymbolSwitcher />
                    {/* Gated on hasFinancials, not just on loading: a symbol the
                        sync cursor has not reached has no results for the AI to
                        read, and offering analysis on it invites a report built
                        from nothing but a price. */}
                    {hasFinancials && aiStock && (
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Ask AI about ${aiStock.name}`}
                        className="text-brand-orange border-brand-orange/30 hover:bg-brand-orange/10 bg-transparent text-xs min-h-[44px] md:min-h-0 md:h-8 px-3"
                        onClick={() => setAskingAI(true)}
                      >
                        <Bot className="w-3.5 h-3.5 mr-1" /> Ask AI
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              {/* market_cap arrives in crore, and 0 is the ingest's "unknown"
                  sentinel rather than a real zero - so the truthy guard stays. */}
              {s.header?.market_cap ? (
                <p className="text-sm text-muted-foreground mt-3">
                  Market cap {formatCrore(s.header.market_cap)}
                </p>
              ) : null}
            </motion.header>

            {/* Tracked but unreached by the sync cursor. Ordinary, not broken -
                the backfill covers ~2 symbols an hour. */}
            {basis === null ? (
              <Card className="p-6">
                <h2 className="font-semibold mb-1">Financials not yet synced</h2>
                <p className="text-sm text-muted-foreground">
                  This company is tracked, but its filings have not been processed
                  yet. Results appear here once the next sync reaches it.
                </p>
              </Card>
            ) : (
              <>
                <IncomeStatementTable rows={s.income} basis={basis} />
                {s.bothAvailable && (
                  <p className="text-xs text-muted-foreground">
                    This company files both consolidated and standalone results.
                    Consolidated figures are shown; the two are never combined.
                  </p>
                )}
                {/* Renders nothing until the Yahoo sync has written a derived
                    row, so it stays inside the existing `ready` state rather
                    than earning a data-stock-state value of its own. */}
                <RatiosPanel derived={s.derived} />
              </>
            )}

            <CorporateActionsList actions={s.actions} />
            <StockProvenance filing={s.filing} />
          </div>
        )}
      </main>
      <WhatsAppButton />
      <Footer />

      {/* Lazy: recharts only downloads when an analysis is opened */}
      {askingAI && aiStock && (
        <Suspense fallback={null}>
          <AIAnalysisModal isOpen onClose={() => setAskingAI(false)} stock={aiStock} />
        </Suspense>
      )}
    </PageTransition>
  );
}
