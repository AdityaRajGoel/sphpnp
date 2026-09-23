import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Bot, Layers, Play, Sparkles, Zap } from "lucide-react";
import StoreButtons from "@/components/apps/StoreButtons";
import AppQrCodes from "@/components/apps/AppQrCodes";
import { DESKTOP_VIDEO, MONEY_HERO, MONEY_HERO_BACK, SCREEN_SIZE, TRADE_HERO } from "@/components/apps/appMedia";
import { appById } from "@/lib/trading-apps";
import { revealItem, revealSection } from "@/lib/motion";

const money = appById("money");
const trade = appById("trade");

const MONEY_HIGHLIGHTS = [
  { icon: Bot, text: "Tradetron no-code algo trading" },
  { icon: Zap, text: "Instant margin pledge" },
  { icon: Layers, text: "Option chain, technicals and IPOs" },
];

const Phone = ({ src, alt, className = "" }: { src: string; alt: string; className?: string }) => (
  <img
    src={src}
    alt={alt}
    width={SCREEN_SIZE.width}
    height={SCREEN_SIZE.height}
    loading="lazy"
    decoding="async"
    className={`h-auto rounded-[1.4rem] border-4 border-foreground/90 shadow-2xl ${className}`}
  />
);

/** The Services page's apps section: a short tour that hands off to /apps. */
const MobileApp = () => (
  <section id="app" aria-labelledby="apps-teaser-heading" className="relative overflow-hidden bg-hero py-14 text-primary-foreground md:py-20">
    <div className="pointer-events-none absolute -right-32 top-0 h-96 w-96 rounded-full bg-secondary/20 blur-3xl" />

    <div className="container relative mx-auto px-4">
      <motion.div {...revealSection} className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-secondary">Our apps</p>
          <h2 id="apps-teaser-heading" className="mt-2 font-heading text-3xl font-bold md:text-4xl">
            Trade from your phone or your desktop
          </h2>
        </div>
        <Link to="/apps" className="inline-flex items-center gap-1.5 font-semibold hover:text-secondary">
          Explore all apps <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </motion.div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        {/* Parasram Money, featured */}
        <motion.article
          {...revealItem(0)}
          className="relative grid items-center gap-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-sm sm:grid-cols-[auto_1fr] md:p-8"
        >
          <div className="relative mx-auto h-72 w-52 sm:h-80">
            <Phone {...MONEY_HERO_BACK} className="absolute right-0 top-0 w-36 rotate-6 opacity-80" />
            <Phone {...MONEY_HERO} className="absolute bottom-0 left-0 w-40 -rotate-3" />
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-secondary-foreground">
              <Sparkles className="h-3 w-3" aria-hidden /> New app
            </span>
            <h3 className="mt-3 font-heading text-3xl font-bold">{money.name}</h3>
            <p className="mt-2 text-primary-foreground/80">More of your account in one app, on Android, iPhone and the web.</p>
            <ul className="mt-4 space-y-2">
              {MONEY_HIGHLIGHTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2.5 text-sm font-medium">
                  <Icon className="h-4 w-4 text-secondary" aria-hidden /> {text}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap items-end gap-6">
              <StoreButtons app={money} size="sm" />
              <AppQrCodes app={money} />
            </div>
          </div>
        </motion.article>

        <div className="grid gap-5">
          {/* MoneyMaker desktop */}
          <motion.div {...revealItem(1)}>
            <Link
              to="/apps#desktop"
              className="group flex items-center gap-4 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              <span className="relative block aspect-video w-40 shrink-0 overflow-hidden rounded-xl sm:w-48">
                <img
                  src={DESKTOP_VIDEO.poster}
                  alt=""
                  width={DESKTOP_VIDEO.width}
                  height={DESKTOP_VIDEO.height}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-slow ease-out group-hover:scale-105"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-brand-navy/40">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground ring-4 ring-white/25">
                    <Play className="h-4 w-4 translate-x-px fill-current" aria-hidden />
                  </span>
                </span>
              </span>
              <span>
                <span className="block font-heading text-lg font-bold group-hover:text-secondary">MoneyMaker Desktop</span>
                <span className="mt-1 block text-sm text-primary-foreground/75">The Windows terminal. Watch the 40-second tour.</span>
              </span>
            </Link>
          </motion.div>

          {/* Parasram Trade */}
          <motion.article {...revealItem(2)} className="flex gap-5 rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm">
            <Phone {...TRADE_HERO} className="w-24 shrink-0 self-start" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/60">Symphony XTS</p>
              <h3 className="font-heading text-xl font-bold">{trade.name}</h3>
              <p className="mt-1 text-sm text-primary-foreground/75">The app many of our clients already trade on.</p>
              <StoreButtons app={trade} size="sm" className="mt-4" />
            </div>
          </motion.article>
        </div>
      </div>
    </div>
  </section>
);

export default MobileApp;
