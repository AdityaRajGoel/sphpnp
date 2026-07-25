/**
 * Ratchet allowlists for the motion sweep.
 *
 * These are the files that still violate the motion token rules. They shrink
 * to empty as the sweep proceeds and must never grow. `motion-tokens.test.ts`
 * fails both if a file outside the list violates (a regression) and if a file
 * on the list no longer violates (a stale entry), so deleting an entry is a
 * required part of migrating a file.
 */

/** Files still containing hardcoded `duration-<number>` Tailwind classes. */
export const DURATION_ALLOWLIST: readonly string[] = [
  "src/components/AIAnalysisModal.tsx",
  "src/components/About.tsx",
  "src/components/AnnouncementBar.tsx",
  "src/components/AwardsSection.tsx",
  "src/components/BannerMessage.tsx",
  "src/components/ClientMarquee.tsx",
  "src/components/Contact.tsx",
  "src/components/DailyResearch.tsx",
  "src/components/FloatingActions.tsx",
  "src/components/GoogleReviews.tsx",
  "src/components/InvestmentProducts.tsx",
  "src/components/InvestmentTools.tsx",
  "src/components/MarketNews.tsx",
  "src/components/MarketOverview.tsx",
  "src/components/MobileApp.tsx",
  "src/components/ScrollySteps.tsx",
  "src/components/Services.tsx",
  "src/components/TelegramChannel.tsx",
  "src/components/Testimonials.tsx",
  "src/components/ThemeToggle.tsx",
  "src/components/UnlistedShares.tsx",
  "src/components/WhatsAppButton.tsx",
  "src/components/WhyChooseUs.tsx",
  "src/pages/BrokerageCalculatorPage.tsx",
  "src/pages/ContactPage.tsx",
  "src/pages/DepositoryServicesPage.tsx",
  "src/pages/TeamPage.tsx",
];

/**
 * Files still hand-rolling `whileInView` reveals instead of using the presets.
 *
 * Eleven of these (About, BrandBanner, Contact, GoogleReviews,
 * InvestmentProducts, ScrollySteps, Services, Testimonials, UnlistedShares,
 * WhyChooseUs, TeamPage) already import `@/lib/motion` and use the presets in
 * some places while still hand-rolling reveals in others. The planning audit
 * treated "imports @/lib/motion" as "migrated" and missed them; this guard
 * found them on first run. Partial migration is the normal state here, so
 * membership is decided per-occurrence, never per-import.
 */
export const REVEAL_ALLOWLIST: readonly string[] = [
  "src/components/About.tsx",
  "src/components/AwardsSection.tsx",
  "src/components/BecomePartner.tsx",
  "src/components/BrandBanner.tsx",
  "src/components/CompanyTimeline.tsx",
  "src/components/CompanyValues.tsx",
  "src/components/Contact.tsx",
  "src/components/ContactForm.tsx",
  "src/components/DailyResearch.tsx",
  "src/components/FAQ.tsx",
  "src/components/Footer.tsx",
  "src/components/GoogleReviews.tsx",
  "src/components/HowItWorks.tsx",
  "src/components/IPOTracker.tsx",
  "src/components/InvestmentProducts.tsx",
  "src/components/InvestmentTools.tsx",
  "src/components/LiveChart.tsx",
  "src/components/MarketDashboard.tsx",
  "src/components/MarketNews.tsx",
  "src/components/MarketOverview.tsx",
  "src/components/MobileApp.tsx",
  "src/components/SIPCalculator.tsx",
  "src/components/ScrollySteps.tsx",
  "src/components/Services.tsx",
  "src/components/TelegramChannel.tsx",
  "src/components/Testimonials.tsx",
  "src/components/TrustBadges.tsx",
  "src/components/UnlistedShares.tsx",
  "src/components/WhyChooseUs.tsx",
  "src/pages/ArticlePage.tsx",
  "src/pages/BrokerageCalculatorPage.tsx",
  "src/pages/ContactPage.tsx",
  "src/pages/DepositoryServicesPage.tsx",
  "src/pages/HolidayCalendarPage.tsx",
  "src/pages/OpenAccountPage.tsx",
  "src/pages/PricingPage.tsx",
  "src/pages/ProductsPage.tsx",
  "src/pages/ReportsPage.tsx",
  "src/pages/TeamPage.tsx",
  "src/pages/UnlistedZonePage.tsx",
];
