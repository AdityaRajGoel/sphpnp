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
import { useStockStatements } from "@/hooks/useStockStatements";
import { googleRoe, statementSourceLabel } from "@/lib/statements";
import QuoteMetrics from "@/components/stock/QuoteMetrics";
import StockPriceChart from "@/components/stock/StockPriceChart";
import IncomeStatementTable from "@/components/stock/IncomeStatementTable";
import RatiosPanel from "@/components/stock/RatiosPanel";
import CorporateActionsList from "@/components/stock/CorporateActionsList";
import SebiActionsList from "@/components/stock/SebiActionsList";
import StockNews from "@/components/stock/StockNews";
import StockSignals from "@/components/stock/StockSignals";
import StockDeals from "@/components/stock/StockDeals";
import CompanyInsights from "@/components/stock/CompanyInsights";
import CompanyDocuments from "@/components/stock/CompanyDocuments";
import InsiderTrades from "@/components/stock/InsiderTrades";
import BseAnnouncements from "@/components/stock/BseAnnouncements";
import AnalystFundView from "@/components/stock/AnalystFundView";
import { useStockDisclosures } from "@/hooks/useStockDisclosures";
import StockProvenance from "@/components/stock/StockProvenance";
import SymbolSwitcher from "@/components/stock/SymbolSwitcher";
import StatementsSection from "@/components/stock/StatementsSection";
import KeyMetricsGrid from "@/components/stock/KeyMetricsGrid";
import RiskPanel from "@/components/stock/RiskPanel";
import ForecastPanel from "@/components/stock/ForecastPanel";
import FundamentalScorePanel from "@/components/stock/FundamentalScorePanel";
import { useStockAnalytics } from "@/hooks/useStockAnalytics";
import ShareholdingTable from "@/components/stock/ShareholdingTable";

// Same split the screener, comparison and search surfaces make: the modal drags
// in recharts and react-markdown, which is more JS than this whole page ships.
const AIAnalysisModal = lazy(() => import("@/components/AIAnalysisModal"));
// recharts is heavy; only a stock with stored statements downloads it.
const StockCharts = lazy(() => import("@/components/stock/StockCharts"));
const ExchangeHistory = lazy(() => import("@/components/stock/ExchangeHistory"));
const StockFnO = lazy(() => import("@/components/stock/StockFnO"));

