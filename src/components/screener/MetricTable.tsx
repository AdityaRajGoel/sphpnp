import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { ScreenerStock } from "@/hooks/useScreenerStocks";
import { displayMetric, metricTone, sortByMetric, type Metric, type MetricRow } from "@/lib/screener-metrics";

type Props = {
  rows: ScreenerStock[];
  metricRows: Map<string, MetricRow>;
  columns: Metric[];
  /** The footnote: what the columns are computed from and what a dash means. */
  note: string;
  onOpen?: (symbol: string) => void;
};

/**
 * Any set of registry metrics as a sortable table - the screener's technicals,
 * scores and custom views. Missing figures sort last in both directions and
 * render as a dash, never zero.
 */
export default function MetricTable({ rows, metricRows, columns, note, onOpen }: Props) {
  const [sortId, setSortId] = useState<string | null>(null);
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const sortMetric = columns.find((c) => c.id === sortId) ?? null;

  const sorted = useMemo(
    () => (sortMetric ? sortByMetric(rows, metricRows, sortMetric, dir) : rows),
    [rows, metricRows, sortMetric, dir],
  );

  const toggle = (id: string) => {
    if (sortId === id) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortId(id); setDir("desc"); }
  };

  const covered = rows.filter((r) => columns.some((c) => { const row = metricRows.get(r.symbol); return row ? c.get(row) !== null : false; })).length;

  return (
    <div className="space-y-2">
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm">
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Stock</th>
              {columns.map((c) => (
                <th key={c.id} scope="col" aria-sort={sortId === c.id ? (dir === "asc" ? "ascending" : "descending") : undefined} className="text-right px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">
                  <button
                    type="button"
                    title={c.title}
                    aria-label={`Sort by ${c.title}`}
                    onClick={() => toggle(c.id)}
                    className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${sortId === c.id ? "text-foreground" : ""}`}
                  >
                    {c.label} <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => {
              const row = metricRows.get(s.symbol);
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
                  {columns.map((c) => {
                    const value = row ? c.get(row) : null;
                    const tone = metricTone(c, value);
                    return (
                      <td
                        key={c.id}
                        className={`px-3 py-2.5 text-right font-mono tabular-nums ${tone === "up" ? "text-secondary" : tone === "down" ? "text-destructive" : value === null ? "text-muted-foreground" : "text-foreground"}`}
                      >
                        {displayMetric(c, row)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-muted-foreground">
        Figures for {covered} of {rows.length} stocks shown. {note} A dash means the figure could not be computed, never zero. Not investment advice.
      </p>
    </div>
  );
}
