import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import SEOHead from "@/components/SEOHead";
import WhatsAppButton from "@/components/WhatsAppButton";
import ScrollProgress from "@/components/ScrollProgress";
import PageTransition from "@/components/PageTransition";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { IndianRupee, BadgeCheck, Calculator, ArrowRight, Phone, Info, Percent, Scale, PhoneCall, FileText } from "lucide-react";

import { revealItem, revealSection } from "@/lib/motion";
// Published tariff for Shri Parasram Holdings (as listed on broker-data
// aggregators sourced from the firm's tariff sheet). Keep in sync with the
// branch's current schedule - update here when rates change.
const accountCharges = [
  { item: "Demat Account Opening", value: "₹0 (Free)", highlight: true },
  { item: "Trading Account Opening", value: "₹0 (Free)", highlight: true },
  { item: "Demat AMC (Annual Maintenance)", value: "₹885 / year" },
  { item: "Trading Account AMC", value: "Free" },
];

const brokerageCharges = [
  { segment: "Equity Delivery", rate: "0.15%" },
  { segment: "Equity Intraday", rate: "0.02%" },
  { segment: "Equity Futures", rate: "0.02%" },
  { segment: "Equity Options", rate: "₹30 per lot" },
  { segment: "Currency Futures", rate: "0.02%" },
  { segment: "Currency Options", rate: "₹30 per lot" },
  { segment: "Commodity (MCX)", rate: "₹30 per lot" },
];

const otherCharges = [
  { item: "Transaction Charges", value: "0.003%" },
  { item: "GST", value: "18% on brokerage & fees" },
  { item: "Demat Reactivation", value: "₹20 per instruction" },
  { item: "Account Closure", value: "₹35 per instruction" },
];

// The branch's real differentiators - services a discount broker can't match.
const usps = [
  {
    icon: Percent,
    title: "Custom Brokerage Plans",
    desc: "Rates tailored to your needs and trading volume - not one-size-fits-all. Reviewed as your activity grows.",
  },
  {
    icon: Scale,
    title: "Flexible MTF & Margins",
    desc: "Customised margin trading facility (MTF) and margin relationships structured around your portfolio and risk profile.",
  },
  {
    icon: PhoneCall,
    title: "Free ₹0 Call-to-Trade",
    desc: "The traditional dealer desk, free of charge. Call, tell us the order, we execute - built for busy businessmen and industrialists.",
  },
  {
    icon: FileText,
    title: "Tax & Paperwork Assistance",
    desc: "Capital gains statements, P&L reports, help with tax-filing paperwork and related finance tasks - plus research-backed recommendations.",
  },
];

const faqs = [
  {
    q: "Is the Demat account really free to open?",
    a: "Yes. Both the Demat and trading accounts are free to open at Parasram India Panipat. The only recurring cost is the Demat AMC of ₹885 per year; the trading account has no AMC.",
  },
  {
    q: "How is equity delivery brokerage calculated?",
    a: "Delivery brokerage is 0.15% of the trade value. For example, buying shares worth ₹1,00,000 costs ₹150 in brokerage, plus statutory charges like STT, exchange transaction charges and GST.",
  },
  {
    q: "Are there hidden charges?",
    a: "No. Beyond brokerage you pay only the standard statutory levies (STT, exchange charges, SEBI fees, stamp duty, GST) that apply at every Indian broker. Use our brokerage calculator for an exact breakdown before you trade.",
  },
  {
    q: "Is call-to-trade really free?",
    a: "Yes. Unlike most brokers who charge ₹20-50 per call-to-trade order, our traditional dealer desk is free (₹0). Call your dealer, place the order, and get a confirmation - ideal for busy professionals who can't watch screens.",
  },
  {
    q: "Do you offer MTF (Margin Trading Facility)?",
    a: "Yes. MTF and trading margins are structured individually based on your portfolio, trading segments and risk profile. Speak to the branch to set up a margin relationship that fits how you trade.",
  },
  {
    q: "Do you offer custom brokerage plans?",
    a: "Yes - custom brokerage plans are a standard offering, not an exception. We tailor rates to your trading volume, segments and order profile. Call +91 9416400314 or visit the branch at Shakuntala Complex, Palika Bazaar to set one up.",
  },
];

