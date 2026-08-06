import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { revealItem, revealSection } from "@/lib/motion";
import {
  formatINR, formatRatio, toCell, type Basis, type IncomeRow,
} from "@/lib/fundamentals";

type Line = {
  label: string;
  pick: (r: IncomeRow) => number | null;
  format: (n: number) => string;
};

// Ratios sit in the same table because they arrive on the same XBRL row.
// ROE/ROCE/current ratio are deliberately absent - nothing ingests them yet,
// so a permanent "Not available" on every stock would be noise, not honesty.
const LINES: Line[] = [
  { label: "Revenue", pick: (r) => r.revenue, format: formatINR },
  { label: "Other income", pick: (r) => r.other_income, format: formatINR },
  { label: "Total income", pick: (r) => r.total_income, format: formatINR },
  { label: "Total expenses", pick: (r) => r.total_expenses, format: formatINR },
  { label: "Profit before tax", pick: (r) => r.profit_before_tax, format: formatINR },
  { label: "Profit after tax", pick: (r) => r.profit_after_tax, format: formatINR },
  { label: "Basic EPS", pick: (r) => r.basic_eps, format: (n) => `₹${n.toFixed(2)}` },
  { label: "Diluted EPS", pick: (r) => r.diluted_eps, format: (n) => `₹${n.toFixed(2)}` },
  { label: "Debt to equity", pick: (r) => r.debt_equity_ratio, format: formatRatio },
  {
    label: "Debt service coverage",
    pick: (r) => r.debt_service_coverage_ratio,
    format: formatRatio,
  },
];

const quarterLabel = (periodEnd: string): string => {
  const d = new Date(periodEnd);
  if (Number.isNaN(d.getTime())) return periodEnd;
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};

export default function IncomeStatementTable({
  rows, basis,
}: { rows: IncomeRow[]; basis: Basis }) {
  return (
    <motion.section {...revealSection} aria-labelledby="income-heading">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <h2 id="income-heading" className="text-2xl font-bold">
          Quarterly results
        </h2>
        <Badge variant="secondary">
          {basis === "consolidated" ? "Consolidated" : "Standalone"}
        </Badge>
      </div>

      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <caption className="sr-only">
            Quarterly income statement on a {basis} basis, most recent first
          </caption>
          <thead>
            <tr className="border-b">
              <th scope="col" className="text-left p-3 font-medium">Metric</th>
              {rows.map((r) => (
                <th
                  key={`${r.period_end}-${String(r.is_consolidated)}`}
                  scope="col"
                  className="text-right p-3 font-medium whitespace-nowrap"
                >
                  {quarterLabel(r.period_end)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LINES.map((line, i) => (
              <motion.tr
                key={line.label}
                {...revealItem(i)}
                className="border-b last:border-0 hover:bg-muted/30 transition-colors"
              >
                <th scope="row" className="text-left p-3 font-normal text-muted-foreground">
                  {line.label}
                </th>
                {rows.map((r) => {
                  const cell = toCell(line.pick(r), line.format);
                  return (
                    <td
                      key={`${line.label}-${r.period_end}`}
                      className="text-right p-3 tabular-nums whitespace-nowrap"
                    >
                      {cell.kind === "value" ? (
                        cell.text
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          Not available
                          <span className="sr-only"> — {cell.reason}</span>
                        </span>
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
