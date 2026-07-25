import { motion } from "motion/react";
import { useState, useMemo, useCallback, useEffect, memo } from "react";
import { TrendingUp, TrendingDown, BarChart3, Activity, ArrowUpRight, ArrowDownRight, Clock, Layers, Gauge, LineChart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useLiveMarket } from "@/hooks/useLiveMarket";
import { supabase } from "@/integrations/supabase/client";

const generateChartData = (trend: "up" | "down" | "mixed", points = 60, seed = 0, timeframe = "1D") => {
  const data: number[] = [];
  let value = 100 + ((seed * 17 + 31) % 25);

  // Each timeframe has its own volatility and movement style
  const tfConfig: Record<string, { vol: number; driftMul: number; freq1: number; freq2: number; amp1: number; amp2: number }> = {
    "1D": { vol: 0.8,  driftMul: 0.04, freq1: 8.1,  freq2: 5.7,  amp1: 0.6, amp2: 0.4 }, // choppy intraday
    "1W": { vol: 1.4,  driftMul: 0.08, freq1: 3.3,  freq2: 2.1,  amp1: 0.7, amp2: 0.5 }, // smoother weekly
    "1M": { vol: 2.2,  driftMul: 0.10, freq1: 1.9,  freq2: 1.1,  amp1: 0.8, amp2: 0.6 }, // medium trend
    "3M": { vol: 3.0,  driftMul: 0.12, freq1: 0.9,  freq2: 0.5,  amp1: 0.9, amp2: 0.5 }, // broader swings
    "1Y": { vol: 4.0,  driftMul: 0.15, freq1: 0.4,  freq2: 0.25, amp1: 1.0, amp2: 0.7 }, // long-term trend
  };

  const cfg = tfConfig[timeframe] || tfConfig["1D"];
  const drift = trend === "up" ? cfg.driftMul : trend === "down" ? -cfg.driftMul : 0;

  for (let i = 0; i < points; i++) {
    // Use drastically different seed multipliers per timeframe so shapes differ
    const s = seed * 137 + i;
    const pseudo = Math.sin(s * cfg.freq1) * cfg.amp1 + Math.cos(s * cfg.freq2 + seed * 29) * cfg.amp2;
    value += (pseudo + drift) * cfg.vol;
    value = Math.max(70, Math.min(140, value));
    data.push(value);
  }
  return data;
};

const generateVolumeData = (points: number, seed: number) => {
  const data: number[] = [];
  for (let i = 0; i < points; i++) {
    const pseudo = Math.abs(Math.sin(seed * 500 + i * 2.1)) * 0.7 + 0.3;
    data.push(pseudo * 100);
  }
  return data;
};

// Calculate SMA
const calcSMA = (data: number[], period: number): (number | null)[] => {
  // A period below 1 divides by zero and yields NaN for every point, which then
  // reaches the SVG as `points="0,NaN 500,NaN"`. There is no meaningful average
  // over fewer than one sample, so report "no line" instead.
  if (period < 1) return data.map(() => null);
  return data.map((_, i) => {
    if (i < period - 1) return null;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j];
    return sum / period;
  });
};

// Calculate RSI
const calcRSI = (data: number[], period = 14): (number | null)[] => {
  const rsi: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period) { rsi.push(null); continue; }
    let gains = 0, losses = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = data[j] - data[j - 1];
      if (diff > 0) gains += diff; else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(100 - 100 / (1 + rs));
  }
  return rsi;
};

const timeframePoints: Record<string, number> = { "1D": 60, "1W": 90, "1M": 120, "3M": 180, "1Y": 250 };
const timeframeSeed: Record<string, number> = { "1D": 1, "1W": 2, "1M": 3, "3M": 4, "1Y": 5 };

function formatVol(v: number) {
  if (v >= 10000000) return `${(v / 10000000).toFixed(2)}Cr`;
  if (v >= 100000) return `${(v / 100000).toFixed(2)}L`;
  if (v >= 1000) return `${(v / 1000).toFixed(2)}K`;
  return v.toString();
}

