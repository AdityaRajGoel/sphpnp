import type { ReactNode } from "react";

type Props = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Actions, filters or live stats, laid out in a wrapping row under the copy. */
  children?: ReactNode;
  /** The header is the page title, so an h1 unless a page already has one. */
  headingLevel?: 1 | 2;
  className?: string;
};

/**
 * Compact, left-aligned header for the tool pages (calculators, screener, IPO,
 * trackers): eyebrow, title, a short intro, then any actions or live stats.
 * It stays small on purpose - the data under it is the point, and a tall
 * centred banner pushed that data below the fold on a phone. The heading face
 * (IBM Plex Sans) as every other heading; no rule, tint or illustration.
 */
export default function PageHeader({ eyebrow, title, description, children, headingLevel = 1, className = "" }: Props) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <header className={`py-5 ${className}`}>
      {eyebrow && (
        <p className="mb-1.5 flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-secondary">{eyebrow}</p>
      )}
      <Heading className="font-heading text-3xl font-bold leading-tight tracking-tight text-foreground [text-wrap:balance] md:text-4xl">{title}</Heading>
      {description && <p className="mt-2 max-w-prose text-[0.9375rem] leading-relaxed text-muted-foreground">{description}</p>}
      {children && <div className="mt-4 flex flex-wrap items-center gap-2.5">{children}</div>}
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
