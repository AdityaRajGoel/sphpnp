import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight, Bot, Check, Globe, Layers, LineChart, Monitor, Moon, Rocket, ShieldCheck, Sparkles, Zap,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import SEOHead from "@/components/SEOHead";
import PageTransition from "@/components/PageTransition";
import WhatsAppButton from "@/components/WhatsAppButton";
import StoreButtons from "@/components/apps/StoreButtons";
import AppQrCodes from "@/components/apps/AppQrCodes";
import ScreenshotStrip from "@/components/apps/ScreenshotStrip";
import VideoPlayer from "@/components/apps/VideoPlayer";
import {
  DESKTOP_SHOT, DESKTOP_VIDEO, MONEY_FEATURES, MONEY_HERO, MONEY_HERO_BACK, MONEY_SCREENS,
  SCREEN_SIZE, TRADE_HERO, TRADE_SCREENS,
} from "@/components/apps/appMedia";
import { appById } from "@/lib/trading-apps";
import { revealItem, revealItemX, revealSection } from "@/lib/motion";

const money = appById("money");
const trade = appById("trade");

const MONEY_CAPABILITIES = [
  { icon: Bot, text: "No-code algo trading with Tradetron" },
  { icon: Zap, text: "Instant margin pledge from holdings" },
  { icon: Layers, text: "Option chain with OI and IV" },
  { icon: LineChart, text: "Technicals, pivots and OHLC" },
  { icon: Rocket, text: "IPO and back office inside the app" },
  { icon: Moon, text: "Dark mode for late sessions" },
];

const DESKTOP_POINTS = [
  "Colour-coded price views for cash, F&O and your holdings",
  "Best-5 market depth window with OI, lot size and price range",
  "Live alerts for new highs, lows and big-ticket trades",
  "Gainers, most-active and index panels side by side",
  "Keyboard-first order entry for fast F&O trading",
];

const TRADE_POINTS = [
  "Market watch lists for NSE, BSE and F&O",
  "One-tap price ladder for quick orders",
  "Market depth, option chain and charts per scrip",
  "Sector heat map on the market screen",
];

const FAQS = [
  {
    question: "Which Parasram app should I download?",
    answer: "Parasram Money is our newer app with more features, including Tradetron no-code algo trading and instant margin pledge. Parasram Trade (Symphony XTS) remains available for clients who already use it. The same trading account works on both.",
  },
  {
    question: "Is Parasram Money available on iPhone?",
    answer: "Yes. Parasram Money is on Google Play for Android and on the App Store for iPhone and iPad.",
  },
  {
    question: "How do I pledge shares for margin on Parasram Money?",
    answer: "Open the Portfolio tab, go to Holdings and tap Pledge. The pledge is done inside the app, without logging in to the back office.",
  },
  {
    question: "Can I use Parasram Money on a computer?",
    answer: "Yes. Parasram Money runs in the browser at money.parasramindia.com, and MoneyMaker, the Windows desktop terminal, works with the same account.",
  },
];

const PhoneShot = ({ src, alt, className = "", eager = false }: { src: string; alt: string; className?: string; eager?: boolean }) => (
  <img
    src={src}
    alt={alt}
    width={SCREEN_SIZE.width}
    height={SCREEN_SIZE.height}
    loading={eager ? "eager" : "lazy"}
    decoding="async"
    className={`h-auto rounded-[2rem] border-[6px] border-foreground/90 bg-foreground shadow-2xl ${className}`}
  />
);

