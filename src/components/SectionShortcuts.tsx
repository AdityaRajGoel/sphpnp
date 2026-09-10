import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Compass,
  X,
  Gauge,
  LineChart,
  Landmark,
  FlaskConical,
  ShieldCheck,
  Building2,
  History,
  Phone,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePrefersReducedMotion } from "@/contexts/MotionPreferenceContext";
import { DURATION, EASE_OUT, STAGGER } from "@/lib/motion";

/**
 * Quick jump-to-section control for the home page.
 *
 * Deliberately NOT a dialog. An open Radix dialog marks the rest of the page
 * `aria-hidden`, which is what took the whole home page out of the
 * accessibility tree when the promo banner and the cookie prompt stacked. A
 * navigation aid must never do that to the page it is helping you navigate, so
 * this is a plain expandable <nav>: no portal, no focus trap, no scroll lock.
 *
 * It sits bottom-left because FloatingActions already owns bottom-right, and a
 * rung lower in the stacking order (z-40 against its z-50) so the call and
 * WhatsApp actions stay on top if they ever overlap on a small screen.
 */

/**
 * A shortcut either scrolls to a section on this page (`id`) or navigates to
 * the page that owns it (`href`).
 *
 * About, Our Legacy and Contact are routes rather than anchors: they live on
 * /about and /contact, and duplicating them on the home page competed with
 * those pages for the same search intent on a site already struggling to get
 * its pages indexed. Keeping them in this list means the control still answers
 * "where do I find X", which is the job; it just sends you to the right page
 * instead of scrolling to a section that is not there.
 */
type Shortcut =
  | { id: string; label: string; icon: LucideIcon; href?: never }
  | { href: string; label: string; icon: LucideIcon; id?: never };

/** On-page entries are ordered to mirror the page, so the list reads as a map. */
const SHORTCUTS: Shortcut[] = [
  { id: "market-watch", label: "Market Watch", icon: Gauge },
  { id: "market-overview", label: "Market Overview", icon: LineChart },
  { id: "ipo-corner", label: "IPO Corner", icon: Landmark },
  { id: "research", label: "Research", icon: FlaskConical },
  { id: "why-us", label: "Why Choose Us", icon: ShieldCheck },
  { href: "/about", label: "About Us", icon: Building2 },
  { href: "/about#timeline", label: "Our Legacy", icon: History },
  { href: "/contact", label: "Contact Us", icon: Phone },
];

const SectionShortcuts = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const navigate = useNavigate();

  const close = useCallback(() => setIsOpen(false), []);

  // Escape closes and returns focus to the toggle, so keyboard users are not
  // dropped at the top of the document.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
      toggleRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [isOpen, close]);

  /*
   * Scroll spy. IntersectionObserver rather than a scroll handler: the home
   * page already runs a scroll listener for the announcement bar, and adding
   * another that reads layout on every frame is how a page starts dropping
   * them. `-45% 0px` biases the active band toward the middle of the viewport,
   * so the highlight changes when a section is genuinely being read rather than
   * the instant its top edge appears.
   */
  useEffect(() => {
    const sections = SHORTCUTS.flatMap((s) => (s.id ? [document.getElementById(s.id)] : [])).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const goTo = (href: string) => {
    close();
    navigate(href);
  };

  const jumpTo = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    // `smooth` is the browser's own easing, which already respects the OS
    // reduced-motion setting; the explicit check covers the in-app override.
    target.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
    setActiveId(id);
    close();
  };

  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: DURATION.fast, ease: EASE_OUT };

  return (
    <div
      ref={containerRef}
      className="fixed bottom-24 left-4 z-40 flex flex-col items-start gap-2 md:bottom-6 md:left-6 pb-[env(safe-area-inset-bottom)] print:hidden"
    >
      <AnimatePresence>
        {isOpen && (
          <motion.nav
            key="shortcuts"
            aria-label="Jump to section"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
            transition={transition}
            className="origin-bottom-left overflow-hidden rounded-2xl border border-border/60 bg-card/95 p-1.5 shadow-2xl backdrop-blur-md"
          >
            <ul className="flex flex-col gap-0.5">
              {SHORTCUTS.map((shortcut, index) => {
                const { label, icon: Icon } = shortcut;
                const isActive = shortcut.id !== undefined && activeId === shortcut.id;
                return (
                  <motion.li
                    key={shortcut.id ?? shortcut.href}
                    initial={prefersReducedMotion ? false : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0 }
                        : { ...transition, delay: index * STAGGER * 0.5 }
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        shortcut.id ? jumpTo(shortcut.id) : goTo(shortcut.href)
                      }
                      aria-current={isActive ? "true" : undefined}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition-[background-color,color] duration-fast ${
                        isActive
                          ? "bg-secondary/15 text-secondary"
                          : "text-foreground/80 hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="whitespace-nowrap">{label}</span>
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>

      <button
        ref={toggleRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close section shortcuts" : "Jump to a section"}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-offset-background transition-[transform,background-color,box-shadow] duration-press ease-out hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.94]"
      >
        {isOpen ? (
          <X className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Compass className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
};

export default SectionShortcuts;