export default function StockPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const s = useStockFundamentals(symbol);
  const st = useStockStatements(symbol);
  const disclosures = useStockDisclosures(symbol);
  const analytics = useStockAnalytics(symbol);
  const [askingAI, setAskingAI] = useState(false);

  // `synced` and `basis` are set together by selectBasis() inside the hook
  // (basis is non-null exactly when there are income rows), but that link lives
  // in another file. Guarding on both here - instead of asserting `s.basis!` -
  // means a future change that breaks the invariant falls back to the unsynced
  // card rather than silently mislabelling the table's basis badge.
  const basis = s.synced ? s.basis : null;
  // IndianAPI statements (current to the latest quarter) take over from the
  // NSE-filing tables wherever the sync has reached a symbol; the NSE tables
  // remain the fallback. Either one is real financials for the state marker.
  const hasStatements = Object.keys(st.statements).length > 0;
  const hasFinancials = basis !== null || hasStatements;
  // Both sources must have answered before the page declares a state, or the
  // prerender could capture "not yet synced" moments before statements land.
  const loading = s.loading || st.loading;

  // The modal wants a live quote; this page holds a filings-first subset of one,
  // so only the fields that genuinely exist here are handed over. Price is
  // required by StockForAnalysis and anchors everything the report derives from
  // it, so a header without one has nothing to be asked about. P/E, the 52-week
  // and day ranges, volume and debt/equity are screener columns this page never
  // loads, and they are left absent rather than approximated.
  //
  // That absence is only safe because the modal and the edge function now
  // PROPAGATE it. They used to substitute: 52-week bounds at spot ±15%, ROE at
  // a flat 12%, debt/equity at 0.4, volume at 0 - and those stand-ins were then
  // stated as fact about a named listed company, right down to a
  // support/resistance ladder built entirely out of the invented 52-week range.
  // This page is the first surface that supplies none of them, so it is the one
  // that would have shown it. Absent fields now travel as null, reach the model
  // as "N/A", and render as a withheld state. Anything added to the object below
  // must be a figure this page actually holds.
  //
  // ROE stays absent even though s.derived now carries a trailing-twelve-month
  // figure (alignPeriods sums four consecutive quarters of profit - see
  // period.ts and RatiosPanel's "(TTM)" label). It is withheld from the AI
  // modal anyway, for a narrower reason than before: that TTM sum is null
  // whenever fewer than four consecutive quarters of income history exist for
  // a symbol, which the modal's roe slot has no representation for - it wants
  // a number to bucket at >15% as "excellent capital efficiency" and
  // benchmark server-side against an annual sector average, not a
  // sometimes-present derived figure with its own withholding rules. Handing
  // it partial coverage here would reintroduce the same "wrong number
  // presented as fact" risk this file was written to close.
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
            ? `Quarterly results, profit & loss, balance sheet, cash flow, ratios and shareholding for ${s.header.name} (${s.header.symbol}).`
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

        {loading ? (
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
              {s.header && <QuoteMetrics header={s.header} />}
              {s.header && <div className="mt-4"><StockSignals symbol={s.header.symbol} price={s.header.price} /></div>}
            </motion.header>

            {/* The chart is deliberately OUTSIDE the financials gate below: it
                reads live quotes, not filings, so a symbol the fundamentals
                cursor has not reached yet still has a price history worth
                showing. Gating it would have hidden the chart on exactly the
                stocks whose page is otherwise emptiest. */}
            {s.header && (
              <StockPriceChart symbol={s.header.symbol} name={s.header.name} />
            )}

            {s.header && (
              <Suspense fallback={null}>
                <ExchangeHistory symbol={s.header.symbol} />
                <StockFnO symbol={s.header.symbol} />
              </Suspense>
            )}

            {s.header && <StockNews symbol={s.header.symbol} name={s.header.name} />}

            {/* Tracked but unreached by the sync cursor. Ordinary, not broken -
                the backfill covers ~2 symbols an hour. */}
            {hasStatements ? (
              <>
                {st.profile && (
                  <KeyMetricsGrid
                    keyMetrics={st.profile.key_metrics}
                    roe={st.profile.roe_history}
                    ratios={st.statements.ratios?.rows ?? []}
                    movingAverages={st.profile.moving_averages}
                    price={s.header?.price ?? null}
                    fallback={{
                      pe: st.profile.google_finance?.pe ?? null,
                      eps: st.profile.google_finance?.eps ?? null,
                      dividend_yield_pct: st.profile.google_finance?.dividend_yield_pct ?? null,
                      roe_pct: googleRoe(st.statements),
                    }}
                  />
                )}
                <Suspense fallback={<Skeleton className="h-[420px] w-full" />}>
                  <StockCharts
                    statements={st.statements}
                    shareholding={st.profile?.shareholding ?? []}
                    roeHistory={st.profile?.roe_history}
                    source={statementSourceLabel(st.statements)}
                  />
                </Suspense>
                <StatementsSection statements={st.statements} />
                {st.profile?.screener && <CompanyInsights screener={st.profile.screener} />}
                {st.profile && <ShareholdingTable shareholding={st.profile.shareholding} filing={disclosures?.shareholding ?? null} />}
                {st.profile?.tickertape && (
                  <AnalystFundView tickertape={st.profile.tickertape} pe={s.header?.pe ?? st.profile.screener?.top_ratios.pe ?? null} />
                )}
              </>
            ) : basis === null ? (
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
                <RiskPanel analytics={analytics?.price ?? null} />
                <FundamentalScorePanel scores={analytics?.fundamentals ?? null} />
                <ForecastPanel forecast={analytics?.forecast ?? null} />
              </>
            )}

            <CorporateActionsList actions={s.actions} />
            {disclosures && <InsiderTrades trades={disclosures.trades} />}
            {s.header && <StockDeals symbol={s.header.symbol} />}
            {disclosures && <BseAnnouncements items={disclosures.announcements} bseCode={st.profile?.bse_code ?? null} />}
            {s.header && <SebiActionsList symbol={s.header.symbol} />}
            {st.profile?.screener && <CompanyDocuments documents={st.profile.screener.documents} />}
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
