import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import PageTransition from "@/components/PageTransition";
import ScrollProgress from "@/components/ScrollProgress";
import WhatsAppButton from "@/components/WhatsAppButton";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import ValuationSection from "@/components/markets/ValuationSection";
import DerivativesSection from "@/components/markets/DerivativesSection";
import FlowsSection from "@/components/markets/FlowsSection";
import ActivitySection from "@/components/markets/ActivitySection";

const SECTIONS = [
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
        title="Market Pulse: Nifty P/E, FII Positions, PCR, FPI Flows & Deals"
        description="Is the market expensive? Nifty and sector index P/E, P/B and dividend yield against history, FII and DII F&O positions, option-chain PCR and max pain, NSDL FPI flows, CPI and IIP, bulk and block deals, and the ASM/GSM lists."
        breadcrumbs={breadcrumbs}
      />
      <ScrollProgress />
      <Header />
      <main className="container mx-auto max-w-7xl px-4 py-8 md:py-10">
        <VisibleBreadcrumbs items={breadcrumbs} />
        <header className="mt-4 mb-6">
          <h1 className="text-3xl md:text-5xl font-heading font-bold tracking-tight">Market Pulse</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            The whole market on one page: how expensive the indices are against their own history, how institutions are positioned in
            F&amp;O, where foreign money is flowing, and what traded today. Collected daily from NSE, BSE, NSDL and MoSPI.
          </p>
        </header>
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
          <ValuationSection />
          <DerivativesSection />
          <FlowsSection />
          <ActivitySection />
        </div>
        <p className="mt-12 text-xs text-muted-foreground">
          Sources: NSE (index file, participant-wise open interest, option chain, bulk/block/short deals, ASM/GSM, F&amp;O ban, event
          calendar), niftyindices.com (constituents), BSE (results calendar), NSDL (FPI), MoSPI (CPI, WPI, IIP). Information only, not
          investment advice.
        </p>
      </main>
      <WhatsAppButton />
      <Footer />
    </PageTransition>
  );
}
