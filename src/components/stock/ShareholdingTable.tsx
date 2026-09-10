import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { revealSection } from "@/lib/motion";
import { latestHolding, type HolderSeries } from "@/lib/statements";

const quarter = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });

/** Last four quarterly filings per holder category, with the latest change. */
export default function ShareholdingTable({ shareholding }: { shareholding: HolderSeries[] }) {
  if (shareholding.length === 0) return null;
  const dates = [...new Set(shareholding.flatMap((s) => s.points.map((p) => p.date)))].sort().slice(-4);

  return (
    <motion.section {...revealSection} aria-labelledby="shareholding-heading">
      <h2 id="shareholding-heading" className="text-2xl font-bold mb-4">Shareholding pattern</h2>
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm min-w-[520px]">
          <caption className="sr-only">Percentage of shares held by each category at each quarter end</caption>
          <thead>
            <tr className="border-b">
              <th scope="col" className="text-left p-3 font-medium">Holder</th>
              {dates.map((d) => (
                <th key={d} scope="col" className="text-right p-3 font-medium whitespace-nowrap">{quarter(d)}</th>
              ))}
              <th scope="col" className="text-right p-3 font-medium whitespace-nowrap">Change</th>
            </tr>
          </thead>
          <tbody>
            {shareholding.map((series) => {
              const latest = latestHolding(series);
              const byDate = new Map(series.points.map((p) => [p.date, p.pct]));
              return (
                <tr key={series.category} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <th scope="row" className="text-left p-3 font-normal text-muted-foreground">{series.category}</th>
                  {dates.map((d) => (
                    <td key={d} className="text-right p-3 tabular-nums">
                      {byDate.has(d) ? `${byDate.get(d)!.toFixed(2)}%` : <span className="text-muted-foreground">—</span>}
                    </td>
                  ))}
                  <td className={`text-right p-3 tabular-nums ${latest?.change ? (latest.change > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive") : "text-muted-foreground"}`}>
                    {latest?.change === null || latest?.change === undefined
                      ? "—"
                      : `${latest.change > 0 ? "+" : ""}${latest.change.toFixed(2)} pp`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </motion.section>
  );
}