const AppsPage = () => (
  <PageTransition>
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Parasram Money & Parasram Trade Apps | Parasram India"
        description="Get Parasram Money, our new app with Tradetron algo trading and instant margin pledge, on Android and iPhone. Plus Parasram Trade and MoneyMaker desktop."
        breadcrumbs={[{ name: "Home", url: "/" }, { name: "Apps" }]}
        faqItems={FAQS}
      />
      <Header />
      <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Apps" }]} />

      <main>
        {/* ── Parasram Money: the lead ─────────────────────────────── */}
        <section id="money" aria-labelledby="money-heading" className="relative overflow-hidden bg-hero text-primary-foreground scroll-mt-24">
          <div className="pointer-events-none absolute -right-40 top-10 h-[28rem] w-[28rem] rounded-full bg-secondary/25 blur-3xl" />
          <div className="pointer-events-none absolute -left-32 bottom-0 h-80 w-80 rounded-full bg-brand-gold/10 blur-3xl" />

          <div className="container relative mx-auto grid items-center gap-12 px-4 py-14 md:py-20 lg:grid-cols-[1.1fr_0.9fr]">
            <motion.div {...revealItemX("left")}>
              <span className="inline-flex items-center gap-2 rounded-full border border-secondary/40 bg-secondary/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5 text-secondary" aria-hidden /> New app
              </span>
              <h1 id="money-heading" className="mt-5 font-heading text-4xl font-bold leading-[1.05] md:text-6xl">
                Parasram Money
                <span className="mt-3 block text-2xl font-semibold text-primary-foreground/85 md:text-3xl">
                  Trade, pledge and run algos from one app.
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-primary-foreground/80">
                Our newest app puts more of your account on your phone: automate strategies with Tradetron, pledge
                holdings for margin in a tap, and read option chains and technicals without switching apps.
              </p>

              <ul className="mt-8 grid max-w-xl gap-x-6 gap-y-3 sm:grid-cols-2">
                {MONEY_CAPABILITIES.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3 text-sm font-medium">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/20">
                      <Icon className="h-4 w-4 text-secondary" aria-hidden />
                    </span>
                    {text}
                  </li>
                ))}
              </ul>

              <div className="mt-10 flex flex-wrap items-end gap-8">
                <div>
                  <StoreButtons app={money} />
                  <a
                    href={money.webHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary-foreground/80 underline-offset-4 hover:text-secondary hover:underline"
                  >
                    <Globe className="h-4 w-4" aria-hidden /> Or open it in your browser
                  </a>
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

        {/* ── What's new ──────────────────────────────────────────── */}
        <section aria-labelledby="new-heading" className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <motion.div {...revealSection} className="mb-10 max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-wider text-secondary">New in Parasram Money</p>
              <h2 id="new-heading" className="mt-2 font-heading text-3xl font-bold text-foreground md:text-4xl">
                Two things you can now do from your phone
              </h2>
            </motion.div>
            <div className="grid gap-8 lg:grid-cols-2">
              {MONEY_FEATURES.map((f, i) => (
                <motion.article
                  key={f.id}
                  id={f.id}
                  {...revealItem(i)}
                  className="group overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-shadow duration-base hover:shadow-xl scroll-mt-24"
                >
                  <div className="overflow-hidden">
                    <img
                      src={f.image.src}
                      alt={f.image.alt}
                      width={1280}
                      height={960}
                      loading="lazy"
                      decoding="async"
                      className="h-auto w-full transition-transform duration-slow ease-out group-hover:scale-[1.02]"
                    />
                  </div>
                  <div className="p-6 md:p-8">
                    <h3 className="font-heading text-2xl font-bold text-foreground">{f.title}</h3>
                    <p className="mt-2 text-muted-foreground">{f.body}</p>
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
                <h2 id="screens-heading" className="font-heading text-3xl font-bold text-foreground">Inside Parasram Money</h2>
                <p className="mt-2 text-muted-foreground">Watchlists, stock details, option chain, technicals and the Discover tab, in light or dark.</p>
              </div>
              <StoreButtons app={money} tone="onLight" size="sm" />
            </motion.div>
            <ScreenshotStrip screens={MONEY_SCREENS} label="Parasram Money app screenshots" />
          </div>
        </section>

        {/* ── MoneyMaker desktop ─────────────────────────────────── */}
        <section id="desktop" aria-labelledby="desktop-heading" className="relative overflow-hidden bg-hero py-16 text-primary-foreground md:py-24 scroll-mt-24">
          <div className="container relative mx-auto px-4">
            <motion.div {...revealSection} className="mx-auto mb-10 max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                <Monitor className="h-3.5 w-3.5 text-secondary" aria-hidden /> Windows desktop
              </span>
              <h2 id="desktop-heading" className="mt-4 font-heading text-3xl font-bold md:text-5xl">MoneyMaker on your desktop</h2>
              <p className="mt-4 text-lg text-primary-foreground/80">
                The terminal behind Parasram Money, built for a big screen: every price view, depth window and alert
                on one desk, with the same account as the app.
              </p>
            </motion.div>

            <motion.div {...revealSection} className="mx-auto max-w-5xl">
              <VideoPlayer
                eyebrow="Product tour"
                title="MoneyMaker desktop in 40 seconds"
                hdSrc={DESKTOP_VIDEO.hd}
                sdSrc={DESKTOP_VIDEO.sd}
                poster={DESKTOP_VIDEO.poster}
                width={DESKTOP_VIDEO.width}
                height={DESKTOP_VIDEO.height}
              />
            </motion.div>

            <div className="mx-auto mt-14 grid max-w-6xl items-center gap-10 lg:grid-cols-[1.4fr_1fr]">
              <motion.img
                {...revealItemX("left")}
                src={DESKTOP_SHOT.src}
                alt="MoneyMaker desktop terminal with F&O price view, Best-5 market depth, gainers and live alerts"
                width={DESKTOP_SHOT.width}
                height={DESKTOP_SHOT.height}
                loading="lazy"
                decoding="async"
                className="h-auto w-full rounded-xl shadow-2xl ring-1 ring-white/10"
              />
              <motion.div {...revealItemX("right")}>
                <h3 className="font-heading text-2xl font-bold">Built for active traders</h3>
                <ul className="mt-5 space-y-3">
                  {DESKTOP_POINTS.map((p) => (
                    <li key={p} className="flex gap-3 text-primary-foreground/85">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-secondary" aria-hidden />
                      {p}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/contact#contact-form"
                  className="mt-8 inline-flex items-center gap-2 rounded-xl bg-secondary px-5 py-3 font-semibold text-secondary-foreground shadow-lg transition-[background-color,transform] duration-fast ease-out hover:-translate-y-0.5 hover:bg-secondary/90"
                >
                  Get MoneyMaker set up on your PC <ArrowRight className="h-4 w-4" aria-hidden />
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
              <h2 id="trade-heading" className="mt-2 font-heading text-3xl font-bold text-foreground md:text-4xl">Parasram Trade</h2>
              <p className="mt-4 max-w-xl text-muted-foreground">{trade.tagline}. Fast order entry, a price ladder and market depth, on the same account.</p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {TRADE_POINTS.map((p) => (
                  <li key={p} className="flex gap-2.5 text-sm text-foreground">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-secondary" aria-hidden />
                    {p}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap items-end gap-8">
                <div>
                  <StoreButtons app={trade} tone="onLight" />
                  <a
                    href={trade.webHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-secondary hover:underline"
                  >
                    <Globe className="h-4 w-4" aria-hidden /> Or open it in your browser
                  </a>
                </div>
                <AppQrCodes app={trade} className="text-foreground" />
              </div>
            </motion.div>
          </div>
          <div className="container mx-auto mt-12 px-4">
            <ScreenshotStrip screens={TRADE_SCREENS.slice(1)} label="Parasram Trade app screenshots" />
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────── */}
        <section aria-labelledby="apps-faq-heading" className="border-t border-border bg-muted/30 py-16">
          <div className="container mx-auto max-w-3xl px-4">
            <h2 id="apps-faq-heading" className="font-heading text-2xl font-bold text-foreground">Questions about the apps</h2>
            <dl className="mt-6 divide-y divide-border">
              {FAQS.map((f) => (
                <div key={f.question} className="py-5">
                  <dt className="font-semibold text-foreground">{f.question}</dt>
                  <dd className="mt-1.5 text-muted-foreground">{f.answer}</dd>
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

export default AppsPage;
