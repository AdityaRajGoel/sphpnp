import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import ScrollProgress from "@/components/ScrollProgress";
import WhatsAppButton from "@/components/WhatsAppButton";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import PageTransition from "@/components/PageTransition";
import SIPCalculator from "@/components/SIPCalculator";
import SipBacktest from "@/components/SipBacktest";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { IllustrationFrame } from "@/components/ui/illustration";

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
        <section aria-labelledby="sip-goals-heading" className="py-12 md:py-20">
          <div className="container mx-auto grid items-center gap-10 px-4 lg:grid-cols-2 lg:gap-16">
            <IllustrationFrame
              slug="mutual-funds-planning"
              tone="light"
              sizes="(min-width: 1024px) 45vw, 92vw"
              frameClassName="mx-auto w-full max-w-xl"
            />
            <div className="text-center lg:text-left">
              <p className="mb-4 inline-flex rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-secondary">Goal-based SIPs</p>
              <h2 id="sip-goals-heading" className="font-heading text-3xl font-bold tracking-tight [text-wrap:balance] md:text-4xl">Give every SIP a job to do</h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground lg:mx-0">
                A child's education, a home, retirement: each goal has its own date and its own risk. Our Panipat team helps you split one monthly amount across funds that fit each goal, then review it as life changes.
              </p>
              <Link to="/contact#contact-form" className="group mt-6 inline-flex items-center gap-3 rounded-full bg-secondary py-1.5 pl-5 pr-1.5 text-sm font-semibold text-secondary-foreground shadow-sm transition-colors hover:bg-secondary/90 pressable">
                Plan my SIPs with an advisor
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15 transition-transform duration-base group-hover:translate-x-0.5 group-hover:-translate-y-px"><ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
              </Link>
            </div>
          </div>
        </section>
        <SipBacktest />
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  </PageTransition>
);

export default SIPCalculatorPage;
