import { ReactLenis } from "lenis/react";
import { useLocation } from "react-router-dom";
import { useReducedMotion } from "motion/react";
import { useEffect } from "react";
import type { ReactNode } from "react";

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
  "/reports",
  "/admin",
  "/banner-manager",
];

export const isDataRoute = (pathname: string) =>
  DATA_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));

const SmoothScroll = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const prefersReducedMotion = useReducedMotion();
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

  if (!enabled) return <>{children}</>;

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
        smoothWheel: true,
        // Lenis handles in-page anchors so they ease like everything else.
        anchors: true,
      }}
    >
      {children}
    </ReactLenis>
  );
};

export default SmoothScroll;
