import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import UnlistedShares from "@/components/UnlistedShares";
import UnlistedPriceComparison from "@/components/UnlistedPriceComparison";
import ContactForm from "@/components/ContactForm";
import WhatsAppButton from "@/components/WhatsAppButton";
import ScrollProgress from "@/components/ScrollProgress";
import FAQ from "@/components/FAQ";
import SEOHead from "@/components/SEOHead";
import PageTransition from "@/components/PageTransition";
import { motion } from "motion/react";
import { Phone, Search, BadgeCheck, Vault, TrendingUp } from "lucide-react";
import ScrollySteps, { ScrollyStep } from "@/components/ScrollySteps";
import { revealBar, revealItemX, revealSection } from "@/lib/motion";

const unlistedSteps: ScrollyStep[] = [
  { icon: Search, title: "Browse Verified Companies", desc: "Explore 50+ verified unlisted & pre-IPO companies - NSE, Tata Capital, SBI Mutual Fund and more, with indicative prices.", num: "01", accent: "pulse" },
  { icon: BadgeCheck, title: "Get a Confirmed Quote", desc: "Tell us the company and quantity - our desk confirms the live price and minimum lot within hours.", num: "02", accent: "check" },
  { icon: Vault, title: "Pay & Receive in Your Demat", desc: "Complete payment and the shares are transferred to your CDSL/NSDL Demat account within 24-48 hours.", num: "03", accent: "sparkle" },
  { icon: TrendingUp, title: "Hold Till IPO or Exit", desc: "Track your holdings and benefit at listing - or sell back through our desk whenever you choose.", num: "04", accent: "chart" },
];

const unlistedFAQs = [
  { q: "What are unlisted shares?", a: "Unlisted shares are equity shares of companies that are not listed on any recognized stock exchange like NSE or BSE. These include pre-IPO companies, startups, and private companies." },
  { q: "Is it legal to buy unlisted shares in India?", a: "Yes, buying and selling unlisted shares is completely legal in India. However, these transactions are not regulated by SEBI or stock exchanges, so investors should exercise caution." },
  { q: "How are unlisted shares transferred?", a: "Unlisted shares are transferred off-market via your Demat account. The process typically takes 2-5 business days after payment confirmation." },
  { q: "What is the minimum investment amount?", a: "Most unlisted shares can be purchased starting from just 1 share. The investment amount depends on the current price of the stock." },
  { q: "How do I know the correct price?", a: "Unlisted share prices are not standardized like listed stocks. We provide competitive buy/sell rates based on current market demand. Always contact us for live pricing." },
  { q: "What happens when an unlisted company gets listed (IPO)?", a: "When the company lists on an exchange, your shares are automatically converted to listed shares in your Demat account. You can then trade them on the exchange like any other stock." },
  { q: "Are there any tax implications?", a: "Yes. Short-term capital gains (held < 2 years) on unlisted shares are taxed at your income tax slab rate. Long-term gains (held > 2 years) are taxed at 20% with indexation benefit." },
];

const UnlistedSpacePage = () => {
  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
      <SEOHead
        title="Buy Pre-IPO & Unlisted Shares in India | Parasram India"
        description="Buy pre-IPO and unlisted shares via Parasram India. Secure SEBI-registered framework, instant Demat transfers, verified companies. Invest before the IPO."
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Unlisted Space" },
        ]}
        faqItems={unlistedFAQs.map(f => ({ question: f.q, answer: f.a }))}
        jsonLd={{
          "@type": "Product",
          "name": "Unlisted Space - Pre-IPO Shares",
          "description": "Discover high-growth pre-IPO opportunities and unlisted shares through Parasram India's Unlisted Space. SEBI registered facilitator offering seamless Demat transfers.",
          "brand": { "@type": "Brand", "name": "Parasram India" },
          "offers": {
            "@type": "AggregateOffer",
            "priceCurrency": "INR",
            "availability": "https://schema.org/InStock",
            "offerCount": 50,
            "lowPrice": 100,
            "highPrice": 50000,
            "seller": {
              "@type": "Organization",
              "name": "Shri Parasram Holdings Panipat",
              "telephone": "+919416400314",
            },
          },
          // aggregateRating + review removed: self-authored, and not rendered
          // on the page - both barred by Google's review-snippet policy.
        }}
      />
      <ScrollProgress />
      <Header />
      <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Unlisted Space" }]} />
      <UnlistedShares />
      <UnlistedPriceComparison />

      {/* How unlisted investing works - scrollytelling */}
      <section className="py-10 md:py-20 bg-background relative overflow-hidden" aria-labelledby="unlisted-how-heading">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-14"
            {...revealSection}
          >
            <span className="inline-block text-secondary font-semibold text-sm uppercase tracking-wider mb-3">
              Simple & Secure
            </span>
            <h2 id="unlisted-how-heading" className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
              How Unlisted Investing Works
            </h2>
            <p className="text-sm text-muted-foreground -mt-1 mb-2">
              Want the full picture first? Read our{" "}
              <a href="/learn/how-to-buy-unlisted-shares" className="text-secondary font-semibold hover:underline">
                guide to buying unlisted shares in India
              </a>{" "}- process, risks and taxation.
            </p>
            <motion.div
              className="w-20 h-1 bg-gradient-to-r from-secondary to-brand-gold mx-auto rounded-full"
              {...revealBar}
            />
          </motion.div>

          <ScrollySteps steps={unlistedSteps} />
        </div>
      </section>

      {/* Inquiry section */}
      <section id="contact" className="py-8 md:py-16 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto items-start">
            <motion.div
              {...revealItemX("left")}
            >
              <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-4">
                Interested in <span className="text-secondary">Unlisted Shares?</span>
              </h2>
              <p className="text-muted-foreground mb-6">
                Send us your inquiry and our team will get back to you with live pricing and availability within hours.
              </p>
              <div className="space-y-3 mb-6">
                <a href="tel:+919416400314" className="flex items-center gap-3 text-foreground hover:text-secondary transition-colors">
                  <div className="w-10 h-10 bg-secondary/10 rounded-xl flex items-center justify-center">
                    <Phone className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <div className="font-semibold">+91 9416400314</div>
                    <div className="text-xs text-muted-foreground">Anil Kumar Goel</div>
                  </div>
                </a>
                <a href="tel:+919999790011" className="flex items-center gap-3 text-foreground hover:text-secondary transition-colors">
                  <div className="w-10 h-10 bg-brand-gold/10 rounded-xl flex items-center justify-center">
                    <Phone className="w-5 h-5 text-brand-gold" />
                  </div>
                  <div>
                    <div className="font-semibold">+91 9999790011</div>
                    <div className="text-xs text-muted-foreground">Rajat Gupta</div>
                  </div>
                </a>
              </div>
            </motion.div>
            <ContactForm />
          </div>
        </div>
      </section>

      <FAQ
        title="Unlisted Shares FAQ"
        subtitle="Everything you need to know before investing in pre-IPO shares"
        items={unlistedFAQs}
      />
      <Footer />
      <WhatsAppButton />
      </div>
    </PageTransition>
  );
};

export default UnlistedSpacePage;
