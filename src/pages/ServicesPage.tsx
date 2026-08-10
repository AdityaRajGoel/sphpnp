import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import Services from "@/components/Services";
import InvestmentTools from "@/components/InvestmentTools";
import SIPCalculator from "@/components/SIPCalculator";
import MobileApp from "@/components/MobileApp";
import ClientMarquee from "@/components/ClientMarquee";
import WhatsAppButton from "@/components/WhatsAppButton";
import ScrollProgress from "@/components/ScrollProgress";
import SEOHead from "@/components/SEOHead";
import PageTransition from "@/components/PageTransition";

const ServicesPage = () => {
  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
      <SEOHead
        title="Stock Broking Services in Panipat | Parasram India"
        description="Equity trading, mutual funds, SIP, IPO applications, F&O, commodities and unlisted shares in Panipat. SEBI-registered broker serving investors since 1970, with 10L+ happy clients."
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Services" },
        ]}
        faqItems={[
          { question: "What financial services does Parasram India Panipat offer?", answer: "Parasram India Panipat offers equity trading, mutual funds & SIPs, IPO applications, F&O trading, commodities (MCX), currency trading, unlisted shares, and depository (Demat) services." },
          { question: "Is Parasram India a SEBI-registered broker?", answer: "Yes. Shri Parasram Holdings Pvt. Ltd. is a fully SEBI-registered stockbroker and depository participant (SEBI Regn. No. INZ000220838), with membership of NSE, BSE, MCX and MSEI. The firm has served investors since 1970 and was incorporated in 1994." },
          { question: "Can I start a SIP with a small amount?", answer: "Yes, you can start a Systematic Investment Plan (SIP) with as little as ₹500 per month through Parasram India." },
          { question: "Do you offer F&O trading services?", answer: "Yes, we offer Futures & Options trading on NSE with competitive brokerage rates and risk management support from our experienced team." },
          { question: "How do I apply for an IPO through Parasram India?", answer: "You can apply for IPOs using the ASBA/UPI block mechanism through your linked bank account. Our team guides you through the entire process." },
        ]}
        jsonLd={{
          "@type": "ItemList",
          "name": "Financial Services by Parasram India Panipat",
          "description": "Complete range of SEBI-registered financial services offered by Shri Parasram Holdings Pvt. Ltd. from its Panipat, Haryana branch, open since 1997.",
          "numberOfItems": 8,
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "item": {
                "@type": "Service",
                "name": "Equity Trading",
                "description": "Buy and sell stocks on NSE and BSE with competitive brokerage rates.",
                "provider": { "@type": "Organization", "name": "Shri Parasram Holdings Panipat" },
                "serviceType": "Equity Trading",
                "areaServed": "Panipat, Haryana"
              }
            },
            {
              "@type": "ListItem",
              "position": 2,
              "item": {
                "@type": "Service",
                "name": "Mutual Fund Investments",
                "description": "Invest in direct and regular mutual funds with SIP options starting from ₹500/month.",
                "provider": { "@type": "Organization", "name": "Shri Parasram Holdings Panipat" },
                "serviceType": "Mutual Fund Distribution",
                "areaServed": "Panipat, Haryana"
              }
            },
            {
              "@type": "ListItem",
              "position": 3,
              "item": {
                "@type": "Service",
                "name": "IPO Applications",
                "description": "Apply for upcoming IPOs with ASBA/UPI block mechanism directly through your bank account.",
                "provider": { "@type": "Organization", "name": "Shri Parasram Holdings Panipat" },
                "serviceType": "IPO Application Services",
                "areaServed": "Panipat, Haryana"
              }
            },
            {
              "@type": "ListItem",
              "position": 4,
              "item": {
                "@type": "Service",
                "name": "F&O Trading",
                "description": "Trade futures and options on NSE with advanced risk management tools.",
                "provider": { "@type": "Organization", "name": "Shri Parasram Holdings Panipat" },
                "serviceType": "Derivatives Trading",
                "areaServed": "Panipat, Haryana"
              }
            },
            {
              "@type": "ListItem",
              "position": 5,
              "item": {
                "@type": "Service",
                "name": "Commodities Trading",
                "description": "Trade gold, silver, crude oil, and agricultural commodities on MCX and NCDEX.",
                "provider": { "@type": "Organization", "name": "Shri Parasram Holdings Panipat" },
                "serviceType": "Commodity Trading",
                "areaServed": "Panipat, Haryana"
              }
            },
            {
              "@type": "ListItem",
              "position": 6,
              "item": {
                "@type": "Service",
                "name": "Unlisted Shares",
                "description": "Buy and sell pre-IPO and unlisted company shares through Parasram India's Unlisted Space.",
                "provider": { "@type": "Organization", "name": "Shri Parasram Holdings Panipat" },
                "serviceType": "Unlisted Securities Trading",
                "areaServed": "India"
              }
            },
            {
              "@type": "ListItem",
              "position": 7,
              "item": {
                "@type": "Service",
                "name": "Demat Account Opening",
                "description": "Open a free Demat and trading account backed by CDSL/NSDL with zero AMC for first year.",
                "provider": { "@type": "Organization", "name": "Shri Parasram Holdings Panipat" },
                "serviceType": "Depository Participant Services",
                "areaServed": "Panipat, Haryana"
              }
            },
            {
              "@type": "ListItem",
              "position": 8,
              "item": {
                "@type": "Service",
                "name": "Portfolio Management & Research",
                "description": "Daily stock recommendations, portfolio advisory and market research by certified analysts.",
                "provider": { "@type": "Organization", "name": "Shri Parasram Holdings Panipat" },
                "serviceType": "Investment Advisory",
                "areaServed": "Panipat, Haryana"
              }
            }
          ]
        }}
      />
      <ScrollProgress />
      <Header />
      <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Services" }]} />
      <Services />
      <InvestmentTools />
      <SIPCalculator />
      <ClientMarquee />
      <MobileApp />
      <Footer />
      <WhatsAppButton />
      </div>
    </PageTransition>
  );
};

export default ServicesPage;
