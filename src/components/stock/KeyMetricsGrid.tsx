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
  /** screener.in's then Google Finance's figures, used only where IndianAPI reported nothing (see fallbackStats). */
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
          <motion.div key={card.label} {...revealItem(i)} className="rounded-surface border bg-card text-card-foreground shadow-sm p-4 h-full" title={card.hint}>
            <dt className="text-xs text-muted-foreground">{card.label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{card.value}</dd>
          </motion.div>
        ))}
      </dl>

      {averages.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-2">Moving averages (NSE)</h3>
          {/* Three figures, not a table: a one-row table stretched them a page-width apart. */}
          <dl className="grid grid-cols-3 gap-3 sm:max-w-xl">
            {averages.map((m) => {
              const above = price !== null && m.nse !== null ? price >= m.nse : null;
              return (
                <div key={m.days} className="rounded-surface border bg-card text-card-foreground shadow-sm p-3 sm:p-4">
                  <dt className="text-xs text-muted-foreground">{m.days}-day</dt>
                  <dd className="mt-1 font-semibold tabular-nums">{rupees(m.nse!)}</dd>
                  {above !== null && <dd className="text-xs text-muted-foreground">Price {above ? "above" : "below"}</dd>}
                </div>
              );
            })}
          </dl>
        </div>
      )}
    </motion.section>
  );
}
