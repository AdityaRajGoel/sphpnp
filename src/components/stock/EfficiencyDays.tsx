import { motion } from "motion/react";
import { Timer } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DURATION, EASE_OUT, STAGGER, revealSection } from "@/lib/motion";
import type { StatementGrid } from "@/lib/statements";

const LINES = ["Debtor Days", "Inventory Days", "Days Payable", "Cash Conversion Cycle", "Working Capital Days"];
const YEARS = 6;

/**
 * The working-capital cycle from the ratios statement: how many days of sales
 * sit in receivables, inventory and working capital, year by year. Fewer days
 * is cash coming home faster, so a falling line is tinted as an improvement -
 * except payables, where more days is the supplier funding the business.
 */
export default function EfficiencyDays({ ratios }: { ratios: StatementGrid | undefined }) {
  const lines = (ratios?.rows ?? []).filter((r) => LINES.includes(r.label) && r.values.some((v) => v !== null));
  if (!ratios || lines.length === 0) return null;
  const start = Math.max(0, ratios.periods.length - YEARS);
  const periods = ratios.periods.slice(start);

  return (
    <motion.section {...revealSection} aria-labelledby="efficiency-heading">
      <Card className="p-5">
        <h2 id="efficiency-heading" className="flex items-center gap-2 text-lg font-bold">
          <Timer className="h-4 w-4 text-secondary" aria-hidden="true" /> Working-capital cycle
        </h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {lines.map((line) => {
            const values = line.values.slice(start);
            const known = values.filter((v): v is number => v !== null);
            const max = Math.max(...known.map(Math.abs), 1);
            const first = known[0];
            const last = known[known.length - 1];
            const change = known.length > 1 ? last - first : null;
            const improving = change !== null && change !== 0 && (line.label === "Days Payable" ? change > 0 : change < 0);
            return (
              <figure key={line.label} className="min-w-0">
                <figcaption className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">{line.label}</span>
                  <span className="font-semibold tabular-nums">{last === undefined ? "—" : Math.round(last)}</span>
                </figcaption>
                <div className="mt-2 flex h-14 items-end gap-1" role="img" aria-label={`${line.label}: ${periods.map((p, i) => `${p} ${values[i] ?? "not reported"}`).join(", ")}`}>
                  {values.map((v, i) => (
                    <motion.div
                      key={periods[i]}
                      initial={{ scaleY: 0 }}
                      whileInView={GROW_Y}
                      viewport={VIEWPORT}
                      transition={{ duration: DURATION.slow, delay: i * STAGGER, ease: EASE_OUT }}
                      title={`${periods[i]}: ${v ?? "not reported"}`}
                      style={{ height: `${v === null ? 4 : Math.max(6, (Math.abs(v) / max) * 100)}%`, transformOrigin: "bottom" }}
                      className={`flex-1 rounded-sm ${v === null ? "bg-muted" : v < 0 ? "bg-destructive/60" : i === values.length - 1 ? "bg-secondary" : "bg-secondary/35"}`}
                    />
                  ))}
                </div>
                {change !== null && (
                  <p className={`mt-1 text-xs tabular-nums ${improving ? "text-secondary" : change === 0 ? "text-muted-foreground" : "text-destructive"}`}>
                    {change > 0 ? "+" : ""}{Math.round(change)} days since {periods[values.findIndex((v) => v !== null)]}
                  </p>
                )}
              </figure>
            );
          })}
        </div>
      </Card>
    </motion.section>
  );
}

const GROW_Y = { scaleY: 1 } as const;
const VIEWPORT = { once: true } as const;
