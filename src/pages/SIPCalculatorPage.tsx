import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import ScrollProgress from "@/components/ScrollProgress";
import WhatsAppButton from "@/components/WhatsAppButton";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import PageTransition from "@/components/PageTransition";
import SIPCalculator from "@/components/SIPCalculator";

const SIPCalculatorPage = () => (
  <PageTransition>
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="SIP Calculator - Mutual Fund SIP Returns | Parasram India"
        description="Free SIP calculator to estimate the future value of your monthly mutual fund investments. Calculate wealth growth, total invested and expected returns."
        canonical="https://www.sphpnp.com/sip-calculator"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "SIP Calculator" },
        ]}
        faqItems={[
          {
            question: "What is a SIP calculator?",
            answer: "A SIP (Systematic Investment Plan) calculator estimates the future value of regular monthly investments in a mutual fund, based on expected annual returns and investment duration.",
          },
          {
            question: "How accurate is the SIP calculator?",
            answer: "The calculator uses the standard compound interest formula for SIPs. Actual returns depend on market conditions; the result is an estimate, not a guarantee.",
          },
          {
            question: "What is a good expected return rate for SIP?",
            answer: "Historically, Indian equity mutual funds have delivered 12–15% CAGR over long periods. Debt funds typically return 6–8%. Use 10–12% as a conservative estimate for equity SIPs.",
          },
        ]}
      />
      <ScrollProgress />
      <Header />
      <VisibleBreadcrumbs
        items={[{ name: "Home", url: "/" }, { name: "SIP Calculator" }]}
      />
      <main className="flex-1">
        <SIPCalculator headingLevel={1} />
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  </PageTransition>
);

export default SIPCalculatorPage;
