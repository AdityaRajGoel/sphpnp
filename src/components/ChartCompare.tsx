import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion } from "motion/react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Plus, LineChart, Loader2, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { sma, rsi, rsiZone, rebase, periodReturnPct } from "@/lib/technicals";

type ChartPoint = { t: number; c: number };
type Series = { symbol: string; points: ChartPoint[] };

export type CompareStock = { symbol: string; name: string };

// One distinct brand-aligned colour per overlaid stock (max 4).
const LINE_COLORS = [
  "hsl(var(--brand-orange))",
  "hsl(var(--secondary))",
  "#3b82f6",
  "hsl(var(--brand-gold))",
];

const TIMEFRAMES: { id: string; label: string; range: string }[] = [
  { id: "1M", label: "1M", range: "1mo" },
  { id: "3M", label: "3M", range: "3mo" },
  { id: "6M", label: "6M", range: "6mo" },
  { id: "1Y", label: "1Y", range: "1y" },
];

const MAX_STOCKS = 4;
const W = 760;
const H = 300;
const PAD = 8;

async function fetchSeries(symbol: string, range: string): Promise<ChartPoint[]> {
  const { data, error } = await supabase.functions.invoke("fetch-stock-chart", {
    body: { symbol, range },
  });
  if (error || !data?.success || !Array.isArray(data.dataPoints)) return [];
  return data.dataPoints
    .filter((p: { c?: number; t?: number }) => p.c != null && p.t != null)
    .map((p: { t: number; c: number }) => ({ t: p.t, c: p.c }));
}

interface ChartCompareProps {
  /** Full universe used to power the stock search box. */
  stocks: CompareStock[];
  /** Selected symbols (controlled by the parent). */
  selected: string[];
  /** Called with the next selection when the user adds/removes a stock. */
  onChange: (next: string[]) => void;
}

/**
 * Overlaid, rebased-to-100 multi-stock performance chart with technical
 * indicators. Rebasing lets stocks at very different price levels be compared
 * by percentage move on one axis. With a single stock selected it also overlays
 * the 20/50-day SMA and reports RSI(14). Selection is controlled by the parent.
 */
