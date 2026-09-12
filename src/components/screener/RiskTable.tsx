import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { ScreenerStock } from "@/hooks/useScreenerStocks";
import {
  RISK_COLUMNS,
  formatRisk,
  riskTone,
  sortByRisk,
  type RiskKey,
  type RiskSummary,
} from "@/lib/screener-risk";

type Props = {
  rows: ScreenerStock[];
  summaries: Map<string, RiskSummary>;
  /** Opens a stock's page; a click anywhere on its row except the name link. */
  onOpen?: (symbol: string) => void;
};

/**
 * The screener's risk view: volatility, beta, drawdown, trend and delivery per
 * stock, computed from each one's own daily bars.
 *
 * Sorting is the point of this view - "show me the least volatile names ahead
 * of the index" is a question the fundamentals table cannot answer. Columns
 * that describe rather than judge (volatility, beta, drawdown) carry no colour;
 * see riskTone for why.
 */
export default function RiskTable({ rows, summaries, onOpen }: Props) {
  const [sortKey, setSortKey] = useState<RiskKey | null>(null);
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(
    () => (sortKey ? sortByRisk(rows, summaries, sortKey, dir) : rows),
    [rows, summaries, sortKey, dir],
  );

  const toggle = (key: RiskKey) => {
    if (sortKey === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setDir("desc"); }
  };

  const covered = rows.filter((r) => summaries.has(r.symbol)).length;

  return (
    <div className="space-y-2">
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm">
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Stock</th>
              {RISK_COLUMNS.map((c) => (
                <th key={c.key} className="text-right px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">
                  <button
                    type="button"
                    title={c.title}
                    aria-label={`Sort by ${c.title}`}
                    onClick={() => toggle(c.key)}
                    className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${sortKey === c.key ? "text-foreground" : ""}`}
                  >
                    {c.label} <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
              ))}
              <th className="text-right px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">Trend</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => {
              const r = summaries.get(s.symbol);
              return (
                <tr
                  key={s.symbol}
                  onClick={(e) => { if (!(e.target as HTMLElement).closest("a, button")) onOpen?.(s.symbol); }}
                  title={`Open ${s.name}`}
                  className={`border-b border-border/50 hover:bg-muted/40 transition-colors ${onOpen ? "cursor-pointer" : ""}`}
                >
                  <td className="px-4 py-2.5">
                    <Link to={`/stock/${encodeURIComponent(s.symbol)}`} className="group inline-block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <div className="font-semibold text-foreground group-hover:text-primary transition-colors">{s.symbol}</div>
                      <div className="text-xs text-muted-foreground max-w-[180px] truncate">{s.name}</div>
                    </Link>
                  </td>
                  {RISK_COLUMNS.map((c) => {
                    const value = r ? r[c.key] : null;
                    const tone = riskTone(c.key, value);
                    return (
                      <td
                        key={c.key}
                        className={`px-3 py-2.5 text-right font-mono tabular-nums ${tone === "up" ? "text-secondary" : tone === "down" ? "text-destructive" : value === null ? "text-muted-foreground" : "text-foreground"}`}
                      >
                        {formatRisk(value, c.kind)}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-right text-xs whitespace-nowrap">
                    {r?.ma_trend === "golden" ? (
                      <span className="text-secondary">50 &gt; 200</span>
                    ) : r?.ma_trend === "death" ? (
                      <span className="text-destructive">50 &lt; 200</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-muted-foreground">
        Risk measures for {covered} of {rows.length} stocks shown, computed daily from each stock's own closing
        prices and adjusted for splits and bonuses. Volatility, beta and drawdown are descriptions of past
        behaviour, not judgements — a dash means there was not enough history to compute the figure, never zero.
        Not investment advice.
      </p>
    </div>
  );
}
