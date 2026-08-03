import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { motion } from "motion/react";
import { DURATION, EASE_IN_OUT, EASE_OUT } from "@/lib/motion";
import { useAnimatedIcon } from "./useAnimatedIcon";
import type { AnimatedIconHandle, AnimatedIconProps } from "./types";

/**
 * Arrow drops through the tray and returns, then the tray takes the weight.
 *
 * Ported from itshover (Apache-2.0) with two deliberate changes:
 *
 * - Upstream looped this inside `while (isAnimatingRef.current)`, exiting only
 *   on hover-end. These buttons unmount when the menu collapses, so a pointer
 *   leaving via unmount rather than hover-end left the loop running against a
 *   detached scope. It now plays once per trigger and checks `isMounted`.
 * - The loop is also the wrong gesture here. `@/lib/motion` reserves repeating
 *   animation for ambient decoration and not for UI feedback, and a download
 *   button is feedback.
 */
const DownloadIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  ({ size = 24, color = "currentColor", strokeWidth = 2, className = "", ...rest }, ref) => {
    const { scope, animate, enabled, isMounted } = useAnimatedIcon();
    const isPlaying = useRef(false);

    const start = useCallback(async () => {
      if (!enabled || isPlaying.current) return;
      isPlaying.current = true;

      const drop = { y: [0, 8, 8, -8, 0], opacity: [1, 0, 0, 0, 1] };

      animate(".arrow-head", drop, {
        duration: DURATION.reveal,
        times: [0, 0.4, 0.5, 0.6, 1],
        ease: [...EASE_IN_OUT],
      });
      await animate(".arrow-stem", drop, {
        duration: DURATION.reveal,
        times: [0, 0.3, 0.4, 0.5, 1],
        ease: [...EASE_IN_OUT],
      });

      if (isMounted.current) {
        await animate(
          ".tray",
          { y: [0, 2, 0], scale: [1, 1.05, 1] },
          { duration: DURATION.base, ease: [...EASE_OUT] },
        );
      }

      isPlaying.current = false;
    }, [animate, enabled, isMounted]);

    const stop = useCallback(() => {
      if (!enabled) return;
      isPlaying.current = false;
      animate(
        ".arrow-head, .arrow-stem, .tray",
        { y: 0, opacity: 1, scale: 1 },
        { duration: DURATION.fast, ease: [...EASE_OUT] },
      );
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
        style={{ overflow: "visible" }}
        {...rest}
      >
        <motion.path
          className="tray"
          d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
          style={{ transformOrigin: "center bottom" }}
        />
        <motion.path className="arrow-stem" d="M12 15V3" style={{ transformOrigin: "center" }} />
        <motion.path className="arrow-head" d="m7 10 5 5 5-5" style={{ transformOrigin: "center" }} />
      </motion.svg>
    );
  },
);

DownloadIcon.displayName = "DownloadIcon";
export default DownloadIcon;