const ChartCompare = ({ stocks, selected, onChange }: ChartCompareProps) => {
  const [timeframe, setTimeframe] = useState("6M");
  const [showSMA, setShowSMA] = useState(true);
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Cache fetched series by `${symbol}:${range}` so switching timeframe/stocks
  // never refetches something we already have.
  const cache = useRef<Map<string, ChartPoint[]>>(new Map());

  const range = TIMEFRAMES.find((t) => t.id === timeframe)?.range ?? "6mo";

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (selected.length === 0) { setSeries([]); return; }
      setLoading(true);
      const results = await Promise.all(
        selected.map(async (symbol) => {
          const key = `${symbol}:${range}`;
          let points = cache.current.get(key);
          if (!points) {
            points = await fetchSeries(symbol, range);
            cache.current.set(key, points);
          }
          return { symbol, points };
        }),
      );
      if (!cancelled) {
        setSeries(results);
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selected, range]);

  const nameOf = useCallback(
    (symbol: string) => stocks.find((s) => s.symbol === symbol)?.name ?? symbol,
    [stocks],
  );

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pool = q
      ? stocks.filter((s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      : stocks;
    return pool.filter((s) => !selected.includes(s.symbol)).slice(0, 12);
  }, [search, stocks, selected]);

  const addStock = (symbol: string) => {
    if (selected.length >= MAX_STOCKS || selected.includes(symbol)) return;
    onChange([...selected, symbol]);
    setSearch("");
    setSearchOpen(false);
  };
  const removeStock = (symbol: string) => onChange(selected.filter((s) => s !== symbol));

  const singleMode = selected.length === 1 && series.length === 1;

  // Build rebased polylines + a shared time axis. All series are resampled onto
  // the longest series' index so the x-axis lines up.
  const chart = useMemo(() => {
    const withData = series.filter((s) => s.points.length > 1);
    if (withData.length === 0) return null;

    const maxLen = Math.max(...withData.map((s) => s.points.length));
    const innerW = W - PAD * 2;
    const innerH = H - PAD * 2;

    const rebasedSeries = withData.map((s) => {
      const closes = s.points.map((p) => p.c);
      return { symbol: s.symbol, values: rebase(closes), points: s.points };
    });

    const allVals = rebasedSeries.flatMap((s) => s.values);
    const min = Math.min(...allVals);
    const max = Math.max(...allVals);
    const spread = max - min || 1;

    const x = (i: number, len: number) => PAD + (len <= 1 ? 0 : (i / (len - 1)) * innerW);
    const y = (v: number) => PAD + innerH - ((v - min) / spread) * innerH;

    const lines = rebasedSeries.map((s, si) => ({
      symbol: s.symbol,
      color: LINE_COLORS[si % LINE_COLORS.length],
      points: s.values.map((v, i) => `${x(i, s.values.length).toFixed(1)},${y(v).toFixed(1)}`).join(" "),
    }));

    // SMA overlays only in single-stock mode (multi-line SMAs are visual noise).
    let smaLines: { points: string; color: string; label: string }[] = [];
    if (singleMode && showSMA) {
      const closes = withData[0].points.map((p) => p.c);
      const rb = rebase(closes);
      const first = closes.find((c) => c > 0) ?? closes[0];
      const toRebased = (v: number | null) => (v == null || !first ? null : (v / first) * 100);
      const sma20 = sma(closes, 20).map(toRebased);
      const sma50 = sma(closes, 50).map(toRebased);
      const buildLine = (arr: (number | null)[]) =>
        arr
          .map((v, i) => (v == null ? null : `${x(i, rb.length).toFixed(1)},${y(v).toFixed(1)}`))
          .filter(Boolean)
          .join(" ");
      smaLines = [
        { points: buildLine(sma20), color: "#8b5cf6", label: "SMA 20" },
        { points: buildLine(sma50), color: "#ec4899", label: "SMA 50" },
      ].filter((l) => l.points.length > 0);
    }

    const baseY = y(100);
    return { lines, smaLines, baseY, maxLen, x, innerW };
  }, [series, singleMode, showSMA]);

  // Per-stock technical readout for the legend.
  const stats = useMemo(() => {
    return series.map((s) => {
      const closes = s.points.map((p) => p.c);
      return {
        symbol: s.symbol,
        ret: periodReturnPct(closes),
        rsi: rsi(closes, 14),
        last: closes[closes.length - 1] ?? null,
      };
    });
  }, [series]);

  return (
    <Card className="p-4 md:p-6">
      {/* Stock selector */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {selected.map((symbol, i) => (
          <span
            key={symbol}
            className="inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg text-xs font-semibold border"
            style={{ borderColor: LINE_COLORS[i % LINE_COLORS.length], color: LINE_COLORS[i % LINE_COLORS.length] }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />
            {symbol}
            <button onClick={() => removeStock(symbol)} aria-label={`Remove ${symbol}`} className="hover:opacity-70">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {selected.length < MAX_STOCKS && (
          <div className="relative">
            <Button variant="outline" size="sm" className="h-8 border-dashed gap-1" onClick={() => setSearchOpen((o) => !o)}>
              <Plus className="w-3.5 h-3.5" /> Add stock
            </Button>
            {searchOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-full left-0 mt-1 w-72 bg-card border border-border rounded-xl shadow-xl z-30 p-3"
              >
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input autoFocus placeholder="Search stocks..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
                </div>
                <div className="max-h-56 overflow-y-auto space-y-0.5">
                  {searchResults.map((s) => (
                    <button
                      key={s.symbol}
                      onClick={() => addStock(s.symbol)}
                      className="w-full text-left px-2.5 py-1.5 text-sm rounded-lg hover:bg-muted/60 transition-colors"
                    >
                      <span className="font-semibold text-foreground">{s.symbol}</span>
                      <span className="text-xs text-muted-foreground ml-2 truncate">{s.name}</span>
                    </button>
                  ))}
                  {searchResults.length === 0 && <p className="text-xs text-muted-foreground px-2 py-3 text-center">No matches</p>}
                </div>
              </motion.div>
            )}
          </div>
        )}
        <span className="text-[11px] text-muted-foreground ml-1">Compare up to {MAX_STOCKS} · rebased to 100</span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex bg-muted rounded-lg p-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.id}
              onClick={() => setTimeframe(tf.id)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${timeframe === tf.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {tf.label}
            </button>
          ))}
        </div>
        {singleMode && (
          <button
            onClick={() => setShowSMA((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${showSMA ? "border-primary/40 bg-primary/5 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            <Activity className="w-3.5 h-3.5" /> SMA 20/50
          </button>
        )}
      </div>

      {/* Chart */}
      <div className="relative rounded-xl border border-border/50 bg-muted/10 p-2">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/40 backdrop-blur-[1px] rounded-xl">
            <Loader2 className="w-6 h-6 animate-spin text-brand-orange" />
          </div>
        )}
        {selected.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <LineChart className="w-12 h-12 mb-3 opacity-20" />
            <p className="font-semibold">Add stocks to compare their performance</p>
            <p className="text-sm">Overlaid price charts, rebased to 100, with SMA & RSI</p>
          </div>
        ) : chart ? (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto"
            preserveAspectRatio="none"
            onMouseMove={(e) => {
              const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
              const rel = (e.clientX - rect.left) / rect.width;
              setHoverIdx(Math.max(0, Math.min(chart.maxLen - 1, Math.round(rel * (chart.maxLen - 1)))));
            }}
            onMouseLeave={() => setHoverIdx(null)}
          >
            {/* Baseline at 100 (the rebase origin) */}
            <line x1={PAD} y1={chart.baseY} x2={W - PAD} y2={chart.baseY} stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="4 4" />
            {/* SMA overlays behind price */}
            {chart.smaLines.map((l) => (
              <polyline key={l.label} points={l.points} fill="none" stroke={l.color} strokeWidth="1" strokeOpacity="0.7" strokeDasharray="3 3" />
            ))}
            {/* Price lines */}
            {chart.lines.map((l) => (
              <polyline key={l.symbol} points={l.points} fill="none" stroke={l.color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {hoverIdx != null && (
              <line
                x1={chart.x(hoverIdx, chart.maxLen)}
                y1={PAD}
                x2={chart.x(hoverIdx, chart.maxLen)}
                y2={H - PAD}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth="0.75"
                strokeOpacity="0.5"
              />
            )}
          </svg>
        ) : (
          <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">No chart data available for this selection.</div>
        )}
      </div>

      {/* Legend + technical readout */}
      {stats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {stats.map((st, i) => {
            const zone = rsiZone(st.rsi);
            const up = (st.ret ?? 0) >= 0;
            return (
              <div key={st.symbol} className="rounded-xl border border-border/50 bg-card p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />
                  <span className="font-semibold text-sm text-foreground">{st.symbol}</span>
                </div>
                <div className="text-[11px] text-muted-foreground truncate mb-2">{nameOf(st.symbol)}</div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{timeframe} return</span>
                  <span className={`font-semibold inline-flex items-center gap-0.5 ${up ? "text-secondary" : "text-destructive"}`}>
                    {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {st.ret == null ? "-" : `${up ? "+" : ""}${st.ret.toFixed(1)}%`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-muted-foreground">RSI(14)</span>
                  <span className={`font-semibold ${zone.tone === "over" ? "text-destructive" : zone.tone === "under" ? "text-secondary" : "text-foreground"}`}>
                    {st.rsi == null ? "-" : st.rsi.toFixed(0)} {st.rsi != null && <span className="text-[10px] font-normal text-muted-foreground">{zone.label}</span>}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground mt-3 text-center">
        Lines rebased to 100 at period start for like-for-like comparison. RSI &gt;70 overbought, &lt;30 oversold. Educational use only — not investment advice.
      </p>
    </Card>
  );
};

export default ChartCompare;
