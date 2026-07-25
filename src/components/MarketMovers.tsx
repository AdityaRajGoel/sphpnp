import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { TrendingUp, TrendingDown, Activity, ArrowUpToLine, ArrowDownToLine, LineChart, IndianRupee } from "lucide-react";
import { Card } from "@/components/ui/card";

export type MoverStock = {
  symbol: string;
  name: string;
  price: number;
  change_pct: number;
  volume: number;
  high_52: number;
  low_52: number;
};

type TabId = "gainers" | "losers" | "active" | "turnover" | "high" | "low";

const TABS: { id: TabId; label: string; icon: typeof TrendingUp; tone: string }[] = [
  { id: "gainers", label: "Top Gainers", icon: TrendingUp, tone: "text-secondary" },
  { id: "losers", label: "Top Losers", icon: TrendingDown, tone: "text-destructive" },
  { id: "active", label: "Most Active (Vol)", icon: Activity, tone: "text-brand-orange" },
  { id: "turnover", label: "Most Active (Value)", icon: IndianRupee, tone: "text-brand-gold" },
  { id: "high", label: "Near 52W High", icon: ArrowUpToLine, tone: "text-secondary" },
  { id: "low", label: "Near 52W Low", icon: ArrowDownToLine, tone: "text-destructive" },
];

const TOP_N = 8;
const fmtPrice = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtVol = (n: number) => (n >= 1e7 ? `${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `${(n / 1e5).toFixed(1)} L` : n.toLocaleString("en-IN"));

interface MarketMoversProps {
  stocks: MoverStock[];
  /** Add a symbol to the chart comparison (wired to the screener's Chart view). */
  onPick?: (symbol: string) => void;
}

/**
 * Exchange-homepage-style movers board: ranked Top Gainers / Losers / Most
 * Active / near-52W-high / near-52W-low lists derived from the live screener
 * universe. Each row can be sent straight to the chart comparison.
 */
const MarketMovers = ({ stocks, onPick }: MarketMoversProps) => {
  const [tab, setTab] = useState<TabId>("gainers");

  const rows = useMemo(() => {
    const withPrice = stocks.filter((s) => s.price > 0);
    switch (tab) {
      case "gainers":
        return [...withPrice].sort((a, b) => b.change_pct - a.change_pct).slice(0, TOP_N);
      case "losers":
        return [...withPrice].sort((a, b) => a.change_pct - b.change_pct).slice(0, TOP_N);
      case "active":
        return [...withPrice].filter((s) => s.volume > 0).sort((a, b) => b.volume - a.volume).slice(0, TOP_N);
      case "turnover":
        return [...withPrice]
          .filter((s) => s.volume > 0)
          .sort((a, b) => b.price * b.volume - a.price * a.volume)
          .slice(0, TOP_N);
      case "high":
        return [...withPrice]
          .filter((s) => s.high_52 > 0)
          .sort((a, b) => b.price / b.high_52 - a.price / a.high_52)
          .slice(0, TOP_N);
      case "low":
        return [...withPrice]
          .filter((s) => s.low_52 > 0)
          .sort((a, b) => a.price / a.low_52 - b.price / b.low_52)
          .slice(0, TOP_N);
      default:
        return [];
    }
  }, [stocks, tab]);

  // The metric shown on the right of each row depends on the active tab.
  const metric = (s: MoverStock) => {
    if (tab === "active") return { text: fmtVol(s.volume), cls: "text-brand-orange", sub: "Volume" };
    if (tab === "turnover") return { text: `₹${((s.price * s.volume) / 1e7).toFixed(0)} Cr`, cls: "text-brand-gold", sub: "Turnover" };
    if (tab === "high") {
      const pct = s.high_52 > 0 ? ((s.price - s.high_52) / s.high_52) * 100 : 0;
      return { text: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`, cls: "text-secondary", sub: "from 52W high" };
    }
    if (tab === "low") {
      const pct = s.low_52 > 0 ? ((s.price - s.low_52) / s.low_52) * 100 : 0;
      return { text: `+${pct.toFixed(1)}%`, cls: "text-destructive", sub: "above 52W low" };
    }
    const up = s.change_pct >= 0;
    return { text: `${up ? "+" : ""}${s.change_pct.toFixed(2)}%`, cls: up ? "text-secondary" : "text-destructive", sub: "today" };
  };

  return (
    <Card className="p-4 mb-8">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-xl font-heading font-bold flex items-center gap-2">
          <Activity className="w-5 h-5 text-brand-orange" />
          Market Movers
        </h2>
        <span className="text-[11px] text-muted-foreground">Live · NSE universe</span>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mb-1 mb-3">
        {TABS.map((tb) => {
          const Icon = tb.icon;
          const active = tab === tb.id;
          return (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${active ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40"}`}
            >
              <Icon className={`w-3.5 h-3.5 ${active ? "" : tb.tone}`} />
              {tb.label}
            </button>
          );
        })}
      </div>

      {/* Ranked list */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="grid sm:grid-cols-2 gap-x-6 gap-y-0.5"
        >
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center col-span-full">No data available yet.</p>
          ) : (
            rows.map((s, i) => {
              const m = metric(s);
              return (
                <div
                  key={s.symbol}
                  className="group flex items-center gap-3 py-2 border-b border-border/30 last:border-0"
                >
                  <span className="w-5 text-xs font-bold text-muted-foreground/60 tabular-nums shrink-0">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-foreground truncate">{s.symbol}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{s.name}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-mono font-medium text-foreground">{fmtPrice(s.price)}</div>
                    <div className={`text-[11px] font-semibold ${m.cls}`}>
                      {m.text} <span className="text-muted-foreground font-normal">{m.sub}</span>
                    </div>
                  </div>
                  {onPick && (
                    <button
                      onClick={() => onPick(s.symbol)}
                      title={`Add ${s.symbol} to chart`}
                      aria-label={`Add ${s.symbol} to chart comparison`}
                      className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground opacity-60 hover:opacity-100 hover:text-primary hover:bg-primary/10 transition-[opacity,color,background-color,border-color]"
                    >
                      <LineChart className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </motion.div>
      </AnimatePresence>
    </Card>
  );
};

export default MarketMovers;
