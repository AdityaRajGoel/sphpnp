import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { revealItem, revealSection } from "@/lib/motion";
import { formatINR, formatRatio, toCell } from "@/lib/fundamentals";
import type { DerivedRow } from "@/hooks/useStockFundamentals";

/**
 * ROE, ROCE, current ratio and free cash flow.
 *
 * IncomeStatementTable deliberately leaves these out: they are not on the XBRL
 * row, nothing populated them, and a permanent "Not available" against every
 * stock is noise rather than honesty. The Yahoo sync now writes
 * fundamentals_derived, so they have somewhere to come from and belong on the
 * page.
 *
 * They also arrive with the reason attached, which is the point of this
 * component rather than a fifth block of rows in the income table. computeRatios
 * withholds a ratio whenever an input is absent OR a denominator is present but
 * zero/negative, and it records those two cases in separate columns. "We never
 * received the equity figure" and "the equity figure is negative, so return on
 * it is undefined" are different statements about the same blank cell, and a
 * reader deciding whether to trust the gap needs to be told which one it is.
 */

/**
 * Ratios are computed here, not filed. The badge says so, because a reader who
 * assumes these came off the filing would over-trust them.
 */
const SOURCE_LABEL = "Computed";

type Metric = {
  label: string;
  pick: (r: DerivedRow) => number | null;
  format: (n: number) => string;
  /**
   * RatioInput field names this metric consumes. Any of them appearing in
   * missing_inputs explains this metric's blank cell; the other rows' inputs
   * do not, which is why the mapping is per-metric rather than "was anything
   * missing on this row".
   */
  inputs: readonly string[];
  /**
   * The unusable_inputs entries computeRatios records for THIS metric's
   * denominator. ROCE's is the summed capital-employed name, not either half.
   */
  unusable: readonly string[];
};

const formatPercent = (n: number): string => `${n.toFixed(2)}%`;

const METRICS: readonly Metric[] = [
  {
    label: "Return on equity",
    pick: (r) => r.roe,
    format: formatPercent,
    inputs: ["profitAfterTax", "totalEquity"],
    unusable: ["totalEquity"],
  },
  {
    label: "Return on capital employed",
    pick: (r) => r.roce,
    format: formatPercent,
    inputs: ["profitBeforeTax", "totalEquity", "totalDebt"],
    unusable: ["totalEquity+totalDebt"],
  },
  {
    label: "Current ratio",
    pick: (r) => r.current_ratio,
    format: formatRatio,
    inputs: ["currentAssets", "currentLiabilities"],
    unusable: ["currentLiabilities"],
  },
  {
    label: "Free cash flow",
    pick: (r) => r.free_cash_flow,
    format: formatINR,
    // A subtraction, not a division - there is no denominator to be unusable.
    inputs: ["operatingCf", "capex"],
    unusable: [],
  },
];

// Duplicated from IncomeStatementTable rather than shared: it is five lines,
// and the two tables label the same kind of column, so they must not drift.
const quarterLabel = (periodEnd: string): string => {
  const d = new Date(periodEnd);
  if (Number.isNaN(d.getTime())) return periodEnd;
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};

type Withheld = { text: string; reason: string };

/**
 * Why this cell is blank, in the row's own words.
 *
 * missing_inputs is checked first: if an input never arrived we cannot know
 * whether the ratio would have been meaningful, so "not reported" is the
 * weaker and therefore the honest claim. Only when everything arrived is
 * "not meaningful" - a denominator we actually hold and cannot divide by -
 * the right thing to say.
 */
function withheldFor(metric: Metric, row: DerivedRow, fallback: string): Withheld {
  const missing = metric.inputs.filter((n) => row.missing_inputs.includes(n));
  if (missing.length > 0) {
    return {
      text: "Not reported",
      reason: `${missing.join(", ")} was not in the source data`,
    };
  }
  const unusable = metric.unusable.filter((n) => row.unusable_inputs.includes(n));
  if (unusable.length > 0) {
    return {
      text: "Not meaningful",
      reason: `${unusable.join(", ")} is zero or negative, so this ratio is undefined`,
    };
  }
  return { text: "Not available", reason: fallback };
}

/** Same treatment IncomeStatementTable gives a gap: stated, with the reason
 *  reachable by a screen reader rather than dropped. */
const WithheldCell = ({ text, reason }: Withheld) => (
  <span className="text-muted-foreground text-xs">
    {text}
    <span className="sr-only"> — {reason}</span>
  </span>
);

export default function RatiosPanel({ derived }: { derived: DerivedRow[] }) {
  // A stock the Yahoo sync has not reached yet has no reasons to show either,
  // so the table would be four rows of withheld cells explaining nothing.
  if (derived.length === 0) return null;

  return (
    <motion.section {...revealSection} aria-labelledby="ratios-heading">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <h2 id="ratios-heading" className="text-2xl font-bold">
          Key ratios
        </h2>
        <Badge variant="secondary">{SOURCE_LABEL}</Badge>
      </div>

      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <caption className="sr-only">
            Ratios computed from reported balance sheet and cash flow figures,
            most recent first
          </caption>
          <thead>
            <tr className="border-b">
              <th scope="col" className="text-left p-3 font-medium">Metric</th>
              {derived.map((r) => (
                <th
                  key={r.period_end}
                  scope="col"
                  className="text-right p-3 font-medium whitespace-nowrap"
                >
                  {quarterLabel(r.period_end)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((metric, i) => (
              <motion.tr
                key={metric.label}
                {...revealItem(i)}
                className="border-b last:border-0 hover:bg-muted/30 transition-colors"
              >
                <th scope="row" className="text-left p-3 font-normal text-muted-foreground">
                  {metric.label}
                </th>
                {derived.map((r) => {
                  const cell = toCell(metric.pick(r), metric.format);
                  return (
                    <td
                      key={`${metric.label}-${r.period_end}`}
                      className="text-right p-3 tabular-nums whitespace-nowrap"
                    >
                      {cell.kind === "value" ? (
                        cell.text
                      ) : (
                        <WithheldCell {...withheldFor(metric, r, cell.reason)} />
                      )}
                    </td>
                  );
                })}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </Card>
    </motion.section>
  );
}