const ChargesTable = ({ title, rows, cols }: { title: string; rows: { [k: string]: string | boolean | undefined }[]; cols: [string, string] }) => (
  <motion.div
    className="bg-card border border-border/50 rounded-2xl overflow-hidden"
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-40px" }}
    transition={{ duration: 0.5 }}
  >
    <h2 className="font-heading text-lg font-bold text-foreground px-5 py-4 bg-muted/40 border-b border-border/50">
      {title}
    </h2>
    <table className="w-full text-sm">
      <thead>
        <tr className="text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border/40">
          <th className="text-left px-5 py-2.5 font-medium">{cols[0]}</th>
          <th className="text-right px-5 py-2.5 font-medium">{cols[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={String(r.item ?? r.segment)} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
            <td className="px-5 py-3 text-foreground">{r.item ?? r.segment}</td>
            <td className={`px-5 py-3 text-right font-semibold ${r.highlight ? "text-secondary" : "text-foreground"}`}>
              {r.value ?? r.rate}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </motion.div>
);

const PricingPage = () => {
  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <SEOHead
          title="Brokerage Charges & Pricing | Parasram India Panipat"
          description="Transparent brokerage: free Demat account opening, 0.15% equity delivery, 0.02% intraday & futures, ₹30/lot options. Full charge sheet for Parasram India Panipat."
          canonical="https://www.sphpnp.com/pricing"
          breadcrumbs={[{ name: "Home", url: "/" }, { name: "Pricing & Charges" }]}
          faqItems={faqs.map((f) => ({ question: f.q, answer: f.a }))}
        />
        <ScrollProgress />
        <Header />
        <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Pricing & Charges" }]} />

        <main className="container mx-auto px-4 py-10 md:py-16 max-w-4xl">
          {/* Hero */}
          <motion.div className="text-center mb-12" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-flex items-center gap-1.5 text-secondary font-semibold text-sm uppercase tracking-[0.15em] mb-3">
              <IndianRupee className="w-4 h-4" /> Transparent Pricing
            </span>
            <h1 className="font-heading text-3xl md:text-5xl font-bold text-foreground mb-4">
              Brokerage Charges, <span className="text-transparent bg-clip-text bg-gradient-to-r from-secondary to-brand-gold">No Surprises</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Every charge published upfront - and if you trade actively, we tailor
              brokerage to your volume and order profile.
            </p>
          </motion.div>

          {/* Free-opening banner */}
          <motion.div
            className="mb-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 bg-secondary/5 border border-secondary/20 rounded-2xl px-6 py-4 text-sm font-semibold"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <span className="inline-flex items-center gap-1.5 text-secondary"><BadgeCheck className="w-4 h-4" /> ₹0 Account Opening</span>
            <span className="inline-flex items-center gap-1.5 text-secondary"><BadgeCheck className="w-4 h-4" /> Free Trading AMC</span>
            <span className="inline-flex items-center gap-1.5 text-secondary"><BadgeCheck className="w-4 h-4" /> SEBI-Registered Since 1970</span>
          </motion.div>

          <div className="space-y-8">
            <ChargesTable title="Account Charges" rows={accountCharges} cols={["Item", "Charge"]} />
            <ChargesTable title="Brokerage by Segment" rows={brokerageCharges} cols={["Segment", "Brokerage"]} />
            <ChargesTable title="Other Charges" rows={otherCharges} cols={["Item", "Charge"]} />
          </div>

          {/* What sets us apart */}
          <section className="mt-12">
            <motion.div
              className="text-center mb-8"
              {...revealSection}
            >
              <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-2">
                What Sets Us <span className="text-secondary">Apart</span>
              </h2>
              <p className="text-muted-foreground text-sm max-w-xl mx-auto">
                Low brokerage is the start. The real value is a branch that works
                the way a personal finance office would.
              </p>
            </motion.div>

            <motion.div
              className="grid sm:grid-cols-2 gap-4"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
            >
              {usps.map((u) => (
                <motion.div
                  key={u.title}
                  className="group bg-card border border-border/50 rounded-2xl p-5 hover:border-secondary/40 hover:shadow-lg transition-[color,background-color,border-color,box-shadow]"
                  variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45 } } }}
                >
                  <div className="w-11 h-11 rounded-xl bg-secondary/10 flex items-center justify-center mb-3 group-hover:bg-secondary/20 group-hover:scale-110 transition-[color,background-color,border-color,transform] ease-out">
                    <u.icon className="w-5 h-5 text-secondary" />
                  </div>
                  <h3 className="font-heading text-base font-bold text-foreground mb-1.5 group-hover:text-secondary transition-colors">
                    {u.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{u.desc}</p>
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              className="mt-5 border-beam bg-gradient-to-br from-secondary/5 to-brand-gold/5 border border-secondary/20 rounded-2xl px-6 py-5 text-center"
              {...revealItem()}
            >
              <p className="text-sm text-muted-foreground mb-3">
                …and the dozens of small tasks a real branch quietly handles for you -
                nominations, transmissions, KYC updates, pledges and more.
              </p>
              <a
                href="tel:+919416400314"
                className="inline-flex items-center gap-2 bg-secondary/10 hover:bg-secondary/20 text-secondary font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
              >
                <Phone className="w-4 h-4" /> Discuss your plan: +91 9416400314
              </a>
            </motion.div>
          </section>

          {/* Calculator cross-links */}
          <motion.div
            className="mt-10 grid sm:grid-cols-2 gap-4"
            {...revealSection}
          >
            <Link to="/brokerage-calculator" className="group flex items-center gap-3 bg-card border border-border/50 rounded-xl p-4 hover:border-secondary/40 hover:shadow-lg transition-[color,background-color,border-color,box-shadow]">
              <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <Calculator className="w-5 h-5 text-secondary" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm text-foreground group-hover:text-secondary transition-colors">Brokerage Calculator</div>
                <div className="text-xs text-muted-foreground">See your exact cost & breakeven before trading</div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-secondary group-hover:translate-x-1 transition-[color,background-color,border-color,transform] ease-out" />
            </Link>
            <Link to="/margin-calculator" className="group flex items-center gap-3 bg-card border border-border/50 rounded-xl p-4 hover:border-secondary/40 hover:shadow-lg transition-[color,background-color,border-color,box-shadow]">
              <div className="w-10 h-10 rounded-lg bg-brand-gold/10 flex items-center justify-center">
                <Calculator className="w-5 h-5 text-brand-gold" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm text-foreground group-hover:text-secondary transition-colors">Margin Calculator</div>
                <div className="text-xs text-muted-foreground">SPAN + exposure margins for F&O positions</div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-secondary group-hover:translate-x-1 transition-[color,background-color,border-color,transform] ease-out" />
            </Link>
          </motion.div>

          {/* FAQs */}
          <section className="mt-14">
            <h2 className="font-heading text-2xl font-bold text-foreground mb-6 text-center">Pricing FAQs</h2>
            <div className="space-y-3">
              {faqs.map((f, i) => (
                <motion.details
                  key={f.q}
                  className="group bg-card border border-border/50 rounded-xl px-5 py-4 open:border-secondary/40 transition-colors"
                  {...revealItem()}
                  transition={{ delay: i * 0.06 }}
                >
                  <summary className="font-semibold text-sm text-foreground cursor-pointer list-none flex items-center justify-between min-h-[44px] md:min-h-0">
                    {f.q}
                    <span className="text-secondary group-open:rotate-45 transition-transform text-lg leading-none">+</span>
                  </summary>
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{f.a}</p>
                </motion.details>
              ))}
            </div>
          </section>

          {/* Disclaimer */}
          <div className="mt-10 flex items-start gap-2.5 text-xs text-muted-foreground bg-muted/30 border border-border/50 rounded-xl p-4">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Rates shown are the published tariff for Shri Parasram Holdings Pvt. Ltd. and are indicative;
              statutory charges (STT, exchange transaction fees, SEBI fees, stamp duty) apply additionally as per
              regulation. Please confirm the current schedule of charges at the Panipat branch or on your account
              opening tariff sheet. Custom plans are available for active traders.
            </p>
          </div>

          {/* CTA */}
          <motion.div
            className="mt-12 bg-gradient-to-br from-brand-navy to-primary text-white rounded-2xl p-6 md:p-8 text-center"
            {...revealSection}
          >
            <h2 className="font-heading text-xl md:text-2xl font-bold mb-2">Ready to invest at these rates?</h2>
            <p className="text-white/80 text-sm mb-5 max-w-md mx-auto">
              Open your free Demat account today, or call us to discuss a plan that fits your trading style.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <a href="tel:+919416400314" className="inline-flex items-center gap-2 border border-white/30 hover:border-secondary hover:text-secondary rounded-xl px-5 py-3 text-sm font-semibold transition-colors">
                <Phone className="w-4 h-4" /> +91 9416400314
              </a>
              <Link
                to="/open-account"
                className="inline-flex items-center gap-2 btn-shine bg-gradient-to-r from-secondary to-brand-green text-secondary-foreground font-bold px-6 py-3 rounded-xl shadow-lg hover:scale-[1.03] transition-transform"
              >
                Open Free Demat Account <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        </main>

        <Footer />
        <WhatsAppButton />
      </div>
    </PageTransition>
  );
};

export default PricingPage;
