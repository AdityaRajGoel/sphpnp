import { Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

import { useMotionPreference, usePrefersReducedMotion } from "@/contexts/MotionPreferenceContext";
import type { MotionPreference } from "@/lib/motion-preference";

/**
 * Lets a visitor overrule what their desktop said on their behalf.
 *
 * This is a two-state control over a three-state preference on purpose. Users
 * do not think in "auto / on / off" — they think "I want the animation" or "I
 * don't". So the button reads the *current effective* state and flips it,
 * writing the explicit value that produces the opposite. `auto` remains the
 * default nobody has to choose; it just stops being a trap for the Linux
 * desktops that report `reduce` without being asked.
 *
 * The resolved preference is read rather than the raw media query, so the icon
 * always reflects the same value the rest of the app animates by.
 */
const MotionToggle = () => {
  const { setPreference } = useMotionPreference();
  const isReduced = usePrefersReducedMotion();

  const next: MotionPreference = isReduced ? "on" : "off";

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`h-9 w-9 rounded-full transition-colors duration-slow ${
        isReduced ? "text-muted-foreground hover:bg-muted" : "text-secondary hover:bg-secondary/10"
      }`}
      onClick={() => setPreference(next)}
      aria-pressed={!isReduced}
      aria-label={isReduced ? "Turn on animations" : "Reduce animations"}
      title={isReduced ? "Turn on animations" : "Reduce animations"}
    >
      {isReduced ? <Zap className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
    </Button>
  );
};

export default MotionToggle;
