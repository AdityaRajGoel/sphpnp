import { ArrowUpRight, Pause, Play, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/contexts/MotionPreferenceContext";
import { loadTicker, tickerHref, withPromos, TICKER_FRESH_MS, type TickerItem } from "@/lib/ticker-feed";

const DISMISS_KEY = "pnp_announcement_dismissed";
/** Scroll speed in px per second - slow enough to read a headline in one pass. */
const SPEED = 55;

/** Chip colour per kind of line: the ticker reads at a glance before a word of it does. */
const CHIP: Record<TickerItem["kind"], string> = {
  ipo: "bg-brand-gold/20 text-brand-gold",
  gainer: "bg-emerald-400/15 text-emerald-300",
  loser: "bg-red-400/15 text-red-300",
  news: "bg-sky-400/15 text-sky-300",
  ex_date: "bg-violet-400/15 text-violet-300",
  announcement: "bg-white/10 text-white/70",
  global: "bg-indigo-400/15 text-indigo-300",
  promo: "bg-brand-orange/20 text-orange-300",
};
const TONE: Record<TickerItem["tone"], string> = {
  up: "text-emerald-300",
  down: "text-red-300",
  neutral: "text-white/85",
};

function useTickerItems() {
  const [items, setItems] = useState<TickerItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    const headless = typeof navigator !== "undefined" && navigator.webdriver === true;
    const load = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadTicker(!headless)
        .then((next) => { if (!cancelled && next.length > 0) setItems(next); })
        .catch(() => { /* the promos keep the bar useful; the next poll retries */ });
    };
    load();
    const timer = setInterval(load, TICKER_FRESH_MS);
    document.addEventListener("visibilitychange", load);
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener("visibilitychange", load); };
  }, []);
  return items;
}

function TickerLine({ item, hidden }: { item: TickerItem; hidden: boolean }) {
  const href = tickerHref(item.href);
  const body = (
    <>
      <span className={`shrink-0 rounded-full px-1.5 py-px text-[9px] md:text-[10px] font-bold uppercase tracking-wider ${CHIP[item.kind]}`}>
        {item.tag}
      </span>
      <span className={`text-[11px] md:text-xs font-medium whitespace-nowrap ${TONE[item.tone]} group-hover:text-white transition-colors`}>
        {item.text}
      </span>
      {item.external && href && <ArrowUpRight className="w-3 h-3 shrink-0 text-white/40 group-hover:text-white/80" aria-hidden="true" />}
    </>
  );
  const cls = "group inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-4 h-full rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70";
  // The duplicate copy that makes the loop seamless is invisible to assistive
  // tech and out of the tab order, so each line is announced and reached once.
  const a11y = hidden ? { tabIndex: -1, "aria-hidden": true as const } : {};
  const content = !href ? (
    <span className={cls} {...(hidden ? { "aria-hidden": true as const } : {})}>{body}</span>
  ) : item.external ? (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={cls} {...a11y}>{body}</a>
  ) : (
    <Link to={href} className={cls} {...a11y}>{body}</Link>
  );
  return (
    <li className="flex items-center h-full shrink-0">
      {content}
      <span className="text-white/15 select-none" aria-hidden="true">|</span>
    </li>
  );
}

/**
 * The site-wide live-updates bar: IPOs in play, the day's movers, market
 * headlines, ex-dates and NSE filings scrolling past like an exchange ticker,
 * with the house announcements woven between them.
 *
 * Moving content needs a way to stop it (WCAG 2.2.2): hover or focus pauses the
 * scroll, the button stops it outright, and with reduced motion it never moves
 * - the lines sit in a row the reader can scroll sideways.
 */
const AnnouncementBar = () => {
  const [hidden, setHidden] = useState(false); // mobile scroll-hide
  const [dismissed, setDismissed] = useState(false);
  const [stopped, setStopped] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const live = useTickerItems();
  const items = withPromos(live);

  const trackRef = useRef<HTMLUListElement>(null);
  const [duration, setDuration] = useState(60);

  // Duration from the measured width, so every line moves at the same speed
  // however many there are.
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setDuration(Math.max(20, el.scrollWidth / 2 / SPEED));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [items.length]);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
    } catch { /* storage blocked: the bar simply shows */ }
  }, []);

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

  const moving = !prefersReducedMotion;
  const copies = moving ? [false, true] : [false];

  return (
    <div
      role="region"
      aria-label="Live market updates"
      className={`relative overflow-hidden border-b border-white/5 transition-[height,opacity] duration-base ${
        hidden ? "h-0 border-transparent opacity-0" : "h-8 md:h-10 opacity-100"
      }`}
      style={{ background: "linear-gradient(90deg, hsl(213 80% 10%) 0%, hsl(213 80% 15%) 50%, hsl(145 70% 12%) 100%)" }}
    >
      <div className="flex items-center h-8 md:h-10">
        <div className="flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 h-full shrink-0 bg-brand-gold/15 border-r border-brand-gold/20">
          <span className="relative flex w-1.5 h-1.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full bg-brand-gold opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-brand-gold" />
          </span>
          <span className="text-brand-gold text-[10px] md:text-[11px] font-bold uppercase tracking-widest whitespace-nowrap">
            <span className="md:hidden">Live</span>
            <span className="hidden md:inline">Live Updates</span>
          </span>
        </div>

        <div
          className={`ticker-viewport relative flex-1 h-full ${moving ? "overflow-hidden" : "overflow-x-auto scrollbar-hide"}`}
          style={{
            maskImage: "linear-gradient(90deg, transparent, #000 24px, #000 calc(100% - 24px), transparent)",
            WebkitMaskImage: "linear-gradient(90deg, transparent, #000 24px, #000 calc(100% - 24px), transparent)",
          }}
        >
          <ul
            ref={trackRef}
            className={`ticker-track flex items-center h-full w-max ${stopped ? "is-stopped" : ""}`}
            style={moving ? { animationName: "ticker-left", animationDuration: `${duration}s`, animationTimingFunction: "linear", animationIterationCount: "infinite" } : undefined}
            aria-live="off"
          >
            {copies.map((isCopy) =>
              items.map((item, i) => <TickerLine key={`${isCopy ? "b" : "a"}-${i}-${item.text}`} item={item} hidden={isCopy} />),
            )}
          </ul>
        </div>

        <div className="flex items-center gap-0.5 shrink-0 pr-1 md:pr-2 pl-1">
          {moving && (
            <button
              type="button"
              onClick={() => setStopped((s) => !s)}
              aria-label={stopped ? "Resume live updates" : "Pause live updates"}
              aria-pressed={stopped}
              className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-full text-white/50 hover:text-white/90 hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70"
            >
              {stopped ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss live updates"
            className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-full text-white/50 hover:text-white/90 hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-gold/40 to-transparent" aria-hidden="true" />
    </div>
  );
};

export default AnnouncementBar;
