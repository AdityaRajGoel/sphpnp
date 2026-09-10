import Header from "@/components/Header";
import StockTicker from "@/components/StockTicker";
import Hero from "@/components/Hero";
import ScrollProgress from "@/components/ScrollProgress";
import SEOHead from "@/components/SEOHead";
import AnnouncementBar from "@/components/AnnouncementBar";
import BannerMessage from "@/components/BannerMessage";
import FloatingActions from "@/components/FloatingActions";
import SectionShortcuts from "@/components/SectionShortcuts";
import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import PageTransition from "@/components/PageTransition";

// Lazy load below-fold heavy components
const InvestmentProducts = lazy(() => import("@/components/InvestmentProducts"));
const LiveChart = lazy(() => import("@/components/LiveChart"));
const MarketDashboard = lazy(() => import("@/components/MarketDashboard"));
const TrustBadges = lazy(() => import("@/components/TrustBadges"));
const AwardsSection = lazy(() => import("@/components/AwardsSection"));
const MarketOverview = lazy(() => import("@/components/MarketOverview"));
const IPOTracker = lazy(() => import("@/components/IPOTracker"));
const ClientMarquee = lazy(() => import("@/components/ClientMarquee"));
const MarketNews = lazy(() => import("@/components/MarketNews"));
const WhyChooseUs = lazy(() => import("@/components/WhyChooseUs"));
const DailyResearch = lazy(() => import("@/components/DailyResearch"));
const TelegramChannel = lazy(() => import("@/components/TelegramChannel"));
const BecomePartner = lazy(() => import("@/components/BecomePartner"));
const Footer = lazy(() => import("@/components/Footer"));

const SectionSkeleton = ({ height = "h-64" }: { height?: string }) => (
  <div className={`container mx-auto px-4 py-8`}>
    <Skeleton className={`${height} w-full rounded-xl`} />
  </div>
);

const Index = () => {
  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
      <SEOHead
        title="Best Stock Broker in Panipat | Shri Parasram Holdings Panipat"
        description="SEBI-registered stock broker in Panipat since 1997, serving investors since 1970. Open a free Demat account. Trade stocks, mutual funds, IPO, F&O, commodities and unlisted shares."
        breadcrumbs={[{ name: "Home", url: "/" }]}
      />
      <BannerMessage />
      <ScrollProgress />
      <Header />
      <AnnouncementBar />
      <StockTicker />
      <main id="main-content">
      <Hero />
      <Suspense fallback={<SectionSkeleton height="h-96" />}>
        <InvestmentProducts />
      </Suspense>
      <Suspense fallback={<SectionSkeleton height="h-96" />}>
        <LiveChart />
      </Suspense>
      <Suspense fallback={<SectionSkeleton height="h-80" />}>
        <MarketDashboard />
      </Suspense>
      {/* Desktop-only: mobile keeps the home page short and conversion-focused */}
      <div className="hidden md:block">
        <Suspense fallback={<SectionSkeleton height="h-32" />}>
          <TrustBadges />
        </Suspense>
      </div>
      <div className="hidden md:block">
        <Suspense fallback={<SectionSkeleton height="h-64" />}>
          <AwardsSection />
        </Suspense>
      </div>
      <Suspense fallback={<SectionSkeleton height="h-96" />}>
        <MarketOverview />
      </Suspense>
      <Suspense fallback={<SectionSkeleton height="h-64" />}>
        <IPOTracker />
      </Suspense>
      <Suspense fallback={<SectionSkeleton height="h-24" />}>
        <ClientMarquee />
      </Suspense>
      <Suspense fallback={<SectionSkeleton height="h-64" />}>
        <MarketNews />
      </Suspense>
      <Suspense fallback={<SectionSkeleton height="h-64" />}>
        <DailyResearch />
      </Suspense>
      {/* Why Choose Us sits after the market tools: someone who came for a
          number gets it first, and the case for us is made to a reader who has
          already stayed. About, Our Legacy and Contact deliberately do NOT
          appear here - /about and /contact are their home, and duplicating them
          on the home page competed with those pages for the same search intent
          on a site already struggling to get its pages indexed. */}
      <Suspense fallback={<SectionSkeleton height="h-64" />}>
        <WhyChooseUs />
      </Suspense>
      <Suspense fallback={<SectionSkeleton height="h-80" />}>
        <TelegramChannel limit={4} showViewAll={true} />
      </Suspense>
      <div className="hidden md:block">
        <Suspense fallback={<SectionSkeleton height="h-80" />}>
          <BecomePartner />
        </Suspense>
      </div>
      </main>
      <Suspense fallback={<SectionSkeleton height="h-48" />}>
        <Footer />
      </Suspense>
      <FloatingActions />
      <SectionShortcuts />
      </div>
    </PageTransition>
  );
};

export default Index;
