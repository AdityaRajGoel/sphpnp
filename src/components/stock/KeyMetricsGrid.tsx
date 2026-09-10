import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { revealItem, revealSection } from "@/lib/motion";
import { ABSENT, keyMetricCards, type FallbackStats, type KeyMetrics, type MovingAverage, type RoePoint, type StatementRow } from "@/lib/statements";

type Props = {
  keyMetrics: KeyMetrics;
  roe: RoePoint[];
  ratios: StatementRow[];
  movingAverages: MovingAverage[];
  price: number | null;
  /** Google Finance's figures, used only where IndianAPI reported nothing. */
  fallback?: FallbackStats;
};

const rupees = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/**
 * Headline ratios, then where the price sits against its moving averages.
 *
 * A metric the source did not report is left out, never estimated. Coverage is
 * uneven upstream - IndianAPI returned 109 metrics for HDFCBANK and none at all
 * for M&M - and a grid of dashes reads as a broken page rather than as "not
 * reported". ROE and ROCE come from the stored statements, so they survive a
 * missing metrics block.
 */
export default function KeyMetricsGrid({ keyMetrics, roe, ratios, movingAverages, price, fallback }: Props) {
  const cards = keyMetricCards(keyMetrics, roe, ratios, fallback).filter((card) => card.value !== ABSENT);
  const averages = movingAverages.filter((m) => m.nse !== null);
  if (cards.length === 0 && averages.length === 0) return null;

  return (
    <motion.section {...revealSection} aria-labelledby="key-metrics-heading">
      <h2 id="key-metrics-heading" className="text-2xl font-bold mb-4">Key metrics</h2>
      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((card, i) => (
          // One wrapper, styled as the Card primitive: <dl> allows a single
          // <div> between itself and its <dt>/<dd> pairs.
          <motion.div key={card.label} {...revealItem(i)} className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 h-full" title={card.hint}>
            <dt className="text-xs text-muted-foreground">{card.label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{card.value}</dd>
          </motion.div>
        ))}
      </dl>

      {averages.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-2">Moving averages (NSE)</h3>
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Simple moving averages of the NSE price, and where the last price sits against each</caption>
              <thead>
                <tr className="border-b">
                  {averages.map((m) => (
                    <th key={m.days} scope="col" className="text-right p-3 font-medium whitespace-nowrap">{m.days}-day</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {averages.map((m) => {
                    const above = price !== null && m.nse !== null ? price >= m.nse : null;
                    return (
                      <td key={m.days} className="text-right p-3 tabular-nums whitespace-nowrap">
                        {rupees(m.nse!)}
                        {above !== null && (
                          <span className={`block text-xs ${above ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                            {above ? "Price above" : "Price below"}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </motion.section>
  );
}
