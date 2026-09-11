import type { ReactNode } from "react";

/**
 * One colour language for every chart on the site: gains and buying in the
 * theme's green, losses and selling in its red, the subject series in the
 * brand primary, comparisons in gold and orange. Colours come from the theme's
 * CSS variables, so charts follow light and dark mode with the rest of the page.
 */
export const CHART = {
  up: "hsl(var(--secondary))",
  down: "hsl(var(--destructive))",
  // Not the theme's --primary: that is navy in light mode but green in dark,
  // where it would be indistinguishable from the gain colour.
  primary: "hsl(217 80% 55%)",
  accent: "hsl(var(--brand-orange))",
  gold: "hsl(var(--brand-gold))",
  sky: "hsl(199 89% 48%)",
  violet: "hsl(262 83% 58%)",
  muted: "hsl(var(--muted-foreground))",
  grid: "hsl(var(--border))",
  axis: "hsl(var(--muted-foreground))",
};

export const axisTick = { fill: CHART.axis, fontSize: 11 };

export const tooltipStyle = {
  contentStyle: { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--popover-foreground))" },
  labelStyle: { color: "hsl(var(--popover-foreground))", fontWeight: 600 },
  itemStyle: { color: "hsl(var(--popover-foreground))" },
  cursor: { fill: "hsl(var(--muted) / 0.5)" },
};

export function SectionHeading({ id, title, subtitle, children }: { id: string; title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id={id} className="text-2xl font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{text}</p>;
}
