import type { ReactNode } from "react";
import { motion } from "motion/react";
import { DURATION, EASE_OUT, REVEAL_Y, STAGGER } from "@/lib/motion";
import { IllustrationFrame } from "@/components/ui/illustration";
import type { IllustrationSlug } from "@/data/illustrations.generated";

const rise = (i: number) =>
  ({
    initial: { opacity: 0, y: REVEAL_Y.item },
    animate: { opacity: 1, y: 0 },
    transition: { duration: DURATION.reveal, delay: i * STAGGER * 1.5, ease: EASE_OUT },
  }) as const;

type Props = {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Calls to action or supporting links under the subtitle. */
  children?: ReactNode;
  illustration: IllustrationSlug;
  badge?: ReactNode;
};

/**
 * Editorial split hero for the service pages: the promise on the left, the
 * page's illustration framed on the right. It is the page's largest paint, so
 * the image loads with high priority. Stacks text-first on a phone.
 */
export default function SplitHero({ eyebrow, title, subtitle, children, illustration, badge }: Props) {
  return (
    <section className="relative overflow-hidden bg-hero text-primary-foreground">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -right-24 top-0 h-[28rem] w-[28rem] rounded-full bg-secondary/20 blur-3xl" />
        <div className="absolute -left-16 bottom-0 h-80 w-80 rounded-full bg-brand-gold/10 blur-3xl" />
      </div>
      <div className="container relative z-10 mx-auto grid max-w-7xl items-center gap-8 px-4 pb-14 pt-10 md:gap-10 md:pb-24 md:pt-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
        <div className="text-center lg:text-left">
          {eyebrow && (
            <motion.p {...rise(0)} className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-primary-foreground/85">
              {eyebrow}
            </motion.p>
          )}
          <motion.h1 {...rise(1)} className="font-heading text-4xl font-bold leading-[1.08] tracking-tight [text-wrap:balance] md:text-5xl lg:text-6xl">
            {title}
          </motion.h1>
          {subtitle && (
            <motion.p {...rise(2)} className="mx-auto mt-5 max-w-xl text-lg text-primary-foreground/80 lg:mx-0">
              {subtitle}
            </motion.p>
          )}
          {children && <motion.div {...rise(3)} className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">{children}</motion.div>}
        </div>
        <IllustrationFrame
          slug={illustration}
          priority
          sizes="(min-width: 1280px) 700px, (min-width: 1024px) 55vw, 100vw"
          badge={badge}
          frameClassName="-mx-1 w-auto sm:mx-auto sm:w-full sm:max-w-2xl lg:max-w-none"
        />
      </div>
    </section>
  );
}
