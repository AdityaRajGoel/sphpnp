import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Check } from "lucide-react";
import { IllustrationFrame } from "@/components/ui/illustration";
import { revealItem, revealSection } from "@/lib/motion";
import type { IllustrationSlug } from "@/data/illustrations.generated";

export type StoryItem = {
  slug: IllustrationSlug;
  eyebrow: string;
  title: string;
  body: string;
  points?: string[];
  to: string;
  cta: string;
};

type Props = { id?: string; eyebrow: string; heading: string; intro?: string; items: StoryItem[] };

/**
 * Large illustrated rows that alternate sides on desktop - the illustration
 * takes seven of twelve columns, so the scene is read, not glanced at. On a
 * phone every row is the full-width image first, then its copy, so nothing is
 * squeezed into a thumbnail.
 */
export default function FeatureStory({ id, eyebrow, heading, intro, items }: Props) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-heading` : undefined} className="relative overflow-hidden py-16 md:py-28">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute left-1/2 top-24 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-secondary/[0.06] blur-3xl" />
      </div>
      <div className="container mx-auto max-w-6xl px-4">
        <motion.div {...revealSection} className="mx-auto max-w-2xl text-center">
          <p className="mb-4 inline-flex rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-secondary">{eyebrow}</p>
          <h2 id={id ? `${id}-heading` : undefined} className="font-heading text-3xl font-bold tracking-tight [text-wrap:balance] md:text-5xl">{heading}</h2>
          {intro && <p className="mt-4 text-muted-foreground md:text-lg">{intro}</p>}
        </motion.div>

        <div className="mt-10 space-y-12 md:mt-20 md:space-y-28">
          {items.map((item, i) => {
            const flip = i % 2 === 1;
            return (
              <article key={item.title} className="grid items-center gap-7 md:grid-cols-12 md:gap-12">
                <div className={`md:col-span-7 ${flip ? "md:order-2" : ""} ${i > 0 ? "max-md:hidden" : ""}`}>
                  <IllustrationFrame
                    slug={item.slug}
                    tone="light"
                    reveal="view"
                    sizes="(min-width: 1152px) 660px, (min-width: 768px) 58vw, 100vw"
                    frameClassName="-mx-1 sm:mx-0"
                  />
                </div>
                <motion.div {...revealItem(1)} className={`md:col-span-5 ${flip ? "md:order-1" : ""}`}>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-secondary">{item.eyebrow}</p>
                  <h3 className="mt-2 font-heading text-2xl font-bold tracking-tight [text-wrap:balance] md:text-3xl">{item.title}</h3>
                  <p className="mt-3 text-muted-foreground leading-relaxed">{item.body}</p>
                  {item.points && (
                    <ul className="mt-5 space-y-2.5">
                      {item.points.map((p) => (
                        <li key={p} className="flex items-start gap-2.5 text-sm">
                          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-secondary/15 text-secondary"><Check className="h-3 w-3" aria-hidden="true" /></span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link to={item.to} className="group mt-7 inline-flex items-center gap-3 rounded-full bg-brand-navy py-1.5 pl-5 pr-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-navy/90 pressable">
                    {item.cta}
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15 transition-transform duration-base group-hover:translate-x-0.5 group-hover:-translate-y-px"><ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
                  </Link>
                </motion.div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
