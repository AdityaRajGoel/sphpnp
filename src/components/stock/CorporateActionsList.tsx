import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { revealItem, revealSection } from "@/lib/motion";
import { toCell } from "@/lib/fundamentals";
import type { CorporateAction } from "@/hooks/useStockFundamentals";

/** Same two-decimal convention IncomeStatementTable uses for per-share money. */
const formatActionValue = (n: number): string => `₹${n.toFixed(2)}`;

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export default function CorporateActionsList({ actions }: { actions: CorporateAction[] }) {
  return (
    <motion.section {...revealSection} aria-labelledby="actions-heading">
      <h2 id="actions-heading" className="text-2xl font-bold mb-4">
        Corporate actions
      </h2>

      {actions.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          No dividends, splits or bonuses recorded for this company yet.
        </Card>
      ) : (
        <ul className="space-y-2">
          {actions.map((a, i) => {
            const value = toCell(a.value, formatActionValue);
            return (
            <motion.li key={`${a.ex_date}-${a.action_type}-${i}`} {...revealItem(i)}>
              <Card className="p-4 flex items-start justify-between gap-4 hover:bg-muted/30 transition-colors">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="capitalize">{a.action_type}</Badge>
                    {value.kind === "value" ? (
                      <span className="font-semibold tabular-nums">{value.text}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        Not available
                        <span className="sr-only"> — {value.reason}</span>
                      </span>
                    )}
                  </div>
                  {/* Raw announcement text is kept verbatim - the parser stores
                      the original because its own classification can be wrong. */}
                  <p className="text-sm text-muted-foreground break-words">{a.description}</p>
                </div>
                <div className="text-right text-sm whitespace-nowrap">
                  <div className="font-medium">{formatDate(a.ex_date)}</div>
                  <div className="text-xs text-muted-foreground">ex-date</div>
                </div>
              </Card>
            </motion.li>
            );
          })}
        </ul>
      )}
    </motion.section>
  );
}
