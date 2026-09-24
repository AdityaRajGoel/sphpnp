import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight, Bell, Bot, Check, Code2, Download, ExternalLink, Globe, Keyboard, Layers, LayoutGrid, LineChart, Monitor, Moon, Rocket, ShieldAlert, Sparkles, Zap,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import SEOHead from "@/components/SEOHead";
import PageTransition from "@/components/PageTransition";
import WhatsAppButton from "@/components/WhatsAppButton";
import FAQ from "@/components/FAQ";
import StoreButtons from "@/components/apps/StoreButtons";
import StoreStats from "@/components/apps/StoreStats";
import AppStatsBand from "@/components/apps/AppStatsBand";
import AppQrCodes from "@/components/apps/AppQrCodes";
import ScreenshotStrip from "@/components/apps/ScreenshotStrip";
import VideoPlayer from "@/components/apps/VideoPlayer";
import PlatformLineup from "@/components/apps/PlatformLineup";
import {
  DESKTOP_SHOT, DESKTOP_VIDEO, MONEY_FEATURES, MONEY_HERO, MONEY_SCREENS, SCREEN_SIZE, TRADE_HERO, TRADE_SCREENS,
} from "@/components/apps/appMedia";
import { appById, MONEYMAKER_DOWNLOAD_URL, TRADEX_DOCS_URL, XTS_DESKTOP, type TradingApp } from "@/lib/trading-apps";
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
const FEATURE_BULLETS: Record<string, string[]> = {
  tradetron: ["apps.feature.tradetron.b1", "apps.feature.tradetron.b2", "apps.feature.tradetron.b3"],
  "margin-pledge": ["apps.feature.pledge.b1", "apps.feature.pledge.b2", "apps.feature.pledge.b3"],
};
const FEATURE_ICON: Record<string, typeof Bot> = { tradetron: Bot, "margin-pledge": Zap };
const DESKTOP_POINTS = [
  { icon: LayoutGrid, key: "apps.desktop.point1" },
  { icon: Layers, key: "apps.desktop.point2" },
  { icon: Bell, key: "apps.desktop.point3" },
  { icon: LineChart, key: "apps.desktop.point4" },
  { icon: Keyboard, key: "apps.desktop.point5" },
];
const TRADE_POINTS = [1, 2, 3, 4].map((n) => `apps.trade.point${n}`);
// From Saral's TradeX reference (read 2026-09-23): login fields, algol_id
// (broker-issued, 1001-2099 for algo orders), strategy_id, WebSocket packets,
// key IP/domain and exchange/product locks. "tradetron" is a named login source.
const API_POINTS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `apps.api.p${n}`);
const FAQ_KEYS = [1, 2, 3, 4, 5].map((n) => ({ q: `apps.faq.q${n}`, a: `apps.faq.a${n}` }));
const SECTIONS = [
  { id: "whats-new", key: "apps.nav.new" },
  { id: "screens", key: "apps.nav.screens" },
  { id: "desktop", key: "apps.nav.desktop" },
  { id: "api", key: "apps.nav.api" },
  { id: "trade", key: "cta.parasramTrade" },
  { id: "platforms", key: "apps.nav.platforms" },
  { id: "faq", key: "apps.nav.faq" },
];

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

const Eyebrow = ({ children }: { children: ReactNode }) => (
  <p className="text-xs font-bold uppercase tracking-[0.14em] text-secondary">{children}</p>
);