const InteractiveChart = memo(({ data, volumeData, timestamps, up, large = false, showIndicators = false }: { data: number[]; volumeData?: number[]; timestamps?: number[]; up: boolean; large?: boolean; showIndicators?: boolean }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Drop non-finite samples before any maths touches them. A single NaN in the
  // series poisons the whole chart silently: Math.min/max return NaN, and
  // `max - min || 1` then falls through to 1 because NaN is falsy, so every y
  // resolves to NaN and the SVG is rejected with
  // `<polyline> attribute points: Expected number, "0,NaN 500,NaN"`.
  const series = useMemo(() => data.filter((v) => Number.isFinite(v)), [data]);

  const min = series.length ? Math.min(...series) : 0;
  const max = series.length ? Math.max(...series) : 0;
  const range = max - min || 1;
  const h = large ? 160 : 40;
  const volH = large ? 40 : 0;
  const w = large ? 500 : 100;

  const coords = useMemo(() => series.map((v, i) => ({
    // A single sample has no span to divide by; pin it to the left edge rather
    // than dividing by zero.
    x: series.length > 1 ? (i / (series.length - 1)) * w : 0,
    y: h - ((v - min) / range) * h,
    val: v,
  })), [series, w, h, min, range]);

  // SMA lines
  const sma20 = useMemo(() => showIndicators ? calcSMA(series, 20) : [], [series, showIndicators]);
  const sma50 = useMemo(() => showIndicators ? calcSMA(series, Math.min(50, Math.floor(series.length * 0.4)) || series.length) : [], [series, showIndicators]);

  const sma20Pts = useMemo(() => {
    if (!showIndicators) return "";
    return sma20.map((v, i) => {
      if (v === null || !Number.isFinite(v)) return null;
      const x = series.length > 1 ? (i / (series.length - 1)) * w : 0;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    }).filter(Boolean).join(" ");
  }, [sma20, showIndicators, series.length, w, h, min, range]);

  const sma50Pts = useMemo(() => {
    if (!showIndicators) return "";
    return sma50.map((v, i) => {
      if (v === null || !Number.isFinite(v)) return null;
      const x = series.length > 1 ? (i / (series.length - 1)) * w : 0;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    }).filter(Boolean).join(" ");
  }, [sma50, showIndicators, series.length, w, h, min, range]);

  const points = coords.map(c => `${c.x},${c.y}`).join(" ");
  const areaPoints = `0,${h} ${points} ${w},${h}`;
  const color = up ? "hsl(145, 70%, 40%)" : "hsl(0, 84%, 60%)";
  const warmAccent = "hsl(24, 95%, 53%)";
  const gradientId = `grad-${large ? "lg" : "sm"}-${up ? "up" : "down"}-interactive`;

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!large) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * w;
    let closest = 0;
    let closestDist = Infinity;
    coords.forEach((c, i) => { const d = Math.abs(c.x - x); if (d < closestDist) { closestDist = d; closest = i; } });
    requestAnimationFrame(() => setHoverIdx(closest));
  }, [large, w, coords]);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${w} ${h + volH}`}
        className={large ? "w-full h-[160px] sm:h-[200px] cursor-crosshair" : "w-[100px] h-[40px]"}
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {large && [0, 1, 2, 3].map(i => (
          <line key={i} x1={0} y1={(h / 3) * i} x2={w} y2={(h / 3) * i} stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.3" />
        ))}
        {coords.length > 1 && (
          <>
            <polygon points={areaPoints} fill={`url(#${gradientId})`} />
            <polyline points={points} fill="none" stroke={color} strokeWidth={large ? "2" : "1.5"} strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
        {/* SMA overlays */}
        {large && showIndicators && sma20Pts && (
          <polyline points={sma20Pts} fill="none" stroke="hsl(var(--brand-gold))" strokeWidth="1.2" strokeDasharray="3 2" opacity="0.7" />
        )}
        {large && showIndicators && sma50Pts && (
          <polyline points={sma50Pts} fill="none" stroke="hsl(210, 80%, 60%)" strokeWidth="1.2" strokeDasharray="5 3" opacity="0.6" />
        )}
        {large && volumeData && volumeData.length > 0 && (() => {
          const maxVol = Math.max(...volumeData, 1);
          return volumeData.map((v, i) => {
            const barW = w / volumeData.length;
            const barH = (v / maxVol) * volH;
            return (
              <rect key={i} x={i * barW} y={h + volH - barH} width={barW * 0.7} height={barH}
                fill={series[i] >= (series[i - 1] ?? series[i]) ? "hsl(145, 70%, 40%)" : "hsl(0, 84%, 60%)"}
                opacity={hoverIdx === i ? 0.8 : 0.25} rx="1" />
            );
          });
        })()}
        {large && hoverIdx !== null && coords[hoverIdx] && (
          <>
            <line x1={coords[hoverIdx].x} y1={0} x2={coords[hoverIdx].x} y2={h + volH} stroke={warmAccent} strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
            <line x1={0} y1={coords[hoverIdx].y} x2={w} y2={coords[hoverIdx].y} stroke={color} strokeWidth="0.5" strokeDasharray="4 3" opacity="0.3" />
            <circle cx={coords[hoverIdx].x} cy={coords[hoverIdx].y} r="5" fill={warmAccent} stroke="hsl(var(--background))" strokeWidth="2.5" />
          </>
        )}
      </svg>
      {large && hoverIdx !== null && coords[hoverIdx] && (
        <div
          className="absolute top-0 bg-card border border-brand-orange/30 rounded-xl px-3 py-1.5 sm:px-4 sm:py-2 shadow-xl pointer-events-none text-xs z-10 max-w-[150px] sm:max-w-none"
          style={{ left: `clamp(40px, ${(coords[hoverIdx].x / w) * 100}%, calc(100% - 40px))`, transform: "translateX(-50%)" }}
        >
          <div className="font-bold text-foreground text-sm truncate">₹{coords[hoverIdx].val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="text-muted-foreground">
            {timestamps && timestamps[hoverIdx] 
              ? new Date(timestamps[hoverIdx]).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) 
              : `${9 + Math.floor(hoverIdx / 10)}:${String((hoverIdx % 10) * 6).padStart(2, "0")}`}
          </div>
          {volumeData && <div className="text-brand-orange text-[10px]">Vol: {formatVol(volumeData[hoverIdx])}</div>}
        </div>
      )}
    </div>
  );
});

