import { useLayoutEffect, useRef } from "react";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { revealSection } from "@/lib/motion";
import { statementSourceLabel,
  ABSENT, formatStatementValue, statementTabs, visibleColumns, type StatementGrid, type StatementKind,
} from "@/lib/statements";


/** Twelve columns keeps three years of quarters or a decade of years on screen. */
const MAX_COLUMNS = 12;

/** Rows that are subtotals read in bold, the way a printed statement sets them. */
const EMPHASISED = /^(Sales|Revenue|Operating Profit|Financing Profit|Net Profit|Total Liabilities|Total Assets|Net Cash Flow|Free Cash Flow)$/;

function StatementTable({ grid, caption }: { grid: StatementGrid; caption: string }) {
  const columns = visibleColumns(grid, MAX_COLUMNS);
  const scroller = useRef<HTMLDivElement>(null);
  // Newest periods sit on the right, and when the grid is wider than the
  // screen they were the columns cut off - the latest quarter is the one a
  // reader came for. Open scrolled to the right edge; the older periods are a
  // scroll to the left. Layout effect so the first paint is already there.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [grid]);
  return (
    <Card className="p-0 overflow-hidden">
      <div ref={scroller} className="overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <caption className="sr-only">{caption}, oldest period first, figures in rupees crore</caption>
        <thead>
          <tr className="border-b">
            <th scope="col" className="sticky left-0 bg-card text-left p-3 font-medium">
              <span className="sr-only">Line item</span>
            </th>
            {columns.map((i) => (
              <th key={grid.periods[i]} scope="col" className="text-right p-3 font-medium whitespace-nowrap">
                {grid.periods[i]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row) => {
            const strong = EMPHASISED.test(row.label);
            return (
              <tr key={row.label} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <th
                  scope="row"
                  className={`sticky left-0 bg-card text-left p-3 whitespace-nowrap ${strong ? "font-semibold" : "font-normal text-muted-foreground"}`}
                >
                  {row.label}
                </th>
                {columns.map((i) => {
                  const value = row.values[i];
                  const text = formatStatementValue(row.label, value);
                  return (
                    <td
                      key={`${row.label}-${grid.periods[i]}`}
                      className={`text-right p-3 tabular-nums whitespace-nowrap ${strong ? "font-semibold" : ""} ${value !== null && value < 0 ? "text-destructive" : ""}`}
                    >
                      {text === ABSENT ? <span className="text-muted-foreground" aria-label="Not reported">{ABSENT}</span> : text}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </Card>
  );
}

const asOf = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * The company's statements as Screener.in lays them out - one tab per
 * statement, most recent columns on the right. Renders nothing until the sync
 * has stored at least one statement for the symbol.
 */
export default function StatementsSection({ statements }: { statements: Partial<Record<StatementKind, StatementGrid>> }) {
  const { source, tabs: available } = statementTabs(statements);
  if (available.length === 0) return null;
  const fetchedAt = available.map((tab) => statements[tab.kind]!.fetched_at).sort().reverse()[0];

  return (
    <motion.section {...revealSection} aria-labelledby="statements-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
        <h2 id="statements-heading" className="text-2xl font-bold">Financial statements</h2>
        <Badge variant="secondary">₹ Crore</Badge>
      </div>
      <Tabs defaultValue={available[0].kind}>
        <TabsList className="mb-3 h-auto flex-wrap justify-start">
          {available.map((tab) => (
            <TabsTrigger key={tab.kind} value={tab.kind}>{tab.label}</TabsTrigger>
          ))}
        </TabsList>
        {available.map((tab) => (
          <TabsContent key={tab.kind} value={tab.kind}>
            <StatementTable grid={statements[tab.kind]!} caption={tab.caption} />
          </TabsContent>
        ))}
      </Tabs>
      <p className="text-xs text-muted-foreground mt-3">
        From {statementSourceLabel(statements)}, updated {asOf(fetchedAt)}.
        {source === "indianapi" ? " Consolidated figures where the company reports them." : " Rupee amounts converted to crore."}
        Information only, not investment advice.
      </p>
    </motion.section>
  );
}
