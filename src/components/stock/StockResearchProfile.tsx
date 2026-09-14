import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Sigma } from "lucide-react";
import { Card } from "@/components/ui/card";
import { revealSection } from "@/lib/motion";
import { useScreenerUniverse } from "@/hooks/useScreenerUniverse";
import { displayMetric, METRIC_BY_ID, metricTone, type MetricRow } from "@/lib/screener-metrics";
import { matchingScans, SCAN_GROUPS } from "@/lib/screener-scans";

const FACTORS: { id: string; label: string }[] = [
  { id: "value_score", label: "Value" },
  { id: "quality_score", label: "Quality" },
  { id: "momentum_score", label: "Momentum" },
  { id: "low_vol_score", label: "Low volatility" },
];

const DERIVED = ["earnings_yield", "graham_number", "graham_upside", "roe_to_pb", "momentum_12_1", "return_to_vol", "magic_formula_rank", "piotroski_score", "fcf_yield", "peg"];

function FactorBar({ label, row, id }: { label: string; row: MetricRow; id: string }) {
  const metric = METRIC_BY_ID.get(id)!;
  const value = metric.get(row);
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground" title={metric.title}>{label}</span>
        <span className="font-semibold tabular-nums">{value === null ? "—" : value.toFixed(0)}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden" aria-hidden="true">
        <div className="h-full rounded-full bg-foreground/70" style={{ width: `${value ?? 0}%` }} />
      </div>
    </div>
  );
}

/**
 * Where this stock sits among the tracked universe - factor percentiles, the
 * metrics derived from its own figures, and every screener scan it currently
 * appears in, each linking back to the screener with that scan applied.
 *
 * Percentiles are relative and move when other stocks move; the copy says so.
 * Renders nothing for a stock outside the screener universe.
 */
export default function StockResearchProfile({ symbol }: { symbol: string }) {
  const { data } = useScreenerUniverse();
  const row = data?.get(symbol.toUpperCase());
  const scans = useMemo(() => matchingScans(row), [row]);
  if (!row) return null;

  const composite = METRIC_BY_ID.get("composite_score")!;
  const derived = DERIVED.map((id) => METRIC_BY_ID.get(id)!).filter((m) => m.get(row) !== null);
  const hasFactors = FACTORS.some((f) => METRIC_BY_ID.get(f.id)!.get(row) !== null);
  if (!hasFactors && derived.length === 0 && scans.length === 0) return null;

  return (
    <motion.section {...revealSection} aria-labelledby="research-profile">
      <Card className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="research-profile" className="flex items-center gap-2 text-lg font-bold">
            <Sigma className="h-4 w-4 text-secondary" aria-hidden="true" /> Research profile
          </h2>
          {composite.get(row) !== null && (
            <span className="text-sm text-muted-foreground" title={composite.title}>
              Composite <span className="font-semibold text-foreground tabular-nums">{displayMetric(composite, row)}</span> / 100
            </span>
          )}
        </div>

        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {hasFactors && (
            <div className="space-y-3">
              <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Factor percentiles</h3>
              {FACTORS.map((f) => <FactorBar key={f.id} label={f.label} row={row} id={f.id} />)}
            </div>
          )}
          {derived.length > 0 && (
            <div>
              <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Derived metrics</h3>
              <dl className="mt-2 divide-y divide-border/70">
                {derived.map((m) => {
                  const tone = metricTone(m, m.get(row));
                  return (
                    <div key={m.id} className="flex items-baseline justify-between gap-3 py-1.5">
                      <dt className="text-sm text-muted-foreground" title={m.title}>{m.label}</dt>
                      <dd className={`text-sm font-semibold tabular-nums ${tone === "up" ? "text-secondary" : tone === "down" ? "text-destructive" : ""}`}>{displayMetric(m, row)}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          )}
        </div>

        {scans.length > 0 && (
          <div className="mt-5">
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Appears in {scans.length} scans</h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {scans.map((s) => (
                <li key={s.id}>
                  <Link
                    to={`/screener?scan=${s.id}`}
                    title={`${SCAN_GROUPS.find((g) => g.id === s.group)?.label}: ${s.desc}`}
                    className="inline-block rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:border-secondary/50 hover:text-secondary transition-colors"
                  >
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          Percentiles rank this stock against the other tracked stocks and change as they do. Scans describe where figures sit today.
          Hover a label for its definition. Not investment advice.
        </p>
      </Card>
    </motion.section>
  );
}
