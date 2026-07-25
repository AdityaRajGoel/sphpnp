import { Flame, TrendingUp, TrendingDown, Shield, Zap, ArrowRight, X, IndianRupee, PhoneCall } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useLiveMarket } from "@/hooks/useLiveMarket";

type Announcement = {
  icon: typeof Flame;
  text: string;
  cta: string | null;
  href: string | null;
  color: string;
  /** Rendered as the live NIFTY/SENSEX line instead of plain text. */
  live?: boolean;
};

const announcements: Announcement[] = [
  { icon: Flame, text: "Open a FREE Demat Account", cta: "Start", href: "/open-account", color: "text-brand-gold" },
  { icon: IndianRupee, text: "Transparent Pricing - every charge published", cta: "See Charges", href: "/pricing", color: "text-secondary" },
  { icon: TrendingUp, text: "IPOs Open - Apply Online", cta: "Apply", href: "/services", color: "text-secondary" },
  { icon: PhoneCall, text: "Free ₹0 Call-to-Trade Desk", cta: "Know More", href: "/pricing", color: "text-amber-400" },
  { icon: Shield, text: "SEBI Registered · NSE · BSE · MCX", cta: null, href: null, color: "text-sky-400" },
  { icon: Zap, text: "Pre-IPO & Unlisted Shares", cta: "Explore", href: "/unlisted-space", color: "text-purple-400" },
];

const DISMISS_KEY = "pnp_announcement_dismissed";

const AnnouncementBar = () => {
  const [hidden, setHidden] = useState(false);      // mobile scroll-hide
  const [dismissed, setDismissed] = useState(false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const { indices } = useLiveMarket();

  // Lead slide: live NIFTY/SENSEX from the same feed as the rest of the site,
  // so the "Live Updates" badge is literally true.
  const nifty = indices.find((i) => i.key === "NIFTY");
  const sensex = indices.find((i) => i.key === "SENSEX");
  const items = useMemo<Announcement[]>(() => {
    if (!nifty) return announcements;
    return [
      { icon: nifty.up ? TrendingUp : TrendingDown, text: "Live market snapshot", cta: "Markets", href: "/screener", color: nifty.up ? "text-emerald-400" : "text-red-400", live: true },
      ...announcements,
    ];
  }, [nifty]);

  // Restore dismissal for this browsing session
  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
    } catch { /* ignore */ }
  }, []);

  // Auto-rotate announcements (pauses on hover); static links, not a moving target
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), 5000);
    return () => clearInterval(t);
  }, [paused, items.length]);

  // Auto-hide on mobile when scrolling down past 50px
  useEffect(() => {
    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      if (window.innerWidth < 768) {
        if (window.scrollY > 50 && window.scrollY > lastScrollY) setHidden(true);
        else if (window.scrollY < 50) setHidden(false);
      }
      lastScrollY = window.scrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  };

  if (dismissed) return null;

  const item = items[index % items.length];
  const Icon = item.icon;

  // Live NIFTY/SENSEX line for the lead slide.
  const liveLine = item.live && nifty && (
    <>
      <span className="text-white/90 text-[11px] md:text-xs font-semibold whitespace-nowrap">NIFTY {nifty.price}</span>
      <span className={`text-[10px] md:text-[11px] font-bold whitespace-nowrap ${nifty.up ? "text-emerald-400" : "text-red-400"}`}>{nifty.change}</span>
      {sensex && (
        <span className="hidden sm:inline-flex items-center gap-1.5">
          <span className="text-white/30">·</span>
          <span className="text-white/90 text-[11px] md:text-xs font-semibold whitespace-nowrap">SENSEX {sensex.price}</span>
          <span className={`text-[10px] md:text-[11px] font-bold whitespace-nowrap ${sensex.up ? "text-emerald-400" : "text-red-400"}`}>{sensex.change}</span>
        </span>
      )}
    </>
  );

  return (
    <div
      role="region"
      aria-label="Site announcements"
      className={`relative overflow-hidden border-b border-white/5 transition-[height,opacity] duration-base ${
        hidden ? "h-0 border-transparent opacity-0" : "h-8 md:h-10 opacity-100"
      }`}
      style={{ background: "linear-gradient(90deg, hsl(213 80% 10%) 0%, hsl(213 80% 15%) 50%, hsl(145 70% 12%) 100%)" }}
    >
      {/* Shimmer line (top) */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-gold/60 to-transparent animate-[ticker-right_4s_linear_infinite]" />

      <div className="flex items-center h-8 md:h-10">
        {/* Left badge */}
        <div className="hidden md:flex items-center gap-2 px-4 h-full shrink-0 bg-brand-gold/15 border-r border-brand-gold/20">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse" />
          <span className="text-brand-gold text-[11px] font-bold uppercase tracking-widest whitespace-nowrap">Live Updates</span>
        </div>

        {/* Rotating announcement (static, clickable CTA) */}
        <div
          className="flex-1 relative h-full flex items-center justify-center overflow-hidden px-2"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="absolute"
            >
              {item.href ? (
                <Link to={item.href} className="group inline-flex items-center gap-2 md:gap-3">
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${item.color}`} />
                  {liveLine || (
                    <span className="text-white/80 group-hover:text-white text-[11px] md:text-xs font-medium whitespace-nowrap transition-colors">{item.text}</span>
                  )}
                  {item.cta && (
                    <span className={`inline-flex items-center gap-1 text-[10px] md:text-[11px] font-bold ${item.color} bg-white/10 group-hover:bg-white/15 rounded-full px-2 py-0.5 transition-colors`}>
                      {item.cta} <ArrowRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  )}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-2 md:gap-3">
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${item.color}`} />
                  <span className="text-white/80 text-[11px] md:text-xs font-medium whitespace-nowrap">{item.text}</span>
                </span>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress dots + dismiss */}
        <div className="flex items-center gap-2 shrink-0 pr-2 md:pr-3">
          <div className="hidden sm:flex items-center gap-1">
            {items.map((a, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Show announcement: ${a.text}`}
                className={`relative h-1.5 rounded-full overflow-hidden transition-colors duration-base ${i === index ? "w-5 bg-white/20" : "w-1.5 bg-white/25 hover:bg-white/40"}`}
              >
                {i === index && !paused && (
                  <motion.span
                    key={`fill-${index}`}
                    className="absolute inset-y-0 left-0 bg-brand-gold/90 rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 5, ease: "linear" }}
                  />
                )}
                {i === index && paused && <span className="absolute inset-0 bg-brand-gold/70 rounded-full" />}
              </button>
            ))}
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss announcements"
            className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-full text-white/50 hover:text-white/90 hover:bg-white/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Shimmer line (bottom) */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent animate-[ticker-left_5s_linear_infinite]" />
    </div>
  );
};

export default AnnouncementBar;
