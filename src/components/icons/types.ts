/**
 * Shared contract for the animated icons ported from itshover (Apache-2.0).
 *
 * Ported rather than installed via `npx shadcn add` because the upstream
 * components hardcode their own durations and easings. This site already has a
 * motion vocabulary in `@/lib/motion` that exists specifically to stop that
 * drift, so every icon is re-pointed at it on the way in. See useAnimatedIcon.
 */
import type { SVGProps } from "react";

/** Stroke width the 24x24 outline icons are drawn for. */
export const DEFAULT_STROKE_WIDTH = 2;

/**
 * Keep the stroke visually constant on icons drawn at a larger viewBox.
 * A 2px stroke on a 32x32 grid reads thinner than on 24x24 once both are
 * scaled to the same rendered size, so scale it by the ratio.
 */
export function scaledStrokeWidth(strokeWidth: number, viewBoxSize: number): number {
  return strokeWidth * (viewBoxSize / 24);
}

/**
 * The omitted members are the ones Motion redefines with its own signatures.
 * Leaving React's DOM versions in place makes the props unassignable to
 * `SVGMotionProps` the moment they are spread onto a `motion.svg`.
 */
export interface AnimatedIconProps
  extends Omit<
    SVGProps<SVGSVGElement>,
    | "ref"
    | "onAnimationStart"
    | "onAnimationEnd"
    | "onAnimationIteration"
    | "onDrag"
    | "onDragEnd"
    | "onDragEnter"
    | "onDragExit"
    | "onDragLeave"
    | "onDragOver"
    | "onDragStart"
    | "onDrop"
    | "values"
  > {
  /** Rendered size in px. Prefer this over `w-*`/`h-*` classes: the classes
   *  land on the wrapper, while the SVG sizes itself from this prop. */
  size?: number;
  /** Defaults to currentColor, so the icon inherits the button's text colour. */
  color?: string;
  strokeWidth?: number;
  className?: string;
}

/**
 * Imperative handle for playing an icon without a pointer.
 *
 * This is the escape hatch that makes these icons worth shipping on a
 * mobile-heavy site: `onHoverStart` never fires on a touch screen, so anything
 * hover-only would be dead weight for most of our traffic.
 */
export interface AnimatedIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}
