import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Bot, Play, Zap } from "lucide-react";
import { EASE_OUT } from "@/lib/motion";
import { appById } from "@/lib/trading-apps";
import StoreButtons from "@/components/apps/StoreButtons";
import { DESKTOP_VIDEO, MONEY_HERO, SCREEN_SIZE, TRADE_HERO } from "@/components/apps/appMedia";
import { useT } from "@/i18n/LanguageContext";

type Props = { onClose: () => void };

const money = appById("money");
const trade = appById("trade");

const Thumb = ({ src, alt, className = "" }: { src: string; alt: string; className?: string }) => (
  <img
    src={src}
    alt={alt}
    width={SCREEN_SIZE.width}
    height={SCREEN_SIZE.height}
    decoding="async"
    className={`h-auto shrink-0 rounded-xl border-[3px] border-foreground/90 shadow-lg ${className}`}
  />
);

/**
 * The Apps dropdown. A picture of each app does more here than a list of
 * links: Parasram Money leads, as the new app, then the desktop tour and
 * Parasram Trade. Every store link is one click from any page.
 */
const AppsMenuPanel = ({ onClose }: Props) => {
  const { t } = useT();
  return (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 8 }}
    transition={{ duration: 0.2, ease: EASE_OUT }}
    className="absolute left-0 top-full z-50 w-full border-b border-border bg-card shadow-xl"
  >
    <div className="container mx-auto grid gap-4 px-4 py-6 lg:grid-cols-[1.5fr_1fr_1fr]">
      {/* Parasram Money - featured */}
      <div className="relative flex gap-5 overflow-hidden rounded-2xl bg-hero p-5 text-primary-foreground">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-secondary/30 blur-3xl" />
        <Thumb {...MONEY_HERO} className="relative w-24 -rotate-3" />
        <div className="relative min-w-0">
          <span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary-foreground">{t("apps.newApp")}</span>
          <Link to="/apps#money" onClick={onClose} className="mt-1.5 block font-heading text-xl font-bold hover:text-secondary">
            {t(money.nameKey)}
          </Link>
          <ul className="mt-2 space-y-1 text-xs text-primary-foreground/85">
            <li>
              <Link to="/apps#tradetron" onClick={onClose} className="inline-flex items-center gap-1.5 hover:text-secondary">
                <Bot className="h-3.5 w-3.5 text-secondary" aria-hidden /> {t("apps.cap.algo")}
              </Link>
            </li>
            <li>
              <Link to="/apps#margin-pledge" onClick={onClose} className="inline-flex items-center gap-1.5 hover:text-secondary">
                <Zap className="h-3.5 w-3.5 text-secondary" aria-hidden /> {t("apps.feature.pledge.title")}
              </Link>
            </li>
          </ul>
          <StoreButtons app={money} size="sm" className="mt-3" />
        </div>
      </div>

      {/* MoneyMaker desktop - the video tour */}
      <Link
        to="/apps#desktop"
        onClick={onClose}
        className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-background transition-shadow duration-base hover:shadow-lg"
      >
        <span className="relative block aspect-video overflow-hidden">
          <img
            src={DESKTOP_VIDEO.poster}
            alt="MoneyMaker desktop trading terminal, video tour thumbnail"
            width={DESKTOP_VIDEO.width}
            height={DESKTOP_VIDEO.height}
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-slow ease-out group-hover:scale-105"
          />
          <span className="absolute inset-0 bg-brand-navy/40" />
          <span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-lg ring-4 ring-white/30">
            <Play className="h-5 w-5 translate-x-px fill-current" aria-hidden />
          </span>
        </span>
        <span className="p-4">
          <span className="block font-semibold text-foreground group-hover:text-secondary">{t("apps.menu.desktopTitle")}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{t("apps.menu.desktopBody")}</span>
        </span>
      </Link>

      {/* Parasram Trade */}
      <div className="flex gap-4 rounded-2xl border border-border bg-background p-4">
        <Thumb {...TRADE_HERO} className="w-16" />
        <div className="min-w-0">
          <Link to="/apps#trade" onClick={onClose} className="font-semibold text-foreground hover:text-secondary">
            {t(trade.nameKey)}
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("apps.menu.tradeBody")}</p>
          <StoreButtons app={trade} tone="onLight" size="sm" className="mt-3" />
        </div>
      </div>

      <div className="lg:col-span-3">
        <Link
          to="/apps"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-secondary"
        >
          {t("apps.menu.all")} <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  </motion.div>
  );
};

export default AppsMenuPanel;
