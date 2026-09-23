import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight, Bot, Check, Download, Globe, Layers, LineChart, Monitor, Moon, Rocket, ShieldCheck, Sparkles, Zap,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import SEOHead from "@/components/SEOHead";
import PageTransition from "@/components/PageTransition";
import WhatsAppButton from "@/components/WhatsAppButton";
import StoreButtons from "@/components/apps/StoreButtons";
import StoreStats from "@/components/apps/StoreStats";
import AppStatsBand from "@/components/apps/AppStatsBand";
import AppQrCodes from "@/components/apps/AppQrCodes";
import ScreenshotStrip from "@/components/apps/ScreenshotStrip";
import VideoPlayer from "@/components/apps/VideoPlayer";
import {
  DESKTOP_SHOT, DESKTOP_VIDEO, MONEY_FEATURES, MONEY_HERO, MONEY_HERO_BACK, MONEY_SCREENS,
  SCREEN_SIZE, TRADE_HERO, TRADE_SCREENS,
} from "@/components/apps/appMedia";
import { appById, MONEYMAKER_DOWNLOAD_URL, type TradingApp } from "@/lib/trading-apps";
import { HIGH_FETCH_PRIORITY } from "@/lib/fetch-priority";
import { revealItem, revealItemX, revealSection } from "@/lib/motion";
import { useT } from "@/i18n/LanguageContext";
import { translations } from "@/i18n/config";

const SITE = "https://www.sphpnp.com";
const money = appById("money");
const trade = appById("trade");

const MONEY_CAPABILITIES = [
  { icon: Bot, key: "apps.cap.algo" },
  { icon: Zap, key: "apps.cap.pledge" },
  { icon: Layers, key: "apps.cap.optionChain" },
  { icon: LineChart, key: "apps.cap.technicals" },
  { icon: Rocket, key: "apps.cap.ipo" },
  { icon: Moon, key: "apps.cap.dark" },
];
const DESKTOP_POINTS = [1, 2, 3, 4, 5].map((n) => `apps.desktop.point${n}`);
const TRADE_POINTS = [1, 2, 3, 4].map((n) => `apps.trade.point${n}`);
const FAQ_KEYS = [1, 2, 3, 4].map((n) => ({ q: `apps.faq.q${n}`, a: `apps.faq.a${n}` }));

// Search data stays English: it describes the prerendered (English) page.
const en = translations.en;
const FAQ_SCHEMA = FAQ_KEYS.map(({ q, a }) => ({ question: en[q], answer: en[a] }));

const softwareApp = (app: TradingApp, description: string) => ({
  "@type": "SoftwareApplication",
  name: app.name,
  description,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Android, iOS",
  offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
  installUrl: [app.playHref, app.iosHref],
  publisher: { "@type": "Organization", name: "Shri Parasram Holdings Pvt. Ltd.", url: SITE },
});

// VideoObject lets Google list the tour as a video result. Thumbnail and file
// are stable public URLs (not hashed build assets), so the markup stays valid.
const SCHEMA = {
  "@graph": [
    {
      "@type": "VideoObject",
      name: "MoneyMaker desktop trading terminal - 40-second product tour",
      description:
        "A walkthrough of MoneyMaker, the Windows trading terminal behind Parasram Money: logging in, colour-coded NSE cash and F&O price views, Best-5 market depth, live alerts, gainers and most-active panels, and F&O order entry.",
      thumbnailUrl: [`${SITE}${DESKTOP_VIDEO.poster}`],
      uploadDate: "2026-09-23",
      duration: "PT40S",
      contentUrl: `${SITE}${DESKTOP_VIDEO.hd}`,
      width: DESKTOP_VIDEO.width,
      height: DESKTOP_VIDEO.height,
      inLanguage: "en-IN",
      publisher: { "@type": "Organization", name: "Shri Parasram Holdings Pvt. Ltd.", url: SITE, logo: { "@type": "ImageObject", url: `${SITE}/logo.png` } },
    },
    softwareApp(money, "Parasram Money trading app: Tradetron no-code algo trading, instant margin pledge, option chain, technicals, IPO and back office."),
    softwareApp(trade, "Parasram Trade, the Symphony XTS trading app: market watch, price ladder, market depth and option chain."),
  ],
};