// RSI Chart component
const RSIChart = memo(({ data }: { data: number[] }) => {
  const series = useMemo(() => data.filter((v) => Number.isFinite(v)), [data]);
  const rsi = useMemo(() => calcRSI(series), [series]);
  const w = 500, h = 50;

  const points = useMemo(() => {
    return rsi.map((v, i) => {
      if (v === null || !Number.isFinite(v)) return null;
      const x = series.length > 1 ? (i / (series.length - 1)) * w : 0;
      return `${x},${h - (v / 100) * h}`;
    }).filter(Boolean).join(" ");
  }, [rsi, series.length]);

  const latestRSI = rsi.filter(v => v !== null).pop() || 50;
  const rsiColor = latestRSI > 70 ? "text-destructive" : latestRSI < 30 ? "text-secondary" : "text-brand-gold";

  return (
    <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground font-medium">RSI (14)</span>
        <span className={`text-xs font-bold ${rsiColor}`}>{latestRSI.toFixed(1)}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[50px]" preserveAspectRatio="none">
        {/* Overbought/oversold zones */}
        <rect x={0} y={0} width={w} height={h * 0.3} fill="hsl(0, 84%, 60%)" opacity="0.05" />
        <rect x={0} y={h * 0.7} width={w} height={h * 0.3} fill="hsl(145, 70%, 40%)" opacity="0.05" />
        <line x1={0} y1={h * 0.3} x2={w} y2={h * 0.3} stroke="hsl(0, 84%, 60%)" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.4" />
        <line x1={0} y1={h * 0.5} x2={w} y2={h * 0.5} stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.3" />
        <line x1={0} y1={h * 0.7} x2={w} y2={h * 0.7} stroke="hsl(145, 70%, 40%)" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.4" />
        <polyline points={points} fill="none" stroke="hsl(var(--brand-orange))" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
        <span>Oversold (30)</span>
        <span>Overbought (70)</span>
      </div>
    </div>
  );
});

