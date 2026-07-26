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
 *
 * The origin is centre, not left, because every one of these rules is
 * `mx-auto`. Under the old `width: 0 -> 80` the auto margins re-centred the
 * box on each frame, so it opened symmetrically from the middle; a left
 * origin would have it wipe in from one side instead.
 */
export const revealBar = {
  initial: { scaleX: 0 },
  whileInView: { scaleX: 1 },
  viewport: { once: true, amount: 0.5 },
  transition: { duration: DURATION.reveal, delay: 0.3, ease: EASE_OUT },
  style: { transformOrigin: "center" },
} as const;

/**
 * Reveal for elements that arrive by growing rather than lifting - badges,
 * pill cards, anything whose position on the page is already settled.
 *
 * Scale starts at 0.94, not lower. Below about 0.9 the growth stops reading
 * as an arrival and starts reading as a bounce, which is a louder gesture
 * than a reveal should be and fights the restraint of the rest of the scale.
 */
export const revealPop = (index = 0) =>
  ({
    initial: { opacity: 0, scale: 0.94 },
    whileInView: { opacity: 1, scale: 1 },
    viewport: { once: true, amount: 0.3 },
    transition: { duration: DURATION.reveal, delay: index * STAGGER, ease: EASE_OUT },
  }) as const;

/**
 * Eyebrow labels that settle their tracking as they arrive.
 *
 * letterSpacing is layout-bound, so this forces a text re-layout every frame.
 * It is kept because the widening tracking is the effect, and there is no
 * transform that reproduces it; scaleX would distort the glyphs. Reserved for
 * short single-line labels, where the reflow cost is a few words rather than
 * a paragraph. Never use it on body copy.
 */
export const revealTracking = {
  initial: { opacity: 0, letterSpacing: "0em" },
  whileInView: { opacity: 1, letterSpacing: "0.15em" },
  viewport: { once: true, amount: 0.5 },
  transition: { duration: DURATION.reveal, delay: 0.2, ease: EASE_OUT },
} as const;

/**
 * Icon badges that spin into place - rating stars and award marks.
 *
 * Deliberately louder than the rest of the scale, and deliberately rare: it
 * exists for a handful of decorative marks, not for content. Both transforms
 * are compositor-friendly, so the cost is only visual attention.
 */
export const revealSpin = (index = 0) =>
  ({
    initial: { opacity: 0, scale: 0, rotate: -180 },
    whileInView: { opacity: 1, scale: 1, rotate: 0 },
    viewport: { once: true, amount: 0.5 },
    transition: { duration: DURATION.reveal, delay: index * STAGGER, ease: EASE_OUT },
  }) as const;
