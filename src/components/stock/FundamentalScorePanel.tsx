import { motion } from "motion/react";
import { Check, Minus, ShieldCheck, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { revealSection } from "@/lib/motion";
import { formatNumber, formatPct, type FundamentalScores } from "@/lib/stock-analytics";

/**
 * Piotroski's F-Score and the balance-sheet quality ratios behind it.
 *
 * THE SCORE IS ALWAYS SHOWN AS "n of m TESTED". Not n of 9. One of Piotroski's
 * nine criteria - that no new equity was issued - cannot be tested from
 * anything collected here, because no share count is stored and financing cash
 * flow mixes equity with debt. Printing "6/9" would assert that this company
 * failed a test that was never run. The untestable criteria are listed with
 * their reason for the same reason.
 *
 * Two substitutions are made against the original definition (total debt where
 * it uses long-term debt; operating margin where it uses gross margin), both
 * because the line item is not collected. They are named in the criteria list
 * rather than hidden behind a familiar score name.
 */

const SOURCE_LABEL = "Computed";

const outcome = (passed: boolean | null) =>
  passed === null
    ? { icon: Minus, className: "text-muted-foreground", label: "not testable" }
    : passed
      ? { icon: Check, className: "text-secondary", label: "passed" }
      : { icon: X, className: "text-destructive", label: "failed" };

type Metric = { label: string; value: string; hint?: string };

export default function FundamentalScorePanel({ scores }: { scores: FundamentalScores | null }) {
  if (!scores) return null;

  const hasScore = scores.piotroski_score !== null && scores.piotroski_testable !== null;
  const metrics: Metric[] = [
    { label: "Free cash flow", value: scores.free_cash_flow === null ? "—" : `₹${scores.free_cash_flow.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` },
    { label: "FCF yield", value: scores.fcf_yield === null ? "—" : formatPct(scores.fcf_yield * 100), hint: "Free cash flow against market capitalisation." },
    { label: "Cash conversion", value: formatNumber(scores.cash_conversion), hint: "Operating cash flow per rupee of reported profit. Below 1 means profit is not arriving as cash." },
    { label: "Accruals ratio", value: formatNumber(scores.accruals_ratio, 3), hint: "(Profit − operating cash flow) / assets. High and positive is the earnings-quality warning." },
    { label: "Net debt", value: scores.net_debt === null ? "—" : `₹${scores.net_debt.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, hint: "Debt less cash. Negative means more cash than debt." },
    { label: "Net debt / equity", value: formatNumber(scores.net_debt_to_equity) },
    { label: "EV / sales", value: formatNumber(scores.ev_to_sales), hint: "Enterprise value over revenue. EV/EBITDA is not shown - depreciation is not collected, so EBITDA cannot be built honestly." },
    { label: "PEG", value: formatNumber(scores.peg), hint: "P/E over profit growth. Withheld when profit is flat or falling, where the ratio is meaningless." },
    { label: "Payout ratio", value: scores.payout_ratio === null ? "—" : formatPct(scores.payout_ratio * 100) },
    { label: "Capex intensity", value: scores.capex_intensity === null ? "—" : formatPct(scores.capex_intensity * 100), hint: "Capital spending as a share of revenue." },
    { label: "Revenue CAGR", value: formatPct(scores.revenue_cagr_3y) },
    { label: "Profit CAGR", value: formatPct(scores.profit_cagr_3y) },
  ];

  const shown = metrics.filter((metric) => metric.value !== "—");

  return (
    <motion.section {...revealSection} className="mt-8" aria-labelledby="quality-heading">
      <Card className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-secondary" />
            <div>
              <h2 id="quality-heading" className="font-heading text-xl font-bold">Financial quality</h2>
              <p className="text-xs text-muted-foreground">
                From {scores.basis} statements to {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(scores.period_end))}.
              </p>
            </div>
          </div>
          <Badge variant="outline">{SOURCE_LABEL}</Badge>
        </div>

        {hasScore && (
          <div className="mt-5 rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">Piotroski F-Score</h3>
              <p className="font-heading text-2xl font-bold tabular-nums">
                {scores.piotroski_score}
                <span className="text-base font-normal text-muted-foreground"> of {scores.piotroski_testable} tested</span>
              </p>
            </div>
            {scores.piotroski_criteria && (
              <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                {scores.piotroski_criteria.map((criterion) => {
                  const { icon: Icon, className, label } = outcome(criterion.passed);
                  return (
                    <li key={criterion.name} className="flex items-start gap-2 text-sm">
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${className}`} aria-hidden="true" />
                      <span className="min-w-0">
                        <span className={criterion.passed === null ? "text-muted-foreground" : ""}>{criterion.name}</span>
                        <span className="sr-only"> — {label}</span>
                        {criterion.unavailable && (
                          <span className="block text-xs text-muted-foreground">{criterion.unavailable}</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {shown.length > 0 && (
          <dl className="grid grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1 mt-5">
            {shown.map((metric) => (
              <div key={metric.label} className="flex items-baseline justify-between gap-3 py-1.5 border-b border-border/70">
                <dt className="text-sm text-muted-foreground" title={metric.hint}>{metric.label}</dt>
                <dd className="text-sm font-semibold tabular-nums">{metric.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <p className="mt-5 text-xs text-muted-foreground leading-relaxed">
          Computed from filed statements, not filed themselves. A dash means an input was absent, and the score
          counts only the criteria that could actually be tested.
        </p>
      </Card>
    </motion.section>
  );
}
