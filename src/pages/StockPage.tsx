import { useParams } from "react-router-dom";
import { motion } from "motion/react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import PageTransition from "@/components/PageTransition";
import ScrollProgress from "@/components/ScrollProgress";
import WhatsAppButton from "@/components/WhatsAppButton";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import NotFound from "@/pages/NotFound";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { revealSection } from "@/lib/motion";
import { formatCrore } from "@/lib/fundamentals";
import { useStockFundamentals } from "@/hooks/useStockFundamentals";
import IncomeStatementTable from "@/components/stock/IncomeStatementTable";
import CorporateActionsList from "@/components/stock/CorporateActionsList";
import StockProvenance from "@/components/stock/StockProvenance";
import SymbolSwitcher from "@/components/stock/SymbolSwitcher";

export default function StockPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const s = useStockFundamentals(symbol);

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
          <div className="space-y-10" data-stock-state="ready">
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
                  <div className="mt-2"><SymbolSwitcher /></div>
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
                the backfill covers ~2 symbols an hour.

                `synced` and `basis` are set together by selectBasis() inside
                the hook (basis is non-null exactly when there are income
                rows), but that link lives in another file. Guarding on both
                here - instead of asserting `s.basis!` - means a future
                change that breaks the invariant falls back to this card
                rather than silently mislabelling the table's basis badge. */}
            {!s.synced || !s.basis ? (
              <Card className="p-6" data-stock-state="unsynced">
                <h2 className="font-semibold mb-1">Financials not yet synced</h2>
                <p className="text-sm text-muted-foreground">
                  This company is tracked, but its filings have not been processed
                  yet. Results appear here once the next sync reaches it.
                </p>
              </Card>
            ) : (
              <>
                <IncomeStatementTable rows={s.income} basis={s.basis} />
                {s.bothAvailable && (
                  <p className="text-xs text-muted-foreground">
                    This company files both consolidated and standalone results.
                    Consolidated figures are shown; the two are never combined.
                  </p>
                )}
              </>
            )}

            <CorporateActionsList actions={s.actions} />
            <StockProvenance filing={s.filing} />
          </div>
        )}
      </main>
      <WhatsAppButton />
      <Footer />
    </PageTransition>
  );
}
