import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "react-router-dom";
import { BarChart3, ChevronDown, Cookie, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DURATION, EASE_DRAWER, EASE_OUT, REVEAL_Y } from "@/lib/motion";
import { OPEN_CONSENT_EVENT, readConsent, writeConsent, type ConsentChoice } from "@/lib/consent";

/** One-off wobble when the prompt arrives - draws the eye once, then stays still. */
const COOKIE_WOBBLE = {
  initial: { rotate: 0 },
  animate: { rotate: [0, -14, 10, -6, 0] },
  transition: { duration: DURATION.ambient, delay: DURATION.base, ease: EASE_OUT },
} as const;

const DETAILS = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto" },
  exit: { opacity: 0, height: 0 },
  transition: { duration: DURATION.base, ease: EASE_OUT },
} as const;

const CATEGORIES = [
  { icon: ShieldCheck, name: "Essential", state: "Always on", body: "Keep you signed in, remember this choice, your theme and your watchlist, and protect forms from abuse." },
  { icon: BarChart3, name: "Analytics & performance", state: "Only with Accept All", body: "Anonymous page-view and speed measurements that show us which tools are used and where pages are slow." },
];
import { usePrefersReducedMotion } from "@/contexts/MotionPreferenceContext";

/**
 * Cookie consent prompt.
 *
 * Two decisions here are not stylistic and should survive future tidying.
 *
 * The two choices carry equal visual weight. Making refusal harder than
 * acceptance - smaller, greyer, buried behind a link - is the consent dark
 * pattern regulators name explicitly, so "Essential Only" gets the same size,
 * the same row and the same prominence as "Accept All". Only the fill differs,
 * to mark which is the affirmative action rather than which is preferred.
 *
 * There is no separate close control. The previous version had one that mapped
 * to the refusal handler, which meant three affordances for two outcomes, and it
 * was positioned `absolute` with no positioned ancestor so it actually rendered
 * against the viewport strip and collided with the heading. Dismissal IS the
 * refusal, so it is spelled with the word rather than an ambiguous glyph -
 * and Escape does the same thing for the keyboard.
 */
/**
 * Published on <html> while the prompt is up, so the other bottom-docked UI can
 * sit above it instead of underneath.
 *
 * This banner is the topmost bottom-fixed element on the page (z-50) and it
 * spans the full width on a phone, so on a first visit it completely covered
 * the IPO compare bar and the mobile "Open Free Demat Account" CTA - both
 * z-40, both bottom-docked, both invisible and unclickable until the visitor
 * dealt with cookies. Measured rather than hardcoded: the card is three lines
 * on a phone and one row on a desktop, and a fixed guess would be wrong on one
 * of them.
 */
const DOCK_HEIGHT_VAR = "--consent-dock-height";

