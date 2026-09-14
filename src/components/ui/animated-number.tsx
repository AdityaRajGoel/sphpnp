import { useEffect, useRef, useState } from "react";
import { animate } from "motion/react";
import { usePrefersReducedMotion } from "@/contexts/MotionPreferenceContext";
import { DURATION, EASE_OUT } from "@/lib/motion";

type Props = {
  value: number | null;
  /** Renders the in-flight number; receives the tweened value. */
  format?: (value: number) => string;
  /** Shown for a null value. */
  fallback?: string;
  className?: string;
};

/**
 * A number that counts to its new value instead of snapping - on first render
 * from zero, afterwards from whatever it showed last, so a refresh visibly moves
 * a figure rather than silently replacing it. Reduced motion jumps straight
 * there. Uses `tabular-nums` so the width does not jitter mid-count.
 */
export default function AnimatedNumber({ value, format = (v) => v.toLocaleString("en-IN"), fallback = "—", className = "" }: Props) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState<number | null>(value === null ? null : reduced ? value : 0);
  const from = useRef(0);

  useEffect(() => {
    if (value === null) { setShown(null); return; }
    if (reduced) { setShown(value); from.current = value; return; }
    const controls = animate(from.current, value, {
      duration: DURATION.reveal * 1.6,
      ease: EASE_OUT,
      onUpdate: (v) => setShown(v),
      onComplete: () => { from.current = value; },
    });
    return () => { from.current = shown ?? value; controls.stop(); };
    // `shown` is read only to resume an interrupted tween, not to restart one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduced]);

  return <span className={`tabular-nums ${className}`}>{shown === null ? fallback : format(shown)}</span>;
}
