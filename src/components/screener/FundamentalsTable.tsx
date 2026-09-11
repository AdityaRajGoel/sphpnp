import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { ScreenerStock } from "@/hooks/useScreenerStocks";
import {
  FUNDAMENTAL_COLUMNS,
  SOURCE_LABEL,
  formatFundamental,
  sortByFundamental,
  toneOf,
  type FundamentalsKey,
  type FundamentalsSummary,
} from "@/lib/screener-fundamentals";

type Props = {
  rows: ScreenerStock[];
  summaries: Map<string, FundamentalsSummary>;
};

const quarterLabel = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }) : "—";

/** The screener's fundamentals view: returns, margins, growth, leverage and valuation per stock. */
export default function FundamentalsTable({ rows, summaries }: Props) {
  const [sortKey, setSortKey] = useState<FundamentalsKey | null>(null);
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(
    () => (sortKey ? sortByFundamental(rows, summaries, sortKey, dir) : rows),
    [rows, summaries, sortKey, dir],
  );

  const toggle = (key: FundamentalsKey) => {
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
              <th className="text-right px-3 py-3 font-medium text-muted-foreground">P/E</th>
              {FUNDAMENTAL_COLUMNS.map((c) => (
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
              <th className="text-right px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">Latest qtr</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Source</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => {
              const f = summaries.get(s.symbol);
              return (
                <tr key={s.symbol} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5">
                    <Link to={`/stock/${encodeURIComponent(s.symbol)}`} className="group inline-block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <div className="font-semibold text-foreground group-hover:text-primary transition-colors">{s.symbol}</div>
                      <div className="text-xs text-muted-foreground max-w-[180px] truncate">{s.name}</div>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{s.pe > 0 ? s.pe.toFixed(1) : "—"}</td>
                  {FUNDAMENTAL_COLUMNS.map((c) => {
                    const value = f ? f[c.key] : null;
                    const tone = toneOf(c.key, value);
                    return (
                      <td
                        key={c.key}
                        className={`px-3 py-2.5 text-right font-mono tabular-nums ${tone === "up" ? "text-secondary" : tone === "down" ? "text-destructive" : value === null ? "text-muted-foreground" : "text-foreground"}`}
                      >
                        {formatFundamental(value, c.kind)}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-right text-xs text-muted-foreground whitespace-nowrap">{quarterLabel(f?.latest_quarter ?? null)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {f ? (
                      <span className="text-[10px] font-semibold uppercase tracking-wide rounded-full border border-border px-2 py-0.5 text-muted-foreground whitespace-nowrap">
                        {SOURCE_LABEL[f.source]}
                      </span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-muted-foreground">
        Fundamentals for {covered} of {rows.length} stocks shown. ROE, ROCE and D/E are from the latest fiscal year;
        OPM and YoY growth compare the latest reported quarter with the same quarter a year earlier. Built daily from
        company filings via screener.in, IndianAPI and Google Finance; a dash means the source does not
        report that figure. Not investment advice.
      </p>
    </div>
  );
}
