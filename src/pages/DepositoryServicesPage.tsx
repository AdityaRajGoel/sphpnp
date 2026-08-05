import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import PageTransition from "@/components/PageTransition";
import { motion } from "motion/react";
import { Vault, Share2, FileDigit, Link as LinkIcon, ShieldAlert } from "lucide-react";
import WhatsAppButton from "@/components/WhatsAppButton";
import ScrollProgress from "@/components/ScrollProgress";

import { revealSection } from "@/lib/motion";
const features = [
  { icon: Vault, title: "Secure Account Maintenance", desc: "Safe keeping of your securities in electronic form fully backed by CDSL/NSDL." },
  { icon: Share2, title: "Fast Transfers", desc: "Transfer shares instantly, without the hassle of physical share certificates." },
  { icon: FileDigit, title: "Corporate Action Tracking", desc: "Automatic credit of bonuses, splits, and tracking of dividend payments directly to your linked bank account." },
  { icon: LinkIcon, title: "Easy Pledging (Margin)", desc: "Pledge your existing holdings electronically to get trading margin without selling." },
  { icon: ShieldAlert, title: "SMS Alerts", desc: "Real-time automated alerts for all depository transactions ensuring highest transparency." },
];

const DepositoryServicesPage = () => {
  return (
    <PageTransition>
      <SEOHead 
        title="Depository Services | NSDL & CDSL | Parasram India Panipat" 
        description="Open a Demat account with Parasram India. Transfer shares, pledge holdings for margin, and track corporate actions."
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Depository Services" },
        ]}
        faqItems={[
          { question: "What is a Depository Participant (DP)?", answer: "A Depository Participant is a SEBI-registered intermediary that provides electronic holding of your shares and securities through NSDL or CDSL. Parasram India is a registered DP with both." },
          { question: "What is the difference between NSDL and CDSL?", answer: "NSDL (National Securities Depository Limited) and CDSL (Central Depository Services Limited) are the two depositories in India. Both are safe; Parasram India offers access to either based on your preference." },
          { question: "Can I pledge my shares for trading margin?", answer: "Yes, you can pledge your existing holdings electronically to obtain trading margin without selling your shares. The pledge is created through your Demat account." },
          { question: "Will I automatically receive bonus shares and dividends?", answer: "Yes, bonus shares are automatically credited to your Demat account and dividends are directly sent to your linked bank account without any manual intervention." },
          { question: "Is it free to open a Demat account with Parasram India?", answer: "Yes, Demat account opening is free with Parasram India Panipat. There are no account opening charges." },
        ]}
        jsonLd={{
          "@type": "Service",
          "name": "Depository Services - Demat Account",
          "description": "Parasram India offers NSDL & CDSL depository participant services including Demat account opening, share transfers, corporate action tracking, and margin pledging in Panipat, Haryana.",
          "serviceType": "Depository Participant Services",
          "provider": {
            "@type": "FinancialService",
            "name": "Shri Parasram Holdings Panipat",
            "url": "https://www.sphpnp.com",
            "telephone": "+919416400314",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "Shakuntala Complex, Palika Bazaar",
              "addressLocality": "Panipat",
              "addressRegion": "Haryana",
              "postalCode": "132103",
              "addressCountry": "IN"
            }
            // aggregateRating + review removed: self-authored, and not rendered
            // on the page - both barred by Google's review-snippet policy.
          },
          "areaServed": {
            "@type": "City",
            "name": "Panipat",
            "sameAs": "https://www.wikidata.org/wiki/Q1484275"
          },
          "hasOfferCatalog": {
            "@type": "OfferCatalog",
            "name": "Depository Services",
            "itemListElement": [
              { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Demat Account Opening" } },
              { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "NSDL Depository Services" } },
              { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "CDSL Depository Services" } },
              { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Share Transfer & Pledging" } },
              { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Corporate Action Tracking" } }
            ]
          }
        }}
      />
      <div className="min-h-screen bg-background flex flex-col">
        <ScrollProgress />
        <Header />
        <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Depository Services" }]} />
        
        {/* Hero Section */}
        <section className="pt-16 pb-8 md:pt-24 md:pb-16 bg-hero text-primary-foreground text-center">
          <div className="container mx-auto px-4 z-10 relative">
            <motion.h1 
              className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-6 text-white"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              Depository <span className="text-secondary">Services</span>
            </motion.h1>
            <motion.p 
              className="text-lg md:text-xl text-primary-foreground/80 max-w-2xl mx-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              Hold, transfer, and manage your electronic securities safely and simply.
            </motion.p>
          </div>
        </section>

        {/* Info Content Section */}
        <section className="py-10 md:py-20 relative">
          <div className="container mx-auto px-4">
            
            <motion.div 
              className="mb-16 bg-card glass-card p-8 md:p-12 rounded-3xl border border-border overflow-hidden relative"
              {...revealSection}
            >
              {/* Decorative Circle */}
              <div className="absolute -top-32 -right-32 w-64 h-64 bg-brand-gold/10 rounded-full blur-3xl"></div>

              <div className="relative z-10 max-w-3xl">
                <h2 className="text-3xl font-bold font-heading text-foreground mb-6">Why Open a Demat With Us?</h2>
                <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                  Parasram India acts as a Depository Participant (DP) with both NSDL and CDSL. 
                  Our depository services form the cornerstone of all your investment activities, 
                  allowing you to hold shares, mutual funds, bonds, and ETFs electronically in a single, secure account.
                </p>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Coupled with our integrated trading platforms, our depository services ensure zero lags during settlement. You have full transparency through regular holding statements, online viewing capabilities, and direct margin pledging mechanisms.
                </p>
              </div>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, idx) => (
                <motion.div 
                  key={feature.title}
                  className="bg-muted/30 p-6 rounded-2xl border border-border/50 hover:bg-muted/60 hover:border-secondary/30 transition-[color,background-color,border-color,transform] ease-out duration-base transform hover:-translate-y-1"
                  {...revealSection}
                  transition={{ delay: idx * 0.1 }}
                >
                  <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center mb-4 text-secondary">
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.desc}
                  </p>
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

export default DepositoryServicesPage;
