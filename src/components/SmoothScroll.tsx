import { ReactLenis } from "lenis/react";
import { useLocation } from "react-router-dom";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { usePrefersReducedMotion } from "@/contexts/MotionPreferenceContext";

/**
 * Lenis smooth scroll, applied only where it helps.
 *
 * Lenis wraps the browser's own scroll rather than replacing it, so the sticky
 * header, anchor links and `window.scrollY` listeners elsewhere in the app keep
 * working unchanged.
 *
 * It is deliberately NOT applied everywhere:
 *
 * - **Data routes are excluded.** On the screener, F&O board, comparison and
 *   52-week tracker people are scanning live tables for a number. Easing the
 *   scroll puts a lag between the wheel and the row they are hunting for, which
 *   fights the task instead of serving it.
 * - **Reduced motion disables it entirely.** Lenis does not read
 *   `prefers-reduced-motion` itself, and momentum scrolling is exactly the kind
 *   of vestibular trigger that setting exists for.
 */

/** Routes where scanning beats gliding. Prefix match, so children are covered. */
const DATA_ROUTES = [
  "/screener",
  "/fno",
  "/compare",
  "/52-week-tracker",
  "/market-pulse",
  "/reports",
  "/admin",
  "/banner-manager",
];

export const isDataRoute = (pathname: string) =>
  DATA_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));

const SmoothScroll = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const prefersReducedMotion = usePrefersReducedMotion();
  const enabled = !prefersReducedMotion && !isDataRoute(pathname);

  // `html { scroll-behavior: smooth }` and Lenis both want to own easing; run
  // together they cause a visible double-animation on anchor jumps. Hand the
  // CSS property back whenever Lenis is not driving.
  //
  // The class sweep matters more than it looks: Lenis marks <html> with its own
  // classes, and the prerender step serialises whatever the home page left
  // behind into the static HTML of every route. Without this, a data route
  // ships with `class="lenis"` already on it and would pick up Lenis's scroll
  // container styles the moment its stylesheet is ever imported.
  useEffect(() => {
    const root = document.documentElement;
    root.style.scrollBehavior = enabled ? "auto" : "";
    if (!enabled) {
      root.classList.forEach((c) => {
        if (c.startsWith("lenis")) root.classList.remove(c);
      });
    }
    return () => {
      root.style.scrollBehavior = "";
    };
  }, [enabled]);

  /*
   * Lenis stays mounted and is disarmed through its OPTIONS, never through
   * lenis.stop().
   *
   * Returning a bare fragment when disabled and <ReactLenis> when enabled puts
   * two different component types at the same position, so React tears down and
   * rebuilds the entire app underneath on every flip: lazy sections re-suspend,
   * component state is lost, every reveal replays. That never showed while the
   * value came only from the OS and was fixed for the session - the in-app
   * motion toggle made it something a user does, and it read as the page
   * hanging for a second or two. Guarded by e2e/reduced-motion.spec.ts.
   *
   * stop() was the first attempt and is the wrong lever: it LOCKS scrolling
   * rather than disabling smoothing, which is what it exists for (holding the
   * page still behind a modal). Using it to express "reduced motion" would take
   * the page from eased-scroll to no-scroll.
   *
   * So the instance stays running and smoothWheel/syncTouch are turned off
   * instead. Lenis then passes wheel and touch straight through to the browser's
   * native scroll - no easing, no interception, and nothing for the user to
   * fight - while the component tree is untouched.
   */

  return (
    <ReactLenis
      root
      options={{
        // Roughly a half-second glide: enough to read as eased, short enough
        // that the page still stops where the user expects it to.
        duration: 0.9,
        // Keep native behaviour for the input methods where easing is wrong:
        // trackpads and touchscreens already have OS-level momentum.
        syncTouch: false,
        // The single switch that expresses "reduced motion" here. False makes
        // Lenis a pass-through: the browser scrolls natively, unmodified.
        smoothWheel: enabled,
        // Anchor easing is Lenis's too, so it follows the same switch.
        anchors: enabled,
      }}
    >
      {children}
    </ReactLenis>
  );
};

export default SmoothScroll;