// Range bar component
const RangeBar = memo(({ label, low, high, current, lowLabel, highLabel }: { label: string; low: number; high: number; current: number; lowLabel: string; highLabel: string }) => {
  const pct = high > low ? ((current - low) / (high - low)) * 100 : 50;
  const clampedPct = Math.max(0, Math.min(100, pct));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="text-foreground font-semibold">{clampedPct.toFixed(0)}% from low</span>
      </div>
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-destructive/40 via-brand-gold/40 to-secondary/40 rounded-full" />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-brand-orange rounded-full border-2 border-background shadow-md z-10"
          style={{ left: `${clampedPct}%`, transform: `translateX(-50%) translateY(-50%)` }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground">
        <span>₹{lowLabel}</span>
        <span>₹{highLabel}</span>
      </div>
    </div>
  );
});

const timeLabels: Record<string, string[]> = {
  "1D": ["09:15", "10:30", "11:45", "13:00", "14:15", "15:30"],
  "1W": ["Mon", "Tue", "Wed", "Thu", "Fri", ""],
  "1M": ["Week 1", "Week 2", "Week 3", "Week 4", "", ""],
  "3M": ["Jan", "Feb", "Mar", "", "", ""],
  "1Y": ["Mar", "May", "Jul", "Sep", "Nov", "Jan"],
};

