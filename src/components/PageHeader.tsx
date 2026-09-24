import type { ReactNode } from "react";

type Props = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Actions, filters or live stats, laid out in a centred, wrapping row under the copy. */
  children?: ReactNode;
  /** The header is the page title, so an h1 unless a page already has one. */
  headingLevel?: 1 | 2;
  className?: string;
};

/**
 * Centred header for the tool pages (calculators, screener, IPO, trackers),
 * after the group's webtrade platform: title, a short accent rule, the intro
 * underneath. In the site's own colours - a solid brand-green rule - and the
 * heading face (IBM Plex Sans) as every other heading. Replaces the dark
 * image banner on these pages: the tool is the point, and the illustration
 * was the heaviest image on each.
 */
export default function PageHeader({ eyebrow, title, description, children, headingLevel = 1, className = "" }: Props) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <header className={`rounded-2xl bg-muted/40 px-5 pb-9 pt-8 text-center sm:px-8 md:pb-10 md:pt-10 ${className}`}>
      {eyebrow && (
        <p className="mb-3 inline-flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-secondary">{eyebrow}</p>
      )}
      <Heading className="font-heading text-3xl font-bold leading-tight tracking-tight text-foreground [text-wrap:balance] md:text-4xl">{title}</Heading>
      <div className="mx-auto mt-4 h-[3px] w-[100px] rounded-full bg-secondary" aria-hidden="true" />
      {description && <p className="mx-auto mt-4 max-w-2xl text-[0.9375rem] leading-relaxed text-muted-foreground md:text-base">{description}</p>}
      {children && <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">{children}</div>}
    </header>
  );
}

/** A compact stat for the header's action row: a label over a figure. */
export function HeaderStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border bg-card px-3.5 py-2 text-left">
      <div className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
