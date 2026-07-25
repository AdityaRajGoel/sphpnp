/**
 * Shared motion vocabulary.
 *
 * These mirror the `--ease-*` and `--duration-*` custom properties in index.css
 * so CSS transitions and Motion animations move on the same curves. Import from
 * here instead of writing a cubic-bezier inline: before this existed the site
 * used four different "ease out" curves plus ~90 animations with no easing at
 * all, which is why the same gesture felt different from page to page.
 */

/** Entering and exiting UI. Starts fast, so it reads as immediate. */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** Elements moving or morphing while already on screen. */
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;

/** Sheets and panels travelling a long distance. */
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;

/** Seconds, to match Motion's unit. Kept in step with --duration-* in index.css. */
export const DURATION = {
  press: 0.14,
  fast: 0.18,
  base: 0.24,
  slow: 0.36,
  /** Section-scale entrances, which are allowed to be slower than UI feedback. */
  reveal: 0.5,
  /** Decorative loops only — marquees, ambient pulses. Never UI feedback. */
  ambient: 1,
} as const;

/**
 * Two reveal distances, deliberately. `item` for things inside a section (cards,
 * rows, list entries), `section` for a whole block arriving. Anything further
 * than this reads as a slide rather than a lift.
 */
export const REVEAL_Y = { item: 16, section: 24 } as const;

/**
 * Stagger between siblings entering together. Long delays make an interface feel
 * slow, so this stays short and is never allowed to gate interaction.
 */
export const STAGGER = 0.06;

/** Scroll-triggered reveal for a section. Spread onto a `motion` element. */
export const revealSection = {
  initial: { opacity: 0, y: REVEAL_Y.section },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: DURATION.reveal, ease: EASE_OUT },
} as const;

/** Scroll-triggered reveal for one item in a group, staggered by index. */
export const revealItem = (index = 0) =>
  ({
    initial: { opacity: 0, y: REVEAL_Y.item },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.3 },
    transition: { duration: DURATION.reveal, delay: index * STAGGER, ease: EASE_OUT },
  }) as const;

/**
 * Horizontal counterpart to `revealItem`, for the two-column layouts where the
 * halves arrive from opposite edges. Same distance as the vertical item reveal:
 * a longer travel reads as a slide rather than a settle.
 */
export const revealItemX = (from: "left" | "right", index = 0) =>
  ({
    initial: { opacity: 0, x: from === "left" ? -REVEAL_Y.item : REVEAL_Y.item },
    whileInView: { opacity: 1, x: 0 },
    viewport: { once: true, amount: 0.3 },
    transition: { duration: DURATION.reveal, delay: index * STAGGER, ease: EASE_OUT },
  }) as const;

/**
 * Fade with no movement, for elements whose position is already meaningful —
 * background art, overlays, anything where a lift would fight the layout.
 */
export const revealFade = {
  initial: { opacity: 0 },
  whileInView: { opacity: 1 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: DURATION.reveal, ease: EASE_OUT },
} as const;

/**
 * The decorative rule that grows under a section heading.
 *
 * Animates scaleX, not width. Width is layout-bound: animating it forces a
 * layout pass on every frame, while the user is scrolling, on the busiest
 * pages. scaleX is visually identical on a solid bar and stays on the
 * compositor. Give the element its final width in CSS and let this scale it.
 */
export const revealBar = {
  initial: { scaleX: 0 },
  whileInView: { scaleX: 1 },
  viewport: { once: true, amount: 0.5 },
  transition: { duration: DURATION.reveal, delay: 0.3, ease: EASE_OUT },
  style: { transformOrigin: "left" },
} as const;