const CookieConsent = () => {
  const [isVisible, setIsVisible] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const titleId = useId();
  const descriptionId = useId();
  const detailsId = useId();
  const [showDetails, setShowDetails] = useState(false);

  const [current, setCurrent] = useState<ConsentChoice | null>(null);

  useEffect(() => {
    // readConsent swallows a throwing localStorage, so this cannot take the
    // banner - or anything mounted after it - down in Safari private mode.
    if (readConsent() === null) setIsVisible(true);
    // "Cookie settings" in the footer reopens the prompt: withdrawing consent
    // has to be as easy as giving it.
    const reopen = () => {
      setCurrent(readConsent());
      setIsVisible(true);
    };
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, []);

  const decide = useCallback((choice: ConsentChoice) => {
    writeConsent(choice);
    setIsVisible(false);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const clear = () => root.style.removeProperty(DOCK_HEIGHT_VAR);
    if (!isVisible || !card.current) {
      clear();
      return;
    }
    const element = card.current;
    const publish = () => root.style.setProperty(DOCK_HEIGHT_VAR, `${Math.ceil(element.getBoundingClientRect().height)}px`);
    publish();
    // The card reflows on rotation and on a font-size change, and the offset
    // it feeds has to follow it rather than be measured once at mount.
    // Guarded the same way readConsent guards localStorage: an environment
    // without ResizeObserver (jsdom, a very old browser) gets the one-time
    // measurement above and keeps its banner, rather than throwing inside an
    // effect and taking the whole consent prompt down.
    if (typeof ResizeObserver === "undefined") return clear;
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    return () => {
      observer.disconnect();
      clear();
    };
  }, [isVisible]);

  // Escape resolves to the refusal, never to acceptance: dismissing a consent
  // prompt is legally not agreement, so the quiet exit must be the safe one.
  useEffect(() => {
    if (!isVisible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") decide("essential");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isVisible, decide]);

  // Reduced motion still animates - it just stops travelling. An element that
  // appears with no transition at all is more jarring than a short fade, and the
  // guidance is reduced motion, not removed feedback.
  const transition = prefersReducedMotion
    ? { duration: DURATION.fast, ease: EASE_DRAWER }
    : { duration: DURATION.base, ease: EASE_DRAWER };
  const hidden = prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, y: REVEAL_Y.section };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          role="dialog"
          // Not aria-modal: focus is deliberately not trapped. The page behind
          // stays usable and a half-built trap that fails to restore focus is
          // worse for keyboard users than none.
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          initial={hidden}
          animate={{ opacity: 1, y: 0 }}
          exit={hidden}
          transition={transition}
          // Only transform and opacity animate, so this stays on the compositor.
          className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none"
        >
          <div
            ref={card}
            className="
              pointer-events-auto w-full max-w-3xl
              rounded-2xl border border-border/80 bg-card
              shadow-[0_8px_32px_-12px_hsl(var(--brand-navy)/0.28)]
              p-5 sm:p-6
              flex flex-col gap-5 md:flex-row md:items-center md:gap-8
            "
          >
            {/* Tight group: the icon belongs to the text, so it sits close. */}
            <div className="flex items-start gap-3.5 md:gap-4">
              <motion.span
                aria-hidden="true"
                {...(prefersReducedMotion ? {} : COOKIE_WOBBLE)}
                className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary/10 text-secondary"
              >
                <Cookie className="h-[18px] w-[18px]" />
              </motion.span>
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="text-[0.9375rem] font-semibold leading-snug tracking-[-0.01em] text-foreground"
                >
                  {current ? "Your cookie settings" : "We value your privacy"}
                </h2>
                <p
                  id={descriptionId}
                  className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground"
                >
                  {current && (
                    <span className="font-medium text-foreground">
                      Currently: {current === "all" ? "all cookies accepted" : "essential cookies only"}.{" "}
                    </span>
                  )}
                  Essential cookies keep the site working. With your consent we also use
                  non-essential cookies to understand how the site is used and improve it.
                  Read our{" "}
                  <Link
                    to="/cookie-policy"
                    className="font-medium text-secondary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    Cookie Policy
                  </Link>
                  .
                </p>
                <button
                  type="button"
                  onClick={() => setShowDetails((v) => !v)}
                  aria-expanded={showDetails}
                  aria-controls={detailsId}
                  className="mt-1.5 inline-flex items-center gap-1 rounded text-[0.8125rem] font-medium text-foreground/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {/* Deliberately avoids "accept", "allow" or "reject": this only
                      expands details and must never read as a consent control. */}
                  Details on each choice
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDetails ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                <AnimatePresence initial={false}>
                  {showDetails && (
                    <motion.ul key="details" id={detailsId} {...DETAILS} className="overflow-hidden">
                      {CATEGORIES.map(({ icon: Icon, name, state, body }) => (
                        <li key={name} className="mt-2 flex gap-2.5 rounded-lg border border-border/70 bg-muted/40 p-2.5">
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
                          <div className="min-w-0 text-[0.8125rem]">
                            <p className="flex flex-wrap items-baseline justify-between gap-x-2 font-medium text-foreground">
                              {name} <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{state}</span>
                            </p>
                            <p className="text-muted-foreground">{body}</p>
                          </div>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/*
              Generous separation from the text, and equal-width actions so
              neither choice is easier to reach than the other. On a 320px screen
              they stack full-width rather than shrinking their labels.
            */}
            <div className="flex flex-col gap-2.5 sm:flex-row md:ml-auto md:shrink-0">
              <Button
                variant="outline"
                onClick={() => decide("essential")}
                aria-pressed={current ? current === "essential" : undefined}
                className="w-full sm:w-auto sm:min-w-[8.5rem] font-medium transition-colors pressable"
              >
                Essential Only
              </Button>
              <Button
                onClick={() => decide("all")}
                aria-pressed={current ? current === "all" : undefined}
                className="w-full sm:w-auto sm:min-w-[8.5rem] bg-brand-navy font-medium text-white shadow-sm transition-colors hover:bg-brand-navy/90 pressable btn-shine"
              >
                Accept All
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CookieConsent;