const useCountdown = (targetISO: string | null) => {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    if (!targetISO) { setRemaining(""); return; }
    const update = () => {
      const diff = new Date(targetISO).getTime() - Date.now();
      if (diff <= 0) { setRemaining(""); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [targetISO]);
  return remaining;
};

const LiveChart = () => {
  const { indices, fetchedAt, marketOpen, marketStatusText, lastTradingDate, nextMarketOpen, marketClose } = useLiveMarket();
  const [activeIndexKey, setActiveIndexKey] = useState("NIFTY");
  const [activeTimeframe, setActiveTimeframe] = useState("1D");
  const [showIndicators, setShowIndicators] = useState(true);
  const nextOpenCountdown = useCountdown(nextMarketOpen);
  const closeCountdown = useCountdown(marketClose);

  const activeIndex = indices.find(i => i.key === activeIndexKey) || indices[0];
  const currentUp = activeIndex?.up ?? true;
  const idxPosition = indices.findIndex(i => i.key === activeIndexKey);

  const [chartData, setChartData] = useState<number[]>([]);
  const [volumeData, setVolumeData] = useState<number[]>([]);
  const [timestamps, setTimestamps] = useState<number[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);
  // Bumped on a timer so intraday charts extend to the current time instead of
  // freezing at the last session's 15:30 close when the page is left open.
  const [chartRefreshTick, setChartRefreshTick] = useState(0);

  useEffect(() => {
    let active = true;
    const fetchChart = async () => {
      setLoadingChart(true);
      try {
        const rangeMap: Record<string, string> = {
          "1D": "1d",
          "1W": "5d",
          "1M": "1mo",
          "3M": "3mo",
          "1Y": "1y",
        };
        const range = rangeMap[activeTimeframe] || "1d";
        
        const { data, error } = await supabase.functions.invoke('fetch-stock-chart', {
          body: { symbol: activeIndexKey, range }
        });
        
        if (active && data?.success && data.dataPoints && data.dataPoints.length > 0) {
          setChartData(data.dataPoints.map((dp: { c: number }) => dp.c));
          setVolumeData(data.dataPoints.map((dp: { v: number }) => dp.v));
          setTimestamps(data.dataPoints.map((dp: { t: number }) => dp.t));
        } else if (active) {
          // fallback to generate if no data
          const trend = currentUp ? "up" : "down";
          const points = timeframePoints[activeTimeframe] || 60;
          const seed = timeframeSeed[activeTimeframe] + idxPosition * 7;
          setChartData(generateChartData(trend, points, seed, activeTimeframe));
          setVolumeData(generateVolumeData(points, seed * 31));
          setTimestamps([]);
        }
      } catch (err) {
        if (active) {
          // fallback to generate on error
          const trend = currentUp ? "up" : "down";
          const points = timeframePoints[activeTimeframe] || 60;
          const seed = timeframeSeed[activeTimeframe] + idxPosition * 7;
          setChartData(generateChartData(trend, points, seed, activeTimeframe));
          setVolumeData(generateVolumeData(points, seed * 31));
          setTimestamps([]);
        }
      } finally {
        if (active) setLoadingChart(false);
      }
    };
    fetchChart();
    return () => { active = false; };
  }, [activeIndexKey, activeTimeframe, currentUp, idxPosition, chartRefreshTick]);

  // Keep intraday charts current: refetch every 60s while the market is open so
  // the line advances to "now" rather than stalling at the previous 15:30 close.
  useEffect(() => {
    const isIntraday = activeTimeframe === "1D" || activeTimeframe === "1W";
    if (!marketOpen || !isIntraday) return;
    const id = setInterval(() => setChartRefreshTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, [marketOpen, activeTimeframe]);

  // Parse prices for range bars
  const parsePrice = (p?: string) => p ? parseFloat(p.replace(/,/g, '')) : 0;
  const currentPrice = parsePrice(activeIndex?.price);
  const dayLow = parsePrice(activeIndex?.low);
  const dayHigh = parsePrice(activeIndex?.high);

  // Approximate 52W range from price (±15%)
  const approx52WLow = currentPrice * 0.82;
  const approx52WHigh = currentPrice * 1.15;

  const formatTradingDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const statusColor = marketOpen 
    ? "bg-secondary/10 text-secondary border-secondary/20"
    : marketStatusText === "Pre-Market"
      ? "bg-brand-orange/10 text-brand-orange border-brand-orange/20"
      : marketStatusText === "After Hours"
        ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
        : "bg-destructive/10 text-destructive border-destructive/20";

  const dotColor = marketOpen 
    ? "bg-secondary animate-pulse"
    : marketStatusText === "Pre-Market" ? "bg-brand-orange animate-pulse"
    : marketStatusText === "After Hours" ? "bg-purple-400 animate-pulse"
    : "bg-destructive/60";

  // Volume buy/sell pressure
  const buyPressure = useMemo(() => {
    if (!volumeData.length) return 50;
    const buyVol = volumeData.reduce((s, v, i) => s + (chartData[i] >= (chartData[i-1] || chartData[i]) ? v : 0), 0);
    const totalVol = volumeData.reduce((s, v) => s + v, 0);
    return totalVol > 0 ? Math.round((buyVol / totalVol) * 100) : 50;
  }, [volumeData, chartData]);

  return (
    <section className="py-8 md:py-16 bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-brand-orange/3 to-transparent rounded-full blur-3xl" />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
      </div>
      <div className="container mx-auto px-4 relative z-10">
        <motion.div className="flex items-center flex-wrap gap-2 mb-6" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <div className="w-8 h-8 rounded-lg bg-brand-orange/10 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-brand-orange" />
          </div>
          <h2 className="font-heading text-xl md:text-2xl font-bold text-foreground">Market Watch</h2>
          <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColor}`}>
              <span className={`w-2 h-2 rounded-full ${dotColor}`} />
              {marketStatusText}
            </div>
            {!marketOpen && nextOpenCountdown && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                <Clock className="w-3 h-3" />Opens in {nextOpenCountdown}
              </div>
            )}
            {marketOpen && closeCountdown && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                <Clock className="w-3 h-3" />Closes in {closeCountdown}
              </div>
            )}
            {!marketOpen && lastTradingDate && (
              <span className="text-[10px] text-muted-foreground hidden sm:block">Closing prices: {formatTradingDate(lastTradingDate)}</span>
            )}
            {marketOpen && fetchedAt && (
              <span className="text-[10px] text-muted-foreground hidden sm:block">Updated: {new Date(fetchedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            )}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          <motion.div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 -mx-4 px-4 lg:mx-0 lg:px-0 snap-x snap-mandatory lg:snap-none" initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            {indices.map((idx) => {
              const isActive = activeIndexKey === idx.key;
              return (
                <motion.button key={idx.key} onClick={() => setActiveIndexKey(idx.key)}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors min-w-[180px] sm:min-w-[200px] lg:min-w-0 snap-start text-left ${isActive ? "bg-card border-brand-orange/40 shadow-lg shadow-brand-orange/10" : "bg-card/50 border-border/30 hover:border-border"}`}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${idx.up ? "bg-secondary/10" : "bg-destructive/10"}`}>
                    {idx.up ? <TrendingUp className="w-4 h-4 text-secondary" /> : <TrendingDown className="w-4 h-4 text-destructive" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground font-medium">{idx.name}</div>
                    <div className="text-sm font-bold text-foreground">₹{idx.price}</div>
                  </div>
                  <div className={`text-xs font-bold px-2 py-1 rounded-full ${idx.up ? "bg-secondary/10 text-secondary" : "bg-destructive/10 text-destructive"}`}>{idx.change}</div>
                </motion.button>
              );
            })}
          </motion.div>

          <div className="space-y-4">
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="font-heading text-lg font-bold text-foreground">{activeIndex?.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xl sm:text-2xl font-bold text-foreground">₹{activeIndex?.price}</span>
                      <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${currentUp ? "bg-secondary/10 text-secondary" : "bg-destructive/10 text-destructive"}`}>
                        {currentUp ? <TrendingUp className="w-3.5 h-3.5 inline mr-1" /> : <TrendingDown className="w-3.5 h-3.5 inline mr-1" />}{activeIndex?.change}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto">
                    <button
                      onClick={() => setShowIndicators(!showIndicators)}
                      aria-label={showIndicators ? "Hide chart indicators" : "Show chart indicators"}
                      className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md transition-colors whitespace-nowrap ${showIndicators ? "bg-brand-orange/10 text-brand-orange border border-brand-orange/30" : "text-muted-foreground hover:bg-muted/80"}`}
                    >
                      <LineChart className="w-3 h-3" />
                      <span className="hidden sm:inline">Indicators</span>
                    </button>
                    <div className="flex gap-1">
                      {["1D", "1W", "1M", "3M", "1Y"].map((tf) => (
                        <button key={tf} onClick={() => setActiveTimeframe(tf)}
                          className={`px-2 sm:px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${activeTimeframe === tf ? "bg-brand-orange/10 text-brand-orange border border-brand-orange/30" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"}`}>{tf}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <motion.div key={`${activeIndexKey}-${activeTimeframe}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="relative min-h-[160px]">
                  {loadingChart || chartData.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/50 z-10 backdrop-blur-[2px] rounded-lg">
                      <div className="w-8 h-8 rounded-full border-2 border-brand-orange border-t-transparent animate-spin mb-2"></div>
                      <div className="text-xs text-muted-foreground font-medium animate-pulse">Fetching live data...</div>
                    </div>
                  ) : null}
                  <InteractiveChart data={chartData.length > 0 ? chartData : [100, 100]} volumeData={volumeData.length > 0 ? volumeData : [0, 0]} timestamps={timestamps} up={currentUp} large showIndicators={showIndicators} />
                </motion.div>
                <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                  {(timeLabels[activeTimeframe] || timeLabels["1D"]).map((label, i) => (
                    <span key={i}>{label}</span>
                  ))}
                </div>
                {/* Indicator legend */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-sm bg-secondary/40" />
                      <span className="text-[10px] text-muted-foreground">Buy Vol</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-sm bg-destructive/40" />
                      <span className="text-[10px] text-muted-foreground">Sell Vol</span>
                    </div>
                    {showIndicators && (
                      <>
                        <div className="flex items-center gap-1">
                          <div className="w-4 h-0.5 bg-brand-gold rounded" />
                          <span className="text-[10px] text-muted-foreground">SMA 20</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-4 h-0.5 rounded" style={{ background: "hsl(210, 80%, 60%)" }} />
                          <span className="text-[10px] text-muted-foreground">SMA 50</span>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* RSI Indicator */}
            {showIndicators && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <RSIChart data={chartData.length > 0 ? chartData : [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]} />
              </motion.div>
            )}

            {/* OHLC Data */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Open", value: activeIndex?.open ? `₹${activeIndex.open}` : "-", icon: Activity },
                { label: "High", value: activeIndex?.high ? `₹${activeIndex.high}` : "-", icon: ArrowUpRight, color: "text-secondary" },
                { label: "Low", value: activeIndex?.low ? `₹${activeIndex.low}` : "-", icon: ArrowDownRight, color: "text-destructive" },
                { label: "Prev Close", value: activeIndex?.prevClose ? `₹${activeIndex.prevClose}` : "-", icon: Layers },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <motion.div key={item.label} className="bg-card border border-border/50 rounded-xl p-3" whileHover={{ y: -2 }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className={`w-3 h-3 ${item.color || "text-brand-orange"}`} />
                      <span className="text-[10px] text-muted-foreground font-medium">{item.label}</span>
                    </div>
                    <span className="text-sm font-bold text-foreground">{item.value}</span>
                  </motion.div>
                );
              })}
            </div>

            {/* Day Range & 52W Range */}
            {dayLow > 0 && dayHigh > 0 && (
              <Card className="border-border/50">
                <CardContent className="p-4 space-y-4">
                  <RangeBar
                    label="Day Range"
                    low={dayLow}
                    high={dayHigh}
                    current={currentPrice}
                    lowLabel={dayLow.toLocaleString('en-IN')}
                    highLabel={dayHigh.toLocaleString('en-IN')}
                  />
                  <RangeBar
                    label="52 Week Range"
                    low={approx52WLow}
                    high={approx52WHigh}
                    current={currentPrice}
                    lowLabel={Math.round(approx52WLow).toLocaleString('en-IN')}
                    highLabel={Math.round(approx52WHigh).toLocaleString('en-IN')}
                  />
                </CardContent>
              </Card>
            )}

            {/* Volume Analysis Bar */}
            {activeIndex?.volume && (
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-brand-orange" />
                      <span className="text-xs font-bold text-foreground">Volume Analysis</span>
                    </div>
                    <span className="text-sm font-bold text-foreground">{activeIndex.volume}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-secondary font-semibold">{buyPressure}% Buy</span>
                    <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden flex">
                      <div className="bg-secondary/70 rounded-l-full" style={{ width: `${buyPressure}%` }} />
                      <div className="bg-destructive/70 rounded-r-full flex-1" />
                    </div>
                    <span className="text-[10px] text-destructive font-semibold">{100 - buyPressure}% Sell</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default LiveChart;
