import { useEffect, useRef } from "react";
import { useAnimate, useReducedMotion } from "motion/react";

/**
 * Shared plumbing for every animated icon.
 *
 * Three things the upstream itshover components do not do, all of which we need:
 *
 * 1. Reduced motion. `MotionConfig reducedMotion="user"` in App.tsx covers the
 *    declarative `motion` props used everywhere else on the site, but these
 *    icons animate imperatively through `useAnimate`. Rather than depend on
 *    whether that path reads the same context, `enabled` gates it explicitly.
 *
 * 2. Unmount safety. The icons live inside `AnimatePresence` in
 *    FloatingActions, so a hovered icon can unmount mid-animation when the menu
 *    collapses. `isMounted` lets an in-flight sequence bail instead of
 *    animating against a detached scope.
 *
 * 3. A single place to point the whole set at `@/lib/motion`.
 */
export function useAnimatedIcon() {
  const [scope, animate] = useAnimate();
  const prefersReducedMotion = useReducedMotion();
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return { scope, animate, enabled: !prefersReducedMotion, isMounted };
}

/**
 * Whether the device can actually hover.
 *
 * Mirrors the `hoverOnlyWhenSupported` flag already set in tailwind.config.ts:
 * a phone reports no hover, so hover-triggered icon motion would simply never
 * play. Callers use this to decide whether to drive the icon imperatively.
 */
export function canHover(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(hover: hover)").matches;
}
