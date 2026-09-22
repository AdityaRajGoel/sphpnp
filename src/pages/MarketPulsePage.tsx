import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import PageTransition from "@/components/PageTransition";
import ScrollProgress from "@/components/ScrollProgress";
import WhatsAppButton from "@/components/WhatsAppButton";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import GlobalCuesSection from "@/components/markets/GlobalCuesSection";
import ValuationSection from "@/components/markets/ValuationSection";
import DerivativesSection from "@/components/markets/DerivativesSection";
import FlowsSection from "@/components/markets/FlowsSection";
import ActivitySection from "@/components/markets/ActivitySection";
import BreadthSection from "@/components/markets/BreadthSection";
import StockTicker from "@/components/StockTicker";
import PageHeader from "@/components/PageHeader";
import MacroRegimeSection from "@/components/markets/MacroRegimeSection";
import WorldMarketsSection from "@/components/markets/WorldMarketsSection";
import FiiDiiCashCard from "@/components/markets/FiiDiiCashCard";

const SECTIONS = [
  { id: "regime", label: "Regime" },
  { id: "global", label: "Global cues" },
  { id: "world", label: "World board" },
  { id: "breadth", label: "Breadth & scans" },
  { id: "valuation", label: "Valuation" },
  { id: "derivatives", label: "F&O positioning" },
  { id: "flows", label: "Flows & economy" },
  { id: "activity", label: "Activity" },
];

/**
 * The market in one page: index valuations against their history, F&O
 * positioning, FPI flows and macro, and the day's activity - everything
 * sync-market-data collects from NSE, BSE, niftyindices, NSDL and MoSPI.
 */
export default function MarketPulsePage() {
  const breadcrumbs = [{ name: "Home", url: "/" }, { name: "Market Pulse" }];
  return (
    <PageTransition>
      <SEOHead
        title="Market Pulse: Nifty P/E, FII Positions & PCR | Parasram"
        description="Is the market expensive? Nifty and sector P/E against history, FII and DII F&O positions, option-chain PCR and max pain, FPI flows and bulk deals."
        breadcrumbs={breadcrumbs}
      />
      <ScrollProgress />
      <Header />
      <StockTicker />
      <main className="container mx-auto max-w-7xl px-4 py-8 md:py-10">
        <VisibleBreadcrumbs items={breadcrumbs} />
        <PageHeader
          className="mt-4 mb-6"
          eyebrow="The whole market, one page"
          title="Market Pulse"
          description="How expensive the indices are against their own history, how institutions are positioned in F&O, where foreign money is flowing, and what traded today. Collected daily from NSE, BSE, NSDL and MoSPI."
        />
        <nav aria-label="Sections" className="sticky top-16 z-20 -mx-4 mb-8 overflow-x-auto border-y bg-background/90 px-4 py-2 backdrop-blur">
          <ul className="flex gap-1 whitespace-nowrap">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="inline-block rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">{s.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-14">
          <MacroRegimeSection />
          <GlobalCuesSection />
          <WorldMarketsSection />
          <BreadthSection />
          <ValuationSection />
          <DerivativesSection />
          <div className="space-y-4">
            <FiiDiiCashCard />
            <FlowsSection />
          </div>
          <ActivitySection />
        </div>
        <p className="mt-12 text-xs text-muted-foreground">
          Sources: NSE (index file, participant-wise open interest, option chain, bulk/block/short deals, ASM/GSM, F&amp;O ban, event
          calendar), NSE Indices (constituents), BSE (results calendar), NSDL (FPI), MoSPI (CPI, WPI, IIP). Information only, not
          investment advice.
        </p>
      </main>
      <WhatsAppButton />
      <Footer />
    </PageTransition>
  );
}
