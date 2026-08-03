import { motion } from "motion/react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import TelegramChannel from "@/components/TelegramChannel";
import PageTransition from "@/components/PageTransition";
import ScrollProgress from "@/components/ScrollProgress";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import WhatsAppButton from "@/components/WhatsAppButton";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { revealBar, revealSection } from "@/lib/motion";

const StockRecommendationsPage = () => {
  return (
    <PageTransition>
      <div className="min-h-screen bg-background flex flex-col">
        <SEOHead
          title="Stock Recommendations | Parasram India Panipat"
          description="Latest SEBI-compliant stock recommendations and daily market updates from Parasram India Panipat. Expert equity research for informed investment decisions."
          breadcrumbs={[
            { name: "Home", url: "/" },
            { name: "Learning Center", url: "/learn" },
            { name: "Stock Recommendations", url: "/learn/recommendations" }
          ]}
        />
        <ScrollProgress />
        <Header />
        <VisibleBreadcrumbs
          items={[
            { name: "Home", url: "/" },
            { name: "Learning Center", url: "/learn" },
            { name: "Stock Recommendations" },
          ]}
        />
        <main className="flex-grow pb-12">
          {/*
            The page heading. This used to be the risk warning, which meant the
            only h1 on a page about stock recommendations read "Strict Risk
            Warning & Investment Disclaimer" — wrong for search, and wrong for
            anyone navigating by headings. The warning is now an aside beneath
            it, still fully visible: it is SEBI-mandated, so it is not something
            to collapse behind a toggle.
          */}
          <motion.div className="container mx-auto px-4 pt-8 pb-6" {...revealSection}>
            <span className="inline-block text-secondary font-semibold text-xs uppercase tracking-wider mb-2">
              Research Desk
            </span>
            <h1 className="font-heading text-3xl md:text-5xl font-bold text-foreground mb-3">
              Stock Recommendations
            </h1>
            <motion.div
              className="w-20 h-1 bg-gradient-to-r from-secondary to-brand-gold rounded-full mb-4"
              {...revealBar}
            />
            <p className="text-muted-foreground max-w-2xl">
              SEBI-compliant equity calls and market updates from our Panipat research desk,
              published to our Telegram channel and mirrored here. Filter by call type or search
              for a specific stock.
            </p>
          </motion.div>

          <div className="container mx-auto px-4 mb-8">
            <aside
              aria-labelledby="risk-warning-heading"
              className="bg-destructive/10 border-l-4 border-destructive rounded-r-xl p-5 md:p-6 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <ShieldAlert className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <h2
                    id="risk-warning-heading"
                    className="font-heading font-bold text-destructive text-lg md:text-xl mb-2 flex items-center gap-2"
                  >
                    <AlertTriangle className="w-5 h-5 hidden sm:inline-block" />
                    Strict Risk Warning & Investment Disclaimer
                  </h2>
                  <div className="text-foreground/80 text-sm space-y-3">
                    <p>
                      <strong>Trading and investing in the securities market carries a high degree of risk.</strong> You could potentially lose some or all of your initial investment. The stock recommendations and market analysis provided on this page are strictly for <strong>educational and informational purposes only</strong> and do not constitute certified financial advice.
                    </p>
                    <p>
                      Parasram India Pvt. Ltd. provides these insights based on technical and fundamental analysis, but <strong>past performance does not guarantee future returns.</strong> You must conduct your own independent research or consult with a SEBI-registered financial advisor before executing any trades or investments.
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      By proceeding to view these recommendations, you acknowledge that all trading decisions are made entirely at your own risk.
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>

          {/* Dedicated page: high limit, stats band + search + category filters + date-grouped feed */}
          <TelegramChannel limit={100} showViewAll={false} showFilters={true} />
        </main>
        <Footer />
        <WhatsAppButton />
      </div>
    </PageTransition>
  );
};

export default StockRecommendationsPage;
