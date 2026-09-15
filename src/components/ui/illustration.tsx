import { useRef, type CSSProperties, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { usePrefersReducedMotion } from "@/contexts/MotionPreferenceContext";
import { DURATION, EASE_IN_OUT, EASE_OUT, REVEAL_Y } from "@/lib/motion";
import { ILLUSTRATIONS, type IllustrationSlug } from "@/data/illustrations.generated";

const url = (slug: IllustrationSlug, width: number, ext: "avif" | "webp") => `/illustrations/${slug}-${ILLUSTRATIONS[slug].hash}-${width}.${ext}`;

/** Absolute URL of the largest WebP, for og:image. */
export const illustrationOgImage = (slug: IllustrationSlug) => {
  const meta = ILLUSTRATIONS[slug];
  return `https://www.sphpnp.com${url(slug, meta.widths[meta.widths.length - 1], "webp")}`;
};

type IllustrationProps = {
  slug: IllustrationSlug;
  /** How wide the image renders at each breakpoint - drives which file the browser picks. */
  sizes: string;
  /** Above the fold: load eagerly with high fetch priority. Everything else lazy-loads. */
  priority?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Override the manifest alt text; pass "" for a purely decorative use. */
  alt?: string;
};

/**
 * A generated illustration as a responsive <picture>: AVIF first, WebP as the
 * fallback, several widths each, intrinsic width and height so nothing shifts
 * while it loads. Files are content-hashed, so they cache forever.
 */
export function Illustration({ slug, sizes, priority = false, className = "", style, alt }: IllustrationProps) {
  const meta = ILLUSTRATIONS[slug];
  const srcSet = (ext: "avif" | "webp") => meta.widths.map((w) => `${url(slug, w, ext)} ${w}w`).join(", ");
  const fallback = meta.widths[Math.min(1, meta.widths.length - 1)];
  const altText = alt ?? meta.alt;
  return (
    <picture>
      <source type="image/avif" srcSet={srcSet("avif")} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet("webp")} sizes={sizes} />
      <img
        src={url(slug, fallback, "webp")}
        width={meta.width}
        height={meta.height}
        alt={altText}
        aria-hidden={altText === "" ? true : undefined}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "auto" : "async"}
        {...(priority ? { fetchpriority: "high" } : {})}
        draggable={false}
        className={className}
        style={style}
      />
    </picture>
  );
}

type FrameProps = IllustrationProps & {
  /** "dark" sits on the navy hero, "light" on page backgrounds. */
  tone?: "dark" | "light";
  /** A small card over the frame's corner on desktop, a chip under it on a phone. */
  badge?: ReactNode;
  /** Gentle idle float and scroll parallax. Off for reduced motion. */
  animated?: boolean;
  /** "mount" for heroes already in view; "view" for frames further down the page. */
  reveal?: "mount" | "view";
  frameClassName?: string;
};

const FLOAT = { y: [0, -8, 0] };
const FLOAT_TRANSITION = { duration: 7, ease: EASE_IN_OUT, repeat: Infinity };
const ENTER_STATE = { opacity: 0, y: REVEAL_Y.section, scale: 0.98 };
const ENTERED = { opacity: 1, y: 0, scale: 1 };
const ENTER_TRANSITION = { duration: DURATION.reveal, delay: 0.1, ease: EASE_OUT };
const ENTER_ON_MOUNT = { initial: ENTER_STATE, animate: ENTERED, transition: ENTER_TRANSITION } as const;
const ENTER_IN_VIEW = { initial: ENTER_STATE, whileInView: ENTERED, viewport: { once: true, amount: 0.25 }, transition: ENTER_TRANSITION } as const;
const BADGE_ENTER = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DURATION.reveal, delay: 0.55, ease: EASE_OUT },
} as const;

/**
 * The illustration seated in a machined, two-layer frame: a translucent outer
 * tray and an inner plate with its own highlight and a concentric radius. It
 * drifts a few pixels while idle and parallaxes against the scroll, both on
 * transform only, and holds perfectly still for reduced motion.
 */
export function IllustrationFrame({ tone = "dark", badge, animated = true, reveal = "mount", frameClassName = "", ...image }: FrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();
  const live = animated && !reduce;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const parallax = useTransform(scrollYProgress, [0, 1], [18, -18]);

  const shell = tone === "dark"
    ? "bg-white/[0.06] ring-1 ring-white/15 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.55)]"
    : "bg-foreground/[0.03] ring-1 ring-border shadow-[0_30px_70px_-35px_hsl(var(--brand-navy)/0.35)]";

  return (
    <motion.div ref={ref} {...(reveal === "view" ? ENTER_IN_VIEW : ENTER_ON_MOUNT)} style={live ? { y: parallax } : undefined} className={`relative ${frameClassName}`}>
      <motion.div
        animate={live ? FLOAT : undefined}
        transition={live ? FLOAT_TRANSITION : undefined}
        className={`rounded-[1.5rem] p-1.5 sm:rounded-[2rem] sm:p-2 ${shell}`}
      >
        <div className="overflow-hidden rounded-[calc(1.5rem-0.375rem)] bg-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] sm:rounded-[calc(2rem-0.5rem)]">
          <Illustration {...image} className={`block h-auto w-full ${image.className ?? ""}`} />
        </div>
      </motion.div>
      {badge && (
        <motion.div
          {...BADGE_ENTER}
          className="mx-auto mt-4 w-fit rounded-2xl border border-border/70 bg-card/95 px-4 py-2.5 text-foreground shadow-[0_18px_40px_-18px_hsl(var(--brand-navy)/0.5)] md:absolute md:-bottom-5 md:left-4 md:mx-0 md:mt-0"
        >
          {badge}
        </motion.div>
      )}
    </motion.div>
  );
}

/** A small decorative tile: the minimal still-lifes, framed and quiet. */
export function IllustrationTile({ slug, className = "", sizes = "220px" }: { slug: IllustrationSlug; className?: string; sizes?: string }) {
  return (
    <div aria-hidden="true" className={`rounded-[1.5rem] bg-foreground/[0.04] p-1.5 ring-1 ring-border ${className}`}>
      <div className="h-full overflow-hidden rounded-[calc(1.5rem-0.375rem)]">
        <Illustration slug={slug} sizes={sizes} alt="" className="block h-full w-full object-cover" />
      </div>
    </div>
  );
}
