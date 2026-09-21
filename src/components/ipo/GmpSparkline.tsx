import type { GmpSnapshot } from "@/lib/ipo";

/** The grey-market premium's path across our snapshots, sized to sit beside the figure in a table cell. */
export default function GmpSparkline({ history, width = 56, height = 18 }: { history: GmpSnapshot[]; width?: number; height?: number }) {
  const values = history.map((h) => h.gmp).filter((v): v is number => Number.isFinite(v));
  if (values.length < 3) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * (width - 2) + 1;
  const y = (v: number) => height - 1 - ((v - min) / span) * (height - 2);
  const first = values[0], last = values.at(-1)!;
  const tone = last > first ? "text-secondary" : last < first ? "text-destructive" : "text-muted-foreground";
  const label = `GMP ${last > first ? "up" : last < first ? "down" : "flat"} from ₹${first} to ₹${last} over ${values.length} readings`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={`inline-block align-middle ${tone}`} role="img" aria-label={label}>
      <title>{label}</title>
      <polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(last)} r="1.8" fill="currentColor" />
    </svg>
  );
}