const PhoneShot = ({ src, alt, className = "", eager = false }: { src: string; alt: string; className?: string; eager?: boolean }) => (
  <img
    src={src}
    alt={alt}
    width={SCREEN_SIZE.width}
    height={SCREEN_SIZE.height}
    loading={eager ? "eager" : "lazy"}
    {...(eager ? HIGH_FETCH_PRIORITY : {})}
    decoding="async"
    className={`h-auto rounded-[2rem] border-[6px] border-foreground/90 bg-foreground shadow-2xl ${className}`}
  />
);

const WebLink = ({ href, className }: { href: string; className: string }) => {
  const { t } = useT();
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`mt-4 inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:text-secondary hover:underline ${className}`}>
      <Globe className="h-4 w-4" aria-hidden /> {t("store.openInBrowser")}
    </a>
  );
};

const AppsPage = () => {
  const { t } = useT();
  return (
  <PageTransition>
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Parasram Money & Parasram Trade Apps | Parasram India"
        description="Get Parasram Money, our new app with Tradetron algo trading and instant margin pledge, on Android and iPhone. Plus Parasram Trade and MoneyMaker desktop."
        ogImage={`${SITE}/og-apps-2026.jpg`}
        breadcrumbs={[{ name: "Home", url: "/" }, { name: "Apps" }]}
        faqItems={FAQ_SCHEMA}
        jsonLd={SCHEMA}
      />
      <Header />
      <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: t("nav.apps") }]} />

      <main>
        {/* ── Parasram Money: the lead ─────────────────────────────── */}
        <section id="money" aria-labelledby="money-heading" className="relative overflow-hidden bg-hero text-primary-foreground scroll-mt-24">
          <div className="pointer-events-none absolute -right-40 top-10 h-[28rem] w-[28rem] rounded-full bg-secondary/25 blur-3xl" />
          <div className="pointer-events-none absolute -left-32 bottom-0 h-80 w-80 rounded-full bg-brand-gold/10 blur-3xl" />

          <div className="container relative mx-auto grid items-center gap-12 px-4 py-14 md:py-20 lg:grid-cols-[1.1fr_0.9fr]">
            <motion.div {...revealItemX("left")}>
              <span className="inline-flex items-center gap-2 rounded-full border border-secondary/40 bg-secondary/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5 text-secondary" aria-hidden /> {t("apps.newApp")}
              </span>
              <h1 id="money-heading" className="mt-5 font-heading text-4xl font-bold leading-[1.05] md:text-6xl">
                {t(money.nameKey)}
                <span className="mt-3 block text-2xl font-semibold text-primary-foreground/85 md:text-3xl">{t("apps.hero.tagline")}</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-primary-foreground/80">{t("apps.hero.body")}</p>

              <ul className="mt-8 grid max-w-xl gap-x-6 gap-y-3 sm:grid-cols-2">
                {MONEY_CAPABILITIES.map(({ icon: Icon, key }) => (
                  <li key={key} className="flex items-center gap-3 text-sm font-medium">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/20">
                      <Icon className="h-4 w-4 text-secondary" aria-hidden />
                    </span>
                    {t(key)}
                  </li>
                ))}
              </ul>

              <div className="mt-10 flex flex-wrap items-end gap-8">
                <div>
                  <StoreButtons app={money} />
                  <StoreStats app={money} className="mt-3 text-primary-foreground" />
                  <WebLink href={money.webHref} className="text-primary-foreground/80" />
                </div>
                <AppQrCodes app={money} className="text-primary-foreground" />
              </div>
            </motion.div>

            {/* Two phones, overlapped for depth: watchlist in front, option chain behind. */}
            <motion.div {...revealItemX("right")} className="relative mx-auto flex w-full max-w-md justify-center py-6">
              <PhoneShot {...MONEY_HERO_BACK} className="absolute right-0 top-0 w-48 rotate-6 opacity-90 sm:w-56" />
              <PhoneShot {...MONEY_HERO} eager className="relative -ml-24 w-56 -rotate-3 sm:w-64" />
            </motion.div>
          </div>
        </section>

        <AppStatsBand />

        {/* ── What's new ──────────────────────────────────────────── */}
        <section aria-labelledby="new-heading" className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <motion.div {...revealSection} className="mb-10 max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-wider text-secondary">{t("apps.new.eyebrow")}</p>
              <h2 id="new-heading" className="mt-2 font-heading text-3xl font-bold text-foreground md:text-4xl">{t("apps.new.heading")}</h2>
            </motion.div>
            <div className="grid gap-8 lg:grid-cols-2">
              {MONEY_FEATURES.map((f, i) => (
                <motion.article
                  key={f.id}
                  id={f.id}
                  {...revealItem(i)}
                  className="group overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-shadow duration-base hover:shadow-xl scroll-mt-24"
                >
                  <figure className="overflow-hidden">
                    <img
                      src={f.image.src}
                      alt={f.image.alt}
                      width={1280}
                      height={960}
                      loading="lazy"
                      decoding="async"
                      className="h-auto w-full transition-transform duration-slow ease-out group-hover:scale-[1.02]"
                    />
                  </figure>
                  <div className="p-6 md:p-8">
                    <h3 className="font-heading text-2xl font-bold text-foreground">{t(f.titleKey)}</h3>
                    <p className="mt-2 text-muted-foreground">{t(f.bodyKey)}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Inside the app ─────────────────────────────────────── */}
        <section aria-labelledby="screens-heading" className="bg-muted/40 py-16 md:py-20">
          <div className="container mx-auto px-4">
            <motion.div {...revealSection} className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="max-w-xl">
                <h2 id="screens-heading" className="font-heading text-3xl font-bold text-foreground">{t("apps.screens.heading")}</h2>
                <p className="mt-2 text-muted-foreground">{t("apps.screens.body")}</p>
              </div>
              <StoreButtons app={money} tone="onLight" size="sm" />
            </motion.div>
            <ScreenshotStrip screens={MONEY_SCREENS} label={t("apps.screens.heading")} />
          </div>
        </section>

        {/* ── MoneyMaker desktop ─────────────────────────────────── */}
        <section id="desktop" aria-labelledby="desktop-heading" className="relative overflow-hidden bg-hero py-16 text-primary-foreground md:py-24 scroll-mt-24">
          <div className="container relative mx-auto px-4">
            <motion.div {...revealSection} className="mx-auto mb-10 max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                <Monitor className="h-3.5 w-3.5 text-secondary" aria-hidden /> {t("apps.desktop.eyebrow")}
              </span>
              <h2 id="desktop-heading" className="mt-4 font-heading text-3xl font-bold md:text-5xl">{t("apps.desktop.heading")}</h2>
              <p id="desktop-summary" className="mt-4 text-lg text-primary-foreground/80">{t("apps.desktop.body")}</p>
            </motion.div>

            <motion.div {...revealSection} className="mx-auto max-w-5xl">
              <VideoPlayer
                eyebrow={t("apps.video.eyebrow")}
                title={t("apps.video.title")}
                describedBy="desktop-summary"
                hdSrc={DESKTOP_VIDEO.hd}
                sdSrc={DESKTOP_VIDEO.sd}
                poster={DESKTOP_VIDEO.poster}
                posterAlt="MoneyMaker desktop terminal showing the NSE F&O futures price view with live buy and sell quotes"
                width={DESKTOP_VIDEO.width}
                height={DESKTOP_VIDEO.height}
              />
            </motion.div>

            <div className="mx-auto mt-14 grid max-w-6xl items-center gap-10 lg:grid-cols-[1.4fr_1fr]">
              <motion.figure {...revealItemX("left")}>
                <img
                  src={DESKTOP_SHOT.src}
                  alt="MoneyMaker desktop trading terminal with the NSE F&O price view, Best-5 market depth window, top gainers and live market alerts"
                  width={DESKTOP_SHOT.width}
                  height={DESKTOP_SHOT.height}
                  loading="lazy"
                  decoding="async"
                  className="h-auto w-full rounded-xl shadow-2xl ring-1 ring-white/10"
                />
              </motion.figure>
              <motion.div {...revealItemX("right")}>
                <h3 className="font-heading text-2xl font-bold">{t("apps.desktop.builtFor")}</h3>
                <ul className="mt-5 space-y-3">
                  {DESKTOP_POINTS.map((k) => (
                    <li key={k} className="flex gap-3 text-primary-foreground/85">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-secondary" aria-hidden />
                      {t(k)}
                    </li>
                  ))}
                </ul>
                <a
                  href={MONEYMAKER_DOWNLOAD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 inline-flex items-center gap-2 rounded-xl bg-secondary px-5 py-3 font-semibold text-secondary-foreground shadow-lg transition-[background-color,transform] duration-fast ease-out hover:-translate-y-0.5 hover:bg-secondary/90"
                >
                  <Download className="h-4 w-4" aria-hidden /> {t("apps.desktop.download")}
                </a>
                <p className="mt-2 text-xs text-primary-foreground/60">{t("apps.desktop.downloadNote")}</p>
                <Link to="/contact#contact-form" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary-foreground/85 hover:text-secondary">
                  {t("apps.desktop.help")} <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Parasram Trade ─────────────────────────────────────── */}
        <section id="trade" aria-labelledby="trade-heading" className="py-16 md:py-24 scroll-mt-24">
          <div className="container mx-auto grid items-center gap-12 px-4 lg:grid-cols-[0.8fr_1.2fr]">
            <motion.div {...revealItemX("left")} className="flex justify-center">
              <PhoneShot {...TRADE_HERO} className="w-60 sm:w-64" />
            </motion.div>
            <motion.div {...revealItemX("right")}>
              <p className="text-sm font-semibold uppercase tracking-wider text-secondary">Symphony XTS</p>
              <h2 id="trade-heading" className="mt-2 font-heading text-3xl font-bold text-foreground md:text-4xl">{t(trade.nameKey)}</h2>
              <p className="mt-4 max-w-xl text-muted-foreground">{t("apps.trade.body")}</p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {TRADE_POINTS.map((k) => (
                  <li key={k} className="flex gap-2.5 text-sm text-foreground">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-secondary" aria-hidden />
                    {t(k)}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap items-end gap-8">
                <div>
                  <StoreButtons app={trade} tone="onLight" />
                  <StoreStats app={trade} className="mt-3 text-foreground" />
                  <WebLink href={trade.webHref} className="text-muted-foreground" />
                </div>
                <AppQrCodes app={trade} className="text-foreground" />
              </div>
            </motion.div>
          </div>
          <div className="container mx-auto mt-12 px-4">
            <ScreenshotStrip screens={TRADE_SCREENS.slice(1)} label={t(trade.nameKey)} />
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────── */}
        <section aria-labelledby="apps-faq-heading" className="border-t border-border bg-muted/30 py-16">
          <div className="container mx-auto max-w-3xl px-4">
            <h2 id="apps-faq-heading" className="font-heading text-2xl font-bold text-foreground">{t("apps.faq.heading")}</h2>
            <dl className="mt-6 divide-y divide-border">
              {FAQ_KEYS.map(({ q, a }) => (
                <div key={q} className="py-5">
                  <dt className="font-semibold text-foreground">{t(q)}</dt>
                  <dd className="mt-1.5 text-muted-foreground">{t(a)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppButton />
    </div>
  </PageTransition>
  );
};

export default AppsPage;