const WebLink = ({ href, className }: { href: string; className: string }) => {
  const { t } = useT();
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:text-secondary hover:underline ${className}`}>
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
          {/* ── Hero: Parasram Money ─────────────────────────────────────── */}
          <section id="money" aria-labelledby="money-heading" className="relative overflow-hidden bg-hero text-primary-foreground scroll-mt-28">
            <div className="container relative mx-auto grid items-center gap-12 px-4 pb-16 pt-12 md:pb-20 md:pt-16 lg:grid-cols-[1.15fr_0.85fr]">
              <motion.div {...revealItemX("left")}>
                <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-bold uppercase tracking-wider text-secondary-foreground">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden /> {t("apps.newApp")}
                </span>
                <h1 id="money-heading" className="mt-5 font-heading text-5xl font-bold leading-[1.02] tracking-tight md:text-7xl">{t(money.nameKey)}</h1>
                <p className="mt-4 text-2xl font-semibold text-primary-foreground/90 md:text-3xl">{t("apps.hero.tagline")}</p>
                <p className="mt-5 max-w-xl text-lg leading-relaxed text-primary-foreground/75">{t("apps.hero.body")}</p>

                <ul className="mt-8 grid max-w-xl grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                  {MONEY_CAPABILITIES.map(({ icon: Icon, key }) => (
                    <li key={key} className="flex items-center gap-2.5 text-sm font-medium">
                      <Icon className="h-4 w-4 shrink-0 text-secondary" aria-hidden />
                      {t(key)}
                    </li>
                  ))}
                </ul>

                <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-5">
                  <div className="space-y-3">
                    <StoreButtons app={money} />
                    <StoreStats app={money} className="text-primary-foreground" />
                    <WebLink href={money.webHref} className="text-primary-foreground/75" />
                  </div>
                  <div className="hidden rounded-2xl border border-white/15 bg-white/[0.06] p-4 backdrop-blur-sm md:block">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary-foreground/70">{t("apps.hero.scan")}</p>
                    <AppQrCodes app={money} className="text-primary-foreground" />
                  </div>
                </div>
              </motion.div>

              {/* One phone, with the two new features pinned beside it. */}
              <motion.div {...revealItemX("right")} className="relative mx-auto w-full max-w-sm py-6">
                <img
                  src={MONEY_HERO.src}
                  alt={MONEY_HERO.alt}
                  width={SCREEN_SIZE.width}
                  height={SCREEN_SIZE.height}
                  loading="eager"
                  {...HIGH_FETCH_PRIORITY}
                  decoding="async"
                  className="relative mx-auto w-64 rounded-[2.2rem] border-[7px] border-foreground/90 bg-foreground shadow-[0_40px_80px_-20px_rgb(0_0_0/0.6)] sm:w-72"
                />
                {[
                  { icon: Bot, key: "apps.feature.tradetron.title", pos: "left-0 top-0 sm:-left-16" },
                  { icon: Zap, key: "apps.feature.pledge.title", pos: "bottom-0 right-0 sm:-right-12" },
                ].map(({ icon: Icon, key, pos }) => (
                  <span key={key} className={`absolute ${pos} flex items-center gap-2 rounded-xl bg-card px-3.5 py-2.5 text-sm font-semibold text-foreground shadow-xl ring-1 ring-black/5`}>
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary/15 text-secondary"><Icon className="h-4 w-4" aria-hidden /></span>
                    {t(key)}
                  </span>
                ))}
              </motion.div>
            </div>
          </section>

          <AppStatsBand />

          {/* ── In-page navigation ───────────────────────────────────────── */}
          <nav aria-label={t("apps.nav.label")} className="border-b border-border bg-background">
            <ul className="container mx-auto flex gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none]">
              {SECTIONS.map((s) => (
                <li key={s.id} className="shrink-0">
                  <a href={`#${s.id}`} className="inline-flex min-h-[40px] items-center rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                    {t(s.key)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* ── What's new: two feature rows ─────────────────────────────── */}
          <section id="whats-new" aria-labelledby="new-heading" className="py-16 md:py-24 scroll-mt-28">
            <div className="container mx-auto px-4">
              <motion.div {...revealSection} className="mb-12 max-w-2xl">
                <Eyebrow>{t("apps.new.eyebrow")}</Eyebrow>
                <h2 id="new-heading" className="mt-2 font-heading text-3xl font-bold text-foreground md:text-5xl">{t("apps.new.heading")}</h2>
              </motion.div>
              <div className="space-y-16 md:space-y-24">
                {MONEY_FEATURES.map((f, i) => {
                  const Icon = FEATURE_ICON[f.id];
                  return (
                    <motion.article key={f.id} id={f.id} {...revealItem(i)} className="grid items-center gap-8 scroll-mt-28 lg:grid-cols-2 lg:gap-14">
                      <figure className={i % 2 ? "lg:order-2" : ""}>
                        <img
                          src={f.image.src}
                          alt={f.image.alt}
                          width={1280}
                          height={960}
                          loading="lazy"
                          decoding="async"
                          className="h-auto w-full rounded-3xl shadow-2xl ring-1 ring-black/5"
                        />
                      </figure>
                      <div>
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/15 text-secondary"><Icon className="h-6 w-6" aria-hidden /></span>
                        <h3 className="mt-5 font-heading text-2xl font-bold text-foreground md:text-4xl">{t(f.titleKey)}</h3>
                        <p className="mt-3 text-lg text-muted-foreground">{t(f.bodyKey)}</p>
                        <ul className="mt-6 space-y-3">
                          {FEATURE_BULLETS[f.id].map((k) => (
                            <li key={k} className="flex gap-3 text-foreground">
                              <Check className="mt-0.5 h-5 w-5 shrink-0 text-secondary" aria-hidden />
                              {t(k)}
                            </li>
                          ))}
                        </ul>
                        {/* SEBI's algo circular bars brokers from any association with return
                            claims (Parasram was fined over Tradetron in March 2026); say so plainly. */}
                        {f.id === "tradetron" && (
                          <p className="mt-5 border-l-2 border-brand-gold/60 pl-3 text-xs leading-relaxed text-muted-foreground">{t("apps.feature.tradetron.risk")}</p>
                        )}
                        <StoreButtons app={money} tone="onLight" size="sm" className="mt-7" />
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ── Screens ──────────────────────────────────────────────────── */}
          <section id="screens" aria-labelledby="screens-heading" className="border-y border-border bg-muted/40 py-16 md:py-20 scroll-mt-28">
            <div className="container mx-auto px-4">
              <motion.div {...revealSection} className="mb-10 max-w-xl">
                <Eyebrow>{t(money.nameKey)}</Eyebrow>
                <h2 id="screens-heading" className="mt-2 font-heading text-3xl font-bold text-foreground md:text-4xl">{t("apps.screens.heading")}</h2>
                <p className="mt-3 text-muted-foreground">{t("apps.screens.body")}</p>
              </motion.div>
              <ScreenshotStrip screens={MONEY_SCREENS} label={t("apps.screens.heading")} />
            </div>
          </section>

          {/* ── MoneyMaker desktop ───────────────────────────────────────── */}
          <section id="desktop" aria-labelledby="desktop-heading" className="relative overflow-hidden bg-hero py-16 text-primary-foreground md:py-24 scroll-mt-28">
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

              <ul className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {DESKTOP_POINTS.map(({ icon: Icon, key }, i) => (
                  <motion.li key={key} {...revealItem(i)} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-secondary" aria-hidden />
                    <span className="text-sm text-primary-foreground/85">{t(key)}</span>
                  </motion.li>
                ))}
                <motion.li {...revealItem(DESKTOP_POINTS.length)} className="flex flex-col justify-center rounded-2xl bg-secondary p-4 text-secondary-foreground">
                  <a href={MONEYMAKER_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-semibold hover:underline">
                    <Download className="h-5 w-5" aria-hidden /> {t("apps.desktop.download")}
                  </a>
                  <span className="mt-1 text-xs">{t("apps.desktop.downloadNote")}</span>
                </motion.li>
              </ul>

              <div className="mx-auto mt-12 grid max-w-5xl items-center gap-8 lg:grid-cols-[1.5fr_1fr]">
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
                  <p className="mt-3 text-primary-foreground/75">{t("apps.desktop.body")}</p>
                  <Link to="/contact#contact-form" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-secondary hover:underline">
                    {t("apps.desktop.help")} <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </motion.div>
              </div>
            </div>
          </section>

          {/* ── TradeX API (Parasram Money) ──────────────────────────────── */}
          <section id="api" aria-labelledby="api-heading" className="py-16 md:py-24 scroll-mt-28">
            <div className="container mx-auto grid items-start gap-10 px-4 lg:grid-cols-[1fr_1.1fr]">
              <motion.div {...revealItemX("left")}>
                <Eyebrow>{t("apps.api.eyebrow")}</Eyebrow>
                <h2 id="api-heading" className="mt-2 font-heading text-3xl font-bold text-foreground md:text-4xl">{t("apps.api.heading")}</h2>
                <p className="mt-4 text-lg text-muted-foreground">{t("apps.api.body")}</p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <a href={TRADEX_DOCS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90">
                    <Code2 className="h-4 w-4" aria-hidden /> {t("apps.api.docs")} <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
                  </a>
                  <Link to="/contact#contact-form" className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 font-semibold text-foreground transition-colors hover:border-secondary hover:text-secondary">
                    {t("apps.api.request")} <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
                <p className="mt-6 flex gap-2 text-xs leading-relaxed text-muted-foreground">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" aria-hidden /> {t("apps.api.note")}
                </p>
              </motion.div>
              <motion.div {...revealItemX("right")} className="overflow-hidden rounded-2xl border border-border bg-[#0b1220] shadow-xl">
                <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5" aria-hidden>
                  <span className="h-2.5 w-2.5 rounded-full bg-white/20" /><span className="h-2.5 w-2.5 rounded-full bg-white/20" /><span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                  <span className="ml-2 text-xs text-white/50">TradeX API · v1</span>
                </div>
                {/* The login call from the published TradeX reference; placeholders, never real keys. */}
                <pre className="overflow-x-auto p-5 text-[13px] leading-relaxed text-slate-200" tabIndex={0} aria-label="Example TradeX login request"><code>{`POST /TradeXApi/v1/Login
Content-Type: application/json

{
  "user_id": "YOUR_CLIENT_ID",
  "app_key": "YOUR_APP_KEY",
  "secret_key": "YOUR_SECRET_KEY",
  "source": "web"
}

→ 200  { "data": { "token": "…" } }
   Authorization: Bearer <token>`}</code></pre>
                <ul className="space-y-2.5 border-t border-white/10 p-5">
                  {API_POINTS.map((k) => (
                    <li key={k} className="flex gap-2.5 text-sm text-slate-300">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary" aria-hidden /> {t(k)}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </section>

          {/* ── Parasram Trade ───────────────────────────────────────────── */}
          <section id="trade" aria-labelledby="trade-heading" className="py-16 md:py-24 scroll-mt-28">
            <div className="container mx-auto px-4">
              <div className="grid items-center gap-10 rounded-3xl border border-border bg-card p-6 shadow-sm md:p-10 lg:grid-cols-[auto_1fr]">
                <motion.img
                  {...revealItemX("left")}
                  src={TRADE_HERO.src}
                  alt={TRADE_HERO.alt}
                  width={SCREEN_SIZE.width}
                  height={SCREEN_SIZE.height}
                  loading="lazy"
                  decoding="async"
                  className="mx-auto w-52 rounded-[1.8rem] border-[6px] border-foreground/90 shadow-2xl sm:w-56"
                />
                <motion.div {...revealItemX("right")}>
                  <Eyebrow>Symphony XTS</Eyebrow>
                  <h2 id="trade-heading" className="mt-2 font-heading text-3xl font-bold text-foreground md:text-4xl">{t(trade.nameKey)}</h2>
                  <p className="mt-3 max-w-xl text-muted-foreground">{t("apps.trade.body")}</p>
                  <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                    {TRADE_POINTS.map((k) => (
                      <li key={k} className="flex gap-2.5 text-sm text-foreground">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary" aria-hidden />
                        {t(k)}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-7 flex flex-wrap items-end gap-x-8 gap-y-5">
                    <div className="space-y-3">
                      <StoreButtons app={trade} tone="onLight" />
                      <StoreStats app={trade} className="text-foreground" />
                      <WebLink href={trade.webHref} className="text-muted-foreground" />
                      <a href={XTS_DESKTOP.x64} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-secondary hover:underline">
                        <Monitor className="h-4 w-4" aria-hidden /> Symphony XTS · {t("apps.platforms.desktop")}
                      </a>
                    </div>
                    <AppQrCodes app={trade} className="text-foreground" />
                  </div>
                </motion.div>
              </div>
              <div className="mt-10">
                <ScreenshotStrip screens={TRADE_SCREENS.slice(1)} label={t(trade.nameKey)} />
              </div>
            </div>
          </section>

          {/* ── Platforms: new and earlier ───────────────────────────────── */}
          <section id="platforms" aria-labelledby="platforms-heading" className="border-t border-border bg-muted/30 py-16 md:py-20 scroll-mt-28">
            <div className="container mx-auto max-w-5xl px-4">
              <motion.div {...revealSection} className="mb-10 max-w-3xl">
                <h2 id="platforms-heading" className="font-heading text-3xl font-bold text-foreground md:text-4xl">{t("apps.platforms.heading")}</h2>
                <p className="mt-3 text-muted-foreground">{t("apps.platforms.body")}</p>
              </motion.div>
              <PlatformLineup />
            </div>
          </section>

          <div id="faq" className="scroll-mt-28">
            <FAQ title={t("apps.faq.heading")} items={FAQ_KEYS.map(({ q, a }) => ({ q: t(q), a: t(a) }))} />
          </div>
        </main>

        <Footer />
        <WhatsAppButton />
      </div>
    </PageTransition>
  );
};

export default AppsPage;
