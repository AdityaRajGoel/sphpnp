import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useScreenerUniverse } from "@/hooks/useScreenerUniverse";
import { displayMetric, METRIC_BY_ID, METRIC_GROUP_LABEL, type Metric, type MetricGroup } from "@/lib/screener-metrics";
import { matchingScans } from "@/lib/screener-scans";

/** The rows compared, grouped. Direction for "best" comes from each metric's lowerIsBetter. */
const SECTIONS: { group: MetricGroup; ids: string[] }[] = [
  { group: "factors", ids: ["composite_score", "value_score", "quality_score", "momentum_score", "low_vol_score", "magic_formula_rank"] },
  { group: "valuation", ids: ["pe", "earnings_yield", "pb", "peg", "ev_to_sales", "fcf_yield", "dividend_yield", "graham_upside"] },
  { group: "profitability", ids: ["roe", "roce", "opm", "piotroski_score"] },
  { group: "growth", ids: ["sales_growth_yoy", "profit_growth_yoy", "revenue_cagr_3y", "profit_cagr_3y"] },
  { group: "balance_sheet", ids: ["debt_to_equity", "net_debt_to_equity", "cash_conversion"] },
  { group: "price", ids: ["return_1m", "return_6m", "return_1y", "momentum_12_1", "relative_strength_3m"] },
  { group: "trend", ids: ["distance_from_200", "adx", "macd_histogram"] },
  { group: "oscillators", ids: ["rsi_14", "stochastic_k", "money_flow_index"] },
  { group: "risk", ids: ["volatility_1y", "beta_1y", "max_drawdown_1y", "return_to_vol"] },
  { group: "volume", ids: ["delivery_recent", "delivery_change", "volume_zscore"] },
];

/** Metrics where "best" is a matter of taste, not direction - shown, never crowned. */
const NO_WINNER = new Set(["rsi_14", "stochastic_k", "money_flow_index", "adx", "beta_1y", "volume_zscore", "delivery_change", "macd_histogram"]);

const COLORS = ["bg-brand-orange", "bg-secondary", "bg-blue-500"];

/**
 * Every registry metric for the chosen stocks, side by side, grouped like a
 * research note. The leading figure per row is marked where the direction is
 * conventional; nothing here totals the marks into a verdict.
 */
export default function CompareResearchTable({ symbols }: { symbols: string[] }) {
  const { data, isLoading } = useScreenerUniverse();
  const rows = useMemo(() => symbols.map((s) => data?.get(s)), [symbols, data]);

  if (symbols.length === 0) return null;
  if (isLoading) return <Skeleton className="mt-8 h-96 w-full" />;
  if (rows.every((r) => !r)) return null;

  const best = (metric: Metric): number | null => {
    if (NO_WINNER.has(metric.id)) return null;
    const values = rows.map((r) => (r ? metric.get(r) : null));
    const known = values.filter((v): v is number => v !== null);
    if (known.length < 2) return null;
    const target = metric.lowerIsBetter ? Math.min(...known) : Math.max(...known);
    return values.filter((v) => v === target).length === 1 ? values.indexOf(target) : null;
  };

  return (
    <section aria-labelledby="compare-research" className="mt-10">
      <h2 id="compare-research" className="text-2xl font-heading font-bold">Research comparison</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">Valuation, quality, growth, balance sheet, momentum, trend and risk from filings and each stock's own bars. The leading figure in a row is marked; hover a metric for its definition.</p>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground min-w-[160px]">Metric</th>
              {symbols.map((s, i) => (
                <th key={s} scope="col" className="px-4 py-3 text-center font-semibold min-w-[130px]">
                  <span className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-full ${COLORS[i]}`} aria-hidden="true" />
                  <Link to={`/stock/${encodeURIComponent(s)}`} className="hover:text-primary">{s}</Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SECTIONS.map(({ group, ids }) => {
              const metrics = ids.map((id) => METRIC_BY_ID.get(id)).filter((m): m is Metric => !!m && rows.some((r) => r && m.get(r) !== null));
              if (metrics.length === 0) return null;
              return [
                <tr key={`g-${group}`} className="border-t bg-muted/20">
                  <th colSpan={symbols.length + 1} scope="rowgroup" className="px-4 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{METRIC_GROUP_LABEL[group]}</th>
                </tr>,
                ...metrics.map((m) => {
                  const lead = best(m);
                  return (
                    <tr key={m.id} className="border-t hover:bg-muted/20">
                      <th scope="row" className="px-4 py-2 text-left font-normal text-muted-foreground" title={m.title}>{m.label}</th>
                      {rows.map((r, i) => (
                        <td key={symbols[i]} className={`px-4 py-2 text-center tabular-nums ${lead === i ? "font-semibold text-secondary" : ""}`}>
                          {displayMetric(m, r)}
                          {lead === i && <span className="sr-only"> (leads this row)</span>}
                        </td>
                      ))}
                    </tr>
                  );
                }),
              ];
            })}
            <tr className="border-t bg-muted/20">
              <th colSpan={symbols.length + 1} scope="rowgroup" className="px-4 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Scans matched</th>
            </tr>
            <tr className="border-t align-top">
              <th scope="row" className="px-4 py-2 text-left font-normal text-muted-foreground">Screener scans</th>
              {rows.map((r, i) => (
                <td key={symbols[i]} className="px-4 py-2">
                  <div className="flex flex-wrap justify-center gap-1">
                    {matchingScans(r).slice(0, 10).map((s) => (
                      <Link key={s.id} to={`/screener?scan=${s.id}`} className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:border-secondary/50 hover:text-secondary">{s.name}</Link>
                    ))}
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-xs text-muted-foreground">Factor scores are percentiles among the tracked stocks. A dash means the figure could not be computed. Not investment advice.</p>
    </section>
  );
}
