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

import { revealSection } from "@/lib/motion";
const products = [
  {
    icon: Building2,
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
    title: "Insurance Services",
    desc: "Protect your family and assets with our comprehensive life and general insurance solutions tailored for your unique needs.",
    benefits: [
      "Life, Health, and Wealth protection plans",
      "Unbiased advisory linking proper risk coverage",
      "Seamless claim support and policy issuance",
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
        <section className="pt-16 pb-8 md:pt-24 md:pb-16 relative overflow-hidden bg-hero text-primary-foreground">
          <div className="container mx-auto px-4 z-10 relative text-center">
            <motion.h1 
              className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-6"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              Diversified <span className="text-secondary">Wealth Products</span>
            </motion.h1>
            <motion.p 
              className="text-lg md:text-xl text-primary-foreground/80 max-w-2xl mx-auto mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              Beyond the stock market. Build a robust portfolio with our top-tier fixed income and protection solutions.
            </motion.p>
          </div>
        </section>

        {/* Content Section */}
        <section className="py-10 md:py-20 relative">
          <div className="container mx-auto px-4">
            <div className="grid gap-12">
              {products.map((product, idx) => (
                <motion.div 
                  key={product.title}
                  className="bg-card glass-card p-8 md:p-10 rounded-3xl border border-border/50 shadow-sm relative overflow-hidden group hover:border-brand-gold/50 transition-colors"
                  {...revealSection}
                  transition={{ delay: idx * 0.1, duration: 0.5 }}
                >
                  <div className="flex flex-col md:flex-row gap-8 items-start">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center group-hover:bg-brand-gold/20 transition-colors">
                        <product.icon className="w-8 h-8 text-secondary group-hover:text-brand-gold transition-colors" />
                      </div>
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
