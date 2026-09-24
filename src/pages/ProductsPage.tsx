import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import PageTransition from "@/components/PageTransition";
import { motion } from "motion/react";
import { Briefcase, Building2, ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import WhatsAppButton from "@/components/WhatsAppButton";
import ScrollProgress from "@/components/ScrollProgress";
import SplitHero from "@/components/SplitHero";
import { Illustration } from "@/components/ui/illustration";

import { revealSection } from "@/lib/motion";
const products = [
  {
    icon: Building2,
    art: "art-pie" as const,
    title: "Fixed Deposits (FD)",
    desc: "Secure your capital and assure fixed returns with our high-yielding FDs distributed through top-rated NBFCs and Corporates.",
    benefits: [
      "Higher interest rates compared to normal banking FDs",
      "Flexible tenures from 12 to 60+ months",
      "Cumulative and Non-Cumulative payout options",
      "Highest safety ratings (CRISIL / ICRA AAA)"
    ]
  },
  {
    icon: Briefcase,
    art: "art-candles" as const,
    title: "Corporate Bonds",
    desc: "Enhance your portfolio yield by investing in high-grade corporate and government bonds with regular interest payouts.",
    benefits: [
      "Predictable and stable cash flows",
      "Superior returns versus traditional fixed income",
      "Tax-free bond availability for higher tax brackets",
      "Direct investment through your Demat account"
    ]
  },
  {
    icon: ShieldCheck,
    art: "art-shield" as const,
    title: "Insurance Services",
    desc: "Life and general insurance solutions to protect your family and assets.",
    benefits: [
      "Life, Health, and Wealth protection plans",
      "Unbiased advisory linking proper risk coverage",
      "Claim support and policy issuance",
      "Partnered with leading insurance providers"
    ]
  }
];

const ProductsPage = () => {
  return (
    <PageTransition>
      <SEOHead 
        title="Fixed Deposits, Bonds & Insurance | Parasram India Panipat" 
        description="Explore fixed deposits, corporate bonds and insurance services with Parasram India Panipat. Diversify your portfolio beyond equities with safer instruments."
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Products" },
        ]}
        jsonLd={{
          "@type": "ItemList",
          "name": "Fixed Income & Insurance Products by Parasram India",
          "description": "Diversified wealth products including fixed deposits, corporate bonds, and insurance from Parasram India Panipat.",
          "numberOfItems": 3,
          "itemListElement": products.map((p, idx) => ({
            "@type": "ListItem",
            "position": idx + 1,
            "item": {
              "@type": "FinancialProduct",
              "name": p.title,
              "description": p.desc,
              "provider": {
                "@type": "FinancialService",
                "name": "Shri Parasram Holdings Panipat",
                "url": "https://www.sphpnp.com"
              }
            }
          }))
        }}
      />
      <div className="min-h-screen bg-background flex flex-col">
        <ScrollProgress />
        <Header />
        <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Products" }]} />
        
        {/* Hero Section */}
        <SplitHero
          eyebrow="FDs · Bonds · Insurance"
          title={<>Diversified Wealth Products</>}
          subtitle="Beyond the stock market: fixed income and protection solutions to round out your portfolio."
          illustration="insurance-family"
          badge={<p className="text-sm"><span className="block text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Cover planned with you</span><span className="font-semibold">Health · Home · Vehicle · Life</span></p>}
        />

        {/* Content Section */}
        <section className="py-10 md:py-20 relative">
          <div className="container mx-auto px-4">
            <div className="grid gap-12">
              {products.map((product, idx) => (
                <motion.div 
                  key={product.title}
                  className="bg-card p-8 md:p-10 rounded-3xl border border-border/50 shadow-sm relative overflow-hidden group hover:border-brand-gold/50 transition-colors"
                  {...revealSection}
                  transition={{ delay: idx * 0.1, duration: 0.5 }}
                >
                  <div className="flex flex-col md:flex-row gap-8 items-start">
                    {/* Card art: a full-width band on a phone, a square plate beside the copy on desktop. */}
                    <div className="relative w-full flex-shrink-0 overflow-hidden rounded-2xl bg-[#f4f2ec] ring-1 ring-border md:w-56 lg:w-64">
                      <Illustration
                        slug={product.art}
                        alt=""
                        sizes="(min-width: 1024px) 256px, (min-width: 768px) 224px, 100vw"
                        className="h-44 w-full object-contain p-4 transition-transform duration-slow ease-out group- md:aspect-square md:h-auto"
                      />
                      <span className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-xl bg-white/90 shadow-sm ring-1 ring-border">
                        <product.icon className="h-4.5 w-4.5 text-secondary" aria-hidden="true" />
                      </span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold font-heading text-foreground mb-3">{product.title}</h3>
                      <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                        {product.desc}
                      </p>
                      
                      <div className="grid sm:grid-cols-2 gap-3 mb-8">
                        {product.benefits.map((benefit, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                            <span className="text-sm font-medium text-foreground/90">{benefit}</span>
                          </div>
                        ))}
                      </div>

                      <Button asChild className="group/btn bg-primary hover:bg-primary/90 text-white rounded-full px-6">
                        <Link to="/contact">
                          Inquire Now <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <Footer />
        <WhatsAppButton />
      </div>
    </PageTransition>
  );
};

export default ProductsPage;
