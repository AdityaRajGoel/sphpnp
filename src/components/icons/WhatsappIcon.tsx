import { forwardRef, useCallback, useImperativeHandle } from "react";
import { motion } from "motion/react";
import { DURATION, EASE_IN_OUT, EASE_OUT } from "@/lib/motion";
import { useAnimatedIcon } from "./useAnimatedIcon";
import type { AnimatedIconHandle, AnimatedIconProps } from "./types";

/**
 * WhatsApp mark whose handset wags on interaction.
 *
 * Ported from itshover (Apache-2.0). Upstream ran the wag at a hardcoded 0.4s
 * `easeInOut`; retimed to DURATION.slow on the shared curve so it matches the
 * rest of the site's motion.
 */
const WhatsappIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  ({ size = 24, color = "currentColor", strokeWidth = 2, className = "", ...rest }, ref) => {
    const { scope, animate, enabled } = useAnimatedIcon();

    const start = useCallback(() => {
      if (!enabled) return;
      animate(
        ".whatsapp-handset",
        { rotate: [0, -15, 15, -10, 10, 0] },
        { duration: DURATION.slow, ease: [...EASE_IN_OUT] },
      );
    }, [animate, enabled]);

    const stop = useCallback(() => {
      if (!enabled) return;
      animate(".whatsapp-handset", { rotate: 0 }, { duration: DURATION.fast, ease: [...EASE_OUT] });
    }, [animate, enabled]);

    useImperativeHandle(ref, () => ({ startAnimation: start, stopAnimation: stop }), [start, stop]);

    return (
      <motion.svg
        ref={scope}
        onHoverStart={start}
        onHoverEnd={stop}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        className={className}
        {...rest}
      >
        <path d="M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9" />
        <motion.path
          className="whatsapp-handset"
          style={{ transformOrigin: "50% 50%" }}
          d="M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1"
        />
      </motion.svg>
    );
  },
);

WhatsappIcon.displayName = "WhatsappIcon";
export default WhatsappIcon;
