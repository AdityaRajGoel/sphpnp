import type { CSSProperties, ReactNode } from "react";
import { motion } from "motion/react";
import { usePrefersReducedMotion } from "@/contexts/MotionPreferenceContext";
import { DURATION, EASE_OUT, REVEAL_Y, STAGGER } from "@/lib/motion";
import { Illustration } from "@/components/ui/illustration";
import type { IllustrationSlug } from "@/data/illustrations.generated";

type Focus = { mobile?: string; desktop?: string };

type Props = {
  /** A dark still-life: lens, steps, figure or orbit. */
  slug: IllustrationSlug;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Actions, filters or live stats, laid out in a wrapping row under the copy. */
  children?: ReactNode;
  /** CSS object-position per device, so the subject lands in view on each. */
  focus?: Focus;
  /** The banner is the page title, so an h1 unless a page already has one. */
  headingLevel?: 1 | 2;
  className?: string;
};

const rise = (i: number) =>
  ({
    initial: { opacity: 0, y: REVEAL_Y.item },
    animate: { opacity: 1, y: 0 },
    transition: { duration: DURATION.reveal, delay: 0.08 + i * STAGGER * 1.5, ease: EASE_OUT },
  }) as const;

const SETTLE = { initial: { scale: 1.08, opacity: 0.4 }, animate: { scale: 1, opacity: 1 }, transition: { duration: 1.4, ease: EASE_OUT } } as const;
const SWEEP = { initial: { x: "-30%" }, animate: { x: "130%" }, transition: { duration: 6, ease: EASE_OUT, repeat: Infinity, repeatDelay: 4 } } as const;

/**
 * Image-led page header for the terminal and tool pages. The still-life fills
 * the right of the panel on desktop, fading into the copy; on a phone it
 * becomes a full-width band above the title, cropped to its own focal point
 * instead of shrinking. The image settles in from a slight zoom and a slow
 * light sweeps across the panel - both transform-only and absent for reduced
 * motion.
 */
export default function ImageBanner({ slug, eyebrow, title, description, children, focus, headingLevel = 1, className = "" }: Props) {
  const reduce = usePrefersReducedMotion();
  const Heading = headingLevel === 1 ? motion.h1 : motion.h2;
  const position = { "--focus-m": focus?.mobile ?? "50% 50%", "--focus-d": focus?.desktop ?? "60% 50%" } as CSSProperties;

  return (
    <section className={`relative isolate overflow-hidden rounded-[1.75rem] bg-[#0a1624] text-white shadow-[0_30px_80px_-40px_rgba(10,22,36,0.9)] ring-1 ring-white/10 ${className}`}>
      <div className="relative h-44 overflow-hidden sm:h-56 md:absolute md:inset-y-0 md:right-0 md:h-auto md:w-[64%]" aria-hidden="true">
        <motion.div {...(reduce ? {} : SETTLE)} className="h-full w-full">
          <Illustration
            slug={slug}
            alt=""
            priority
            sizes="(min-width: 768px) 64vw, 100vw"
            className="h-full w-full object-cover [object-position:var(--focus-m)] md:[object-position:var(--focus-d)]"
            style={position}
          />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a1624] via-[#0a1624]/20 to-transparent md:bg-gradient-to-r md:from-[#0a1624] md:via-[#0a1624]/55 md:to-transparent" />
      </div>

      {!reduce && (
        <motion.div {...SWEEP} className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" aria-hidden="true" />
      )}

      <div className="relative -mt-8 px-5 pb-7 sm:px-8 md:mt-0 md:max-w-[58%] md:px-10 md:py-12 lg:py-14">
        {eyebrow && (
          <motion.p {...rise(0)} className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-white/85 backdrop-blur-sm">
            {eyebrow}
          </motion.p>
        )}
        <Heading {...rise(1)} className="font-heading text-3xl font-bold leading-[1.1] tracking-tight [text-wrap:balance] sm:text-4xl md:text-5xl">
          {title}
        </Heading>
        {description && (
          <motion.p {...rise(2)} className="mt-3 max-w-2xl text-[0.9375rem] leading-relaxed text-white/75 md:text-base">
            {description}
          </motion.p>
        )}
        {children && <motion.div {...rise(3)} className="mt-6 flex flex-wrap items-center gap-2.5">{children}</motion.div>}
      </div>
    </section>
  );
}

/** A compact stat for the banner's action row: a label over a figure. */
export function BannerStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2 backdrop-blur-sm">
      <div className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-white/60">{label}</div>
      <div className="text-sm font-semibold tabular-nums text-white">{value}</div>
    </div>
  );
}
