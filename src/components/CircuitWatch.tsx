import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowUpToLine, ArrowDownToLine, Gauge } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { BhavcopyRow } from "@/hooks/useBhavcopy";

const TOP_N = 8;
// A stock that closed pinned to its day-high/low with a >=4.95% move very
// likely ended locked at its price band (5/10/20% circuits).
const BAND_THRESHOLD_PCT = 4.95;

type CircuitRow = { symbol: string; close: number; changePct: number };

function computeCircuits(rows: BhavcopyRow[]) {
  const upper: CircuitRow[] = [];
  const lower: CircuitRow[] = [];
  for (const r of rows) {
    if (r.close == null || r.prev_close == null || r.prev_close <= 0 || r.high == null || r.low == null) continue;
    const changePct = ((r.close - r.prev_close) / r.prev_close) * 100;
    if (changePct >= BAND_THRESHOLD_PCT && r.close === r.high) {
      upper.push({ symbol: r.symbol, close: r.close, changePct });
    } else if (changePct <= -BAND_THRESHOLD_PCT && r.close === r.low) {
      lower.push({ symbol: r.symbol, close: r.close, changePct });
    }
  }
  upper.sort((a, b) => b.changePct - a.changePct);
  lower.sort((a, b) => a.changePct - b.changePct);
  return { upper, lower };
}

interface CircuitWatchProps {
  rows: BhavcopyRow[];
  asOf: string | null;
  /** True while the bhavcopy is still in flight, so the slot can be held open. */
  loading?: boolean;
}

/**
 * EOD circuit watch: stocks that closed pinned at their upper/lower price band,
 * derived from the official bhavcopy (close == day extreme + >=4.95% move) -
 * the exchange-site "securities in price band" list, approximated honestly.
 */
const CircuitWatch = ({ rows, asOf, loading = false }: CircuitWatchProps) => {
  const [tab, setTab] = useState<"upper" | "lower">("upper");
  const { upper, lower } = useMemo(() => computeCircuits(rows), [rows]);
  const list = tab === "upper" ? upper : lower;

  const asOfLabel = asOf
    ? new Date(asOf).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : null;

  // While the bhavcopy is in flight, hold the slot open - popping this card in
  // afterwards shifted the whole page. Once we know there is genuinely no data,
  // collapse as before rather than showing an empty shell.
  if (loading) {
    return (
      <Card className="p-4 h-full" aria-busy="true">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-muted/60" />
          ))}
        </div>
      </Card>
    );
  }
  if (rows.length === 0) return null;

  return (
    <Card className="p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-heading font-bold flex items-center gap-2">
          <Gauge className="w-4 h-4 text-secondary" />
          Circuit Watch
        </h2>
        <span className="text-[10px] text-muted-foreground">{asOfLabel ? `EOD · ${asOfLabel}` : "EOD"}</span>
      </div>

      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setTab("upper")}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${tab === "upper" ? "bg-secondary text-secondary-foreground border-secondary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}
        >
          <ArrowUpToLine className="w-3 h-3" /> Upper ({upper.length})
        </button>
        <button
          onClick={() => setTab("lower")}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${tab === "lower" ? "bg-destructive text-destructive-foreground border-destructive" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}
        >
          <ArrowDownToLine className="w-3 h-3" /> Lower ({lower.length})
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
          {list.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No {tab} band hitters in the latest session.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              {list.slice(0, TOP_N).map((s, i) => (
                <div key={s.symbol} className="flex items-center gap-2 py-1.5 border-b border-border/30 last:border-0">
                  <span className="w-4 text-[10px] font-bold text-muted-foreground/60 tabular-nums shrink-0">{i + 1}</span>
                  <div className="min-w-0 flex-1 text-xs font-semibold text-foreground truncate">{s.symbol}</div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono text-foreground">₹{s.close.toLocaleString("en-IN")}</div>
                    <div className={`text-[10px] font-bold ${tab === "upper" ? "text-secondary" : "text-destructive"}`}>
                      {s.changePct >= 0 ? "+" : ""}{s.changePct.toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      <p className="text-[9px] text-muted-foreground mt-2.5 text-center">
        Heuristic from the official EOD bhavcopy: closed at the day extreme with a ≥5% move (likely price-band lock).
      </p>
    </Card>
  );
};

export default CircuitWatch;
