import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { LiveMarketProvider } from "@/hooks/useLiveMarket";
import { lazy, Suspense } from "react";
import { usePageTracking } from "@/hooks/usePageTracking";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

import useScrollToHash from "@/hooks/useScrollToHash";
import SmoothScroll from "@/components/SmoothScroll";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useLocation } from "react-router-dom";
import SmartPopup from "@/components/SmartPopup";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import CookieConsent from "@/components/CookieConsent";
import StickyMobileCTA from "@/components/StickyMobileCTA";

const PageTracker = () => { usePageTracking(); return null; };
const ScrollToHash = () => { useScrollToHash(); return null; };
const KeyboardShortcuts = () => { useKeyboardShortcuts(); return null; };

// Eagerly load the home page for fastest FCP
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { EASE_OUT } from "@/lib/motion";

// Lazy load all other pages
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ServicesPage = lazy(() => import("./pages/ServicesPage"));
const UnlistedSpacePage = lazy(() => import("./pages/UnlistedZonePage"));
const TeamPage = lazy(() => import("./pages/TeamPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const OpenAccountPage = lazy(() => import("./pages/OpenAccountPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const StockScreenerPage = lazy(() => import("./pages/StockScreenerPage"));
const HolidayCalendarPage = lazy(() => import("./pages/HolidayCalendarPage"));
const Week52TrackerPage = lazy(() => import("./pages/Week52TrackerPage"));
const FnODashboardPage = lazy(() => import("./pages/FnODashboardPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const MarginCalculatorPage = lazy(() => import("./pages/MarginCalculatorPage"));
const BrokerageCalculatorPage = lazy(() => import("./pages/BrokerageCalculatorPage"));
const StockComparisonPage = lazy(() => import("./pages/StockComparisonPage"));
const LearningCenterPage = lazy(() => import("./pages/LearningCenterPage"));
const BannerManagerPage = lazy(() => import("./pages/BannerManagerPage"));
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const DepositoryServicesPage = lazy(() => import("./pages/DepositoryServicesPage"));
const CareersPage = lazy(() => import("./pages/CareersPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const CookiePolicyPage = lazy(() => import("./pages/CookiePolicyPage"));
const TermsOfUsePage = lazy(() => import("./pages/TermsOfUsePage"));
const DisclaimerPage = lazy(() => import("./pages/DisclaimerPage"));
const InvestorCornerPage = lazy(() => import("./pages/InvestorCornerPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const StockRecommendationsPage = lazy(() => import("./pages/StockRecommendationsPage"));
const ArticlePage = lazy(() => import("./pages/ArticlePage"));
const SIPCalculatorPage = lazy(() => import("./pages/SIPCalculatorPage"));

// --- Professional branded loading screen ---
const candleVariants = {
  animate: (i: number) => ({
    scaleY: [0.3, 1, 0.5, 0.8, 0.3],
    transition: {
      duration: 1.4,
      repeat: Infinity,
      delay: i * 0.12,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  }),
};

const PageFallback = () => (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
    {/* Subtle grid background */}
    <div
      className="absolute inset-0 opacity-[0.02]"
      style={{
        backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
        backgroundSize: "50px 50px",
      }}
    />

    {/* Ambient glow */}
    <motion.div
      className="absolute w-64 h-64 bg-secondary/10 rounded-full blur-3xl"
      animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.3, 0.15] }}
      transition={{ duration: 3, repeat: Infinity }}
    />

    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="relative z-10 flex flex-col items-center"
    >
      {/* Stock chart candlestick animation */}
      <div className="flex items-end gap-1.5 h-16 mb-6">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <motion.div
            key={i}
            className={`w-2 rounded-sm origin-bottom ${i % 2 === 0 ? "bg-secondary" : "bg-destructive/60"}`}
            style={{ height: "100%" }}
            custom={i}
            variants={candleVariants}
            animate="animate"
          />
        ))}
      </div>

      {/* Brand text */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="font-heading text-lg font-bold text-foreground tracking-wide">
          Parasram India
        </h2>
        <p className="text-xs text-muted-foreground mt-1">Loading market data...</p>
      </motion.div>

      {/* Progress line */}
      <div className="w-48 h-0.5 bg-muted rounded-full mt-5 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-secondary to-brand-gold rounded-full"
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          style={{ width: "40%" }}
        />
      </div>
    </motion.div>
  </div>
);

const AnimatedRoutes = () => {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location}>
        <Route path="/" element={<Index />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/unlisted-space" element={<UnlistedSpacePage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/pricing" element={<PricingPage />} />
            <Route path="/open-account" element={<OpenAccountPage />} />
        <Route path="/screener" element={<StockScreenerPage />} />
        <Route path="/fno" element={<FnODashboardPage />} />
        <Route path="/holidays" element={<HolidayCalendarPage />} />
        <Route path="/52-week-tracker" element={<Week52TrackerPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/margin-calculator" element={<MarginCalculatorPage />} />
        <Route path="/brokerage-calculator" element={<BrokerageCalculatorPage />} />
        <Route path="/compare" element={<StockComparisonPage />} />
        <Route path="/learn" element={<LearningCenterPage />} />
        <Route path="/banner-manager" element={<BannerManagerPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/depository-services" element={<DepositoryServicesPage />} />
        <Route path="/careers" element={<CareersPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/cookie-policy" element={<CookiePolicyPage />} />
        <Route path="/terms" element={<TermsOfUsePage />} />
        <Route path="/disclaimer" element={<DisclaimerPage />} />
        <Route path="/investor-corner" element={<InvestorCornerPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/learn/recommendations" element={<StockRecommendationsPage />} />
        <Route path="/learn/:slug" element={<ArticlePage />} />
        <Route path="/sip-calculator" element={<SIPCalculatorPage />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
};

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <LanguageProvider>
    <QueryClientProvider client={queryClient}>
      {/* One default curve for every Motion animation on the site. Around 90
          of them specified no easing at all and silently fell back to Motion's
          default, which is why the same reveal felt different from page to
          page. Anything that sets its own `ease` still wins. */}
      <MotionConfig reducedMotion="user" transition={{ ease: EASE_OUT }}>
      <TooltipProvider>
        <LiveMarketProvider>
        <Toaster />
        <Sonner />
        <Analytics />
        <SpeedInsights />
        <BrowserRouter>
          <AuthProvider>
            <PageTracker />
            <ScrollToHash />
            <KeyboardShortcuts />
            <SmartPopup />
            <CookieConsent />
            <StickyMobileCTA />
            <ErrorBoundary>
              <SmoothScroll>
                <Suspense fallback={<PageFallback />}>
                  <AnimatedRoutes />
                </Suspense>
              </SmoothScroll>
            </ErrorBoundary>
          </AuthProvider>
        </BrowserRouter>
      </LiveMarketProvider>
    </TooltipProvider>
      </MotionConfig>
  </QueryClientProvider>
    </LanguageProvider>
  </HelmetProvider>
);

export default App;
