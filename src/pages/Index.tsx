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
const HomeStories = lazy(() => import("@/components/HomeStories"));
const LiveChart = lazy(() => import("@/components/LiveChart"));
const MarketDashboard = lazy(() => import("@/components/MarketDashboard"));
const HomeMarketGlance = lazy(() => import("@/components/markets/HomeMarketGlance"));
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
        title="Best Stock Broker in Panipat | Shri Parasram Holdings"
        description="SEBI-registered stock broker in Panipat since 1997, serving investors since 1970. Free Demat account for stocks, mutual funds, IPOs, F&O and unlisted shares."
        breadcrumbs={[{ name: "Home", url: "/" }]}
      />
      <BannerMessage />
      <ScrollProgress />
      <Header />
      <AnnouncementBar />
      <StockTicker />
      <main id="main-content">
      <Hero />
      {/*
        The page runs in five groups, each kept together:
          1. What we offer   - products, then how the branch helps
          2. Markets today   - indices, movers, sentiment and flows, breadth
          3. IPOs
          4. Research & news - the branch's reports, its calls, the headlines
          5. Why Parasram    - the case, the credentials, the awards, the reviews
        The market sections used to be split by the trust badges and awards,
        and the reasons to choose us were spread over four places; a reader
        crossing the page now meets each subject once. About, Our Legacy and
        Contact still do NOT appear here - /about and /contact are their home,
        and duplicating them competed with those pages for the same searches.
      */}
      <Suspense fallback={<SectionSkeleton height="h-96" />}>
        <InvestmentProducts />
      </Suspense>
      <Suspense fallback={<SectionSkeleton height="h-96" />}>
        <HomeStories />
      </Suspense>

      <Suspense fallback={<SectionSkeleton height="h-96" />}>
        <LiveChart />
      </Suspense>
      <Suspense fallback={<SectionSkeleton height="h-96" />}>
        <MarketOverview />
      </Suspense>
      <Suspense fallback={<SectionSkeleton height="h-80" />}>
        <MarketDashboard />
      </Suspense>
      <Suspense fallback={<SectionSkeleton height="h-80" />}>
        <HomeMarketGlance />
      </Suspense>

      <Suspense fallback={<SectionSkeleton height="h-64" />}>
        <IPOTracker />
      </Suspense>

      <Suspense fallback={<SectionSkeleton height="h-64" />}>
        <DailyResearch />
      </Suspense>
      <Suspense fallback={<SectionSkeleton height="h-80" />}>
        <TelegramChannel limit={4} showViewAll={true} />
      </Suspense>
      <Suspense fallback={<SectionSkeleton height="h-64" />}>
        <MarketNews />
      </Suspense>

      <Suspense fallback={<SectionSkeleton height="h-64" />}>
        <WhyChooseUs />
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
      <Suspense fallback={<SectionSkeleton height="h-24" />}>
        <ClientMarquee />
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
