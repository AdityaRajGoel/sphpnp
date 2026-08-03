import { forwardRef, useCallback, useImperativeHandle } from "react";
import { motion } from "motion/react";
import { DURATION, EASE_IN_OUT } from "@/lib/motion";
import { useAnimatedIcon } from "./useAnimatedIcon";
import { scaledStrokeWidth } from "./types";
import type { AnimatedIconHandle, AnimatedIconProps } from "./types";

/**
 * Handset with two signal arcs that pulse outward on interaction.
 *
 * Ported from itshover (Apache-2.0). Used for "Request Callback" instead of
 * upstream's `telephone-icon`, which is mislabelled: its paths and class names
 * (`stadium-bowl`, `stadium-roof`, `stadium-pillar-*`) draw a stadium.
 */
const PhoneVolumeIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  ({ size = 24, color = "currentColor", strokeWidth = 2, className = "" }, ref) => {
    const { scope, animate, enabled } = useAnimatedIcon();

    const start = useCallback(() => {
      if (!enabled) return;
      animate(
        ".phone-wave-inner",
        { scale: [1, 1.15, 1], opacity: [0.4, 1, 0.4] },
        { duration: DURATION.slow, ease: [...EASE_IN_OUT] },
      );
      animate(
        ".phone-wave-outer",
        { scale: [1, 1.25, 1], opacity: [0.2, 0.8, 0.2] },
        { duration: DURATION.slow, ease: [...EASE_IN_OUT], delay: 0.1 },
      );
    }, [animate, enabled]);

    const stop = useCallback(() => {
      if (!enabled) return;
      animate(
        ".phone-wave",
        { opacity: 1, scale: 1 },
        { duration: DURATION.fast, ease: [...EASE_IN_OUT] },
      );
    }, [animate, enabled]);

    useImperativeHandle(ref, () => ({ startAnimation: start, stopAnimation: stop }), [start, stop]);

    return (
      <motion.span
        ref={scope}
        onHoverStart={start}
        onHoverEnd={stop}
        className={`inline-flex ${className}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          stroke={color}
          strokeWidth={scaledStrokeWidth(strokeWidth, 32)}
          strokeLinecap="square"
          strokeMiterlimit="10"
          aria-hidden="true"
          focusable="false"
        >
          <motion.path d="m21.3832,18.2745l-3.1744,3.9688c-3.4906-2.0516-6.3996-4.9606-8.4513-8.4513l3.9702-3.1756L9.9013,1.9994l-6.4617,1.6761c-.9444.2466-1.555,1.1606-1.4212,2.1274,1.7626,12.5517,11.6278,22.4169,24.1795,24.1795.9665.1332,1.8799-.4773,2.1264-1.4212l1.6758-6.4603-8.6168-3.8264Z" />
          <motion.path
            className="phone-wave-inner phone-wave"
            style={{ transformOrigin: "21.5px 10.5px" }}
            d="m19,8c2.7614,0,5,2.2386,5,5"
            initial={{ opacity: 1 }}
          />
          <motion.path
            className="phone-wave-outer phone-wave"
            style={{ transformOrigin: "24px 8px" }}
            d="m19,3c5.5228,0,10,4.4772,10,10"
            initial={{ opacity: 1 }}
          />
        </svg>
      </motion.span>
    );
  },
);

PhoneVolumeIcon.displayName = "PhoneVolumeIcon";
export default PhoneVolumeIcon;
