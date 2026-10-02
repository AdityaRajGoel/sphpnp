import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, axisTick, tooltipStyle } from "@/components/markets/chart-kit";
import { niceTicks } from "@/lib/stock-charts";
import { inr } from "./fields";

/** ₹12.5L, ₹1.2Cr - axis labels short enough for a phone. */
const compactInr = (n: number) =>
  n >= 1e7 ? `₹${+(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `₹${+(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `₹${+(n / 1e3).toFixed(0)}K` : `₹${n}`;

type Series = { key: "a" | "b"; label: string };

/**
 * Two rupee series by year on one axis: the subject (--chart-3) solid, the
 * reference (invested, withdrawn) muted and dashed. Legend in ink, not colour.
 */
export default function ValueChart({ rows, subject, reference, label }: {
  rows: { year: number; a: number; b: number }[];
  subject: Series;
  reference: Series;
  /** What the chart shows, for screen readers. */
  label: string;
}) {
  if (rows.length < 2) return null;
  const ticks = niceTicks(rows.flatMap((r) => [r.a, r.b]));
  const names = { a: subject.key === "a" ? subject.label : reference.label, b: subject.key === "b" ? subject.label : reference.label };
  return (
    <figure>
      <div className="h-56 w-full" role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="year" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(y: number) => `Yr ${y}`} minTickGap={16} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} width={56} ticks={ticks} domain={[ticks[0], ticks[ticks.length - 1]]} tickFormatter={compactInr} />
            <Tooltip
              {...tooltipStyle}
              cursor={{ stroke: CHART.grid }}
              labelFormatter={(y) => `Year ${y}`}
              formatter={(v: number, key: string) => [inr(v), names[key as "a" | "b"]]}
            />
            <Line type="monotone" dataKey={reference.key} stroke={CHART.muted} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey={subject.key} stroke={CHART.primary} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-0.5 w-4" style={{ background: CHART.primary }} />{subject.label}</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: CHART.muted }} />{reference.label}</span>
      </figcaption>
    </figure>
  );
}
