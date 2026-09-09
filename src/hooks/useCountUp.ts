import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/contexts/MotionPreferenceContext";

// Lightweight requestAnimationFrame count-up.
// `start` gates the animation so callers can trigger it on scroll-into-view.
// Respects prefers-reduced-motion by jumping straight to the target.
export function useCountUp(target: number, duration = 2, start = true): number {
  const [count, setCount] = useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  const hasRun = useRef(false);

  useEffect(() => {
    if (!start || hasRun.current) return;
    hasRun.current = true;

    if (prefersReducedMotion) {
      setCount(target);
      return;
    }

    let raf: number;
    let startTime: number;
    const tick = (now: number) => {
      if (startTime === undefined) startTime = now;
      const elapsed = (now - startTime) / 1000;
      if (elapsed >= duration) {
        setCount(target);
        return;
      }
      // ease-out for a livelier settle
      const progress = 1 - Math.pow(1 - elapsed / duration, 3);
      setCount(Math.floor(progress * target));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [target, duration, start, prefersReducedMotion]);

  return count;
}
