import type { ReactNode } from "react";

/**
 * One colour language for every chart on the site. Gains and buying are the
 * theme's green, losses and selling its red - those two mean something and are
 * used for nothing else. Everything that is merely "a series" takes the four
 * --chart-* steps from index.css, in that fixed order, which were checked for
 * colour-vision deficiency against the card surface in both themes. The subject
 * series of a chart is --chart-3 (the blue), so it never reads as a gain.
 *
 * Two measures on different scales are never put on two y-axes: the chart
 * splits into stacked panels sharing the x-axis (see ExchangeHistory, StockFnO).
 */
export const CHART = {
  up: "hsl(var(--secondary))",
  down: "hsl(var(--destructive))",
  series: ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"] as const,
  primary: "hsl(var(--chart-3))",
  accent: "hsl(var(--chart-2))",
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
