import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import WhatsAppButton from "@/components/WhatsAppButton";
import ScrollProgress from "@/components/ScrollProgress";
import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitCompareArrows, Search, X, TrendingUp, TrendingDown, Star, Bot, Share2, Zap, Maximize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { StockForAnalysis } from "@/components/AIAnalysisModal";
import PageTransition from "@/components/PageTransition";
import { EASE_OUT } from "@/lib/motion";
import AdvancedChartDialog from "@/components/charts/AdvancedChartDialog";
import type { ApiChartPoint } from "@/lib/chart-data";

/** Ranges offered in the advanced window, and what fetch-stock-chart expects. */
const CHART_RANGES = [
  { label: "1M", range: "1mo" },
  { label: "3M", range: "3mo" },
  { label: "6M", range: "6mo" },
  { label: "1Y", range: "1y" },
] as const;
const AIAnalysisModal = lazy(() => import("@/components/AIAnalysisModal"));

type Stock = {
  symbol: string; name: string; price: number | null; change: number | null;
  change_pct: number | null; market_cap: number | null; pe: number | null;
  volume: number | null; high_52: number | null; low_52: number | null;
  day_high: number | null; day_low: number | null; sector: string | null;
};

// Pre-built popular comparison presets
const PRESETS = [
  { label: "Banking Giants", symbols: ["HDFCBANK", "ICICIBANK", "SBIN"] },
  { label: "IT Leaders", symbols: ["TCS", "INFY", "WIPRO"] },
  { label: "Reliance vs TCS", symbols: ["RELIANCE", "TCS"] },
  { label: "Zomato vs Swiggy", symbols: ["ZOMATO", "SWIGGY"] },
  { label: "Auto Sector", symbols: ["MARUTI", "M&M", "TATAMOTORS"] },
];

// Mini bar inside a cell showing relative value
function StatBar({ value, max, color }: { value: number | null; max: number; color: string }) {
  if (value == null || max === 0) return null;
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="w-full h-1 bg-muted rounded-full mt-1 overflow-hidden">
      <motion.div className={`h-full rounded-full ${color}`} initial={{ width: 0 }}
        animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: EASE_OUT }} />
    </div>
  );
}

// 52W range bar showing where current price is
function RangeBar({ price, low, high }: { price: number | null; low: number | null; high: number | null }) {
  if (price == null || low == null || high == null || high === low) return <span>-</span>;
  const pct = Math.min(100, Math.max(0, ((price - low) / (high - low)) * 100));
  const fmtK = (n: number) => n >= 100000 ? `${(n / 100000).toFixed(0)}L` : `${(n / 1000).toFixed(0)}K`;
  return (
    <div className="flex flex-col gap-1 text-[10px] items-center">
      <div className="relative w-24 h-1.5 bg-muted rounded-full">
        <motion.div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary border-2 border-background shadow-sm"
          initial={{ left: "50%" }} animate={{ left: `${pct}%` }}
          transition={{ duration: 0.8, ease: EASE_OUT }} style={{ marginLeft: "-6px" }} />
      </div>
      <div className="flex gap-3 text-muted-foreground">
        <span>L:₹{fmtK(low)}</span>
        <span>H:₹{fmtK(high)}</span>
      </div>
    </div>
  );
}

const StockComparisonPage = () => {
  const [allStocks, setAllStocks] = useState<Stock[]>([]);
  const [selected, setSelected] = useState<Stock[]>([]);
  // This page compares fundamentals and holds no price history, so the advanced
  // window fetches OHLC for the one symbol it is opened on.
  const [advStock, setAdvStock] = useState<Stock | null>(null);
  const [advRange, setAdvRange] = useState<string>("6mo");
  const [advPoints, setAdvPoints] = useState<ApiChartPoint[]>([]);
  const [advLoading, setAdvLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState<number | null>(null);
  const [analyzingStock, setAnalyzingStock] = useState<StockForAnalysis | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("screener_stocks").select("*").order("market_cap", { ascending: false });
      if (data) setAllStocks(data as Stock[]);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return allStocks.slice(0, 20);
    const q = search.toLowerCase();
    return allStocks.filter(s => s.name.toLowerCase().includes(q) || s.symbol.toLowerCase().includes(q)).slice(0, 15);
  }, [search, allStocks]);

  const addStock = useCallback((stock: Stock) => {
    if (selected.length < 3 && !selected.find(s => s.symbol === stock.symbol)) {
      setSelected(prev => [...prev, stock]);
    }
    setSearchOpen(null);
    setSearch("");
  }, [selected]);

  const removeStock = useCallback((symbol: string) => {
    setSelected(prev => prev.filter(s => s.symbol !== symbol));
  }, []);

  useEffect(() => {
    if (!advStock) return;
    let cancelled = false;
    setAdvLoading(true);
    supabase.functions
      .invoke("fetch-stock-chart", { body: { symbol: advStock.symbol, range: advRange } })
      .then(({ data }) => {
        if (!cancelled) setAdvPoints(Array.isArray(data?.dataPoints) ? data.dataPoints : []);
      })
      .finally(() => {
        if (!cancelled) setAdvLoading(false);
      });
    return () => { cancelled = true; };
  }, [advStock, advRange]);

  const loadPreset = useCallback((symbols: string[]) => {
    const matched = symbols.map(sym => allStocks.find(s => s.symbol === sym)).filter(Boolean) as Stock[];
    if (matched.length > 0) setSelected(matched);
  }, [allStocks]);

  const handleShare = () => {
    if (selected.length === 0) return;
    const text = selected.map(s =>
      `${s.symbol}: ₹${s.price?.toLocaleString("en-IN")} | P/E: ${s.pe?.toFixed(1) ?? "-"} | MCap: ₹${s.market_cap != null ? (s.market_cap / 100000).toFixed(0) + "L Cr" : "-"}`
    ).join("\n");
    const full = `Stock Comparison - Parasram Intelligence:\n${text}`;
    if (navigator.share) navigator.share({ title: "Stock Comparison", text: full });
    else navigator.clipboard.writeText(full);
  };

  const fmt = (n: number | null) => n != null ? `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "-";
  const fmtCr = (n: number | null) => {
    if (n == null) return "-";
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(0)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(0)} L`;
    return fmt(n);
  };
  const fmtVol = (n: number | null) => {
    if (n == null) return "-";
    if (n >= 10000000) return `${(n / 10000000).toFixed(1)} Cr`;
    if (n >= 100000) return `${(n / 100000).toFixed(1)} L`;
    return n.toLocaleString("en-IN");
  };

  // Winner calculation: returns the index of the best stock for a metric
  const getWinner = (key: keyof Stock, higher: boolean): number | null => {
    if (selected.length < 2) return null;
    const vals = selected.map(s => s[key] as number | null);
    if (vals.every(v => v == null)) return null;
    let best = higher ? -Infinity : Infinity;
    let idx = -1;
    vals.forEach((v, i) => {
      if (v == null) return;
      if ((higher && v > best) || (!higher && v < best)) { best = v; idx = i; }
    });
    return idx >= 0 ? idx : null;
  };

  // Column colors for the winner
  const WINNER_COLORS = ["border-l-4 border-l-brand-orange bg-brand-orange/5", "border-l-4 border-l-secondary bg-secondary/5", "border-l-4 border-l-blue-500 bg-blue-500/5"];
  const STAT_BAR_COLORS = ["bg-brand-orange", "bg-secondary", "bg-blue-500"];

  // Determine the overall winner by P/E + market_cap + change_pct composite
  const overallWinner = useMemo(() => {
    if (selected.length < 2) return null;
    const scores = selected.map(s => {
      let sc = 0;
      if (s.change_pct != null) sc += s.change_pct > 0 ? 2 : -1;
      if (s.pe != null && s.pe > 0 && s.pe < 30) sc += 2;
      if (s.market_cap != null && s.market_cap > 50000) sc += 1;
      return sc;
    });
    const max = Math.max(...scores);
    return scores.indexOf(max);
  }, [selected]);

  const metrics: { label: string; key: keyof Stock; format: (s: Stock) => React.ReactNode; compare?: "higher" | "lower"; barkey?: keyof Stock }[] = [
    {
      label: "Current Price", key: "price", compare: undefined,
      format: s => <div className="text-center"><div className="font-mono font-bold">{fmt(s.price)}</div>
        {s.change_pct != null && (
          <div className={`text-xs font-semibold flex items-center justify-center gap-1 mt-0.5 ${s.change_pct >= 0 ? "text-secondary" : "text-destructive"}`}>
            {s.change_pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {s.change_pct >= 0 ? "+" : ""}{s.change_pct.toFixed(2)}%
          </div>)}
      </div>
    },
    {
      label: "Market Cap", key: "market_cap", compare: "higher", barkey: "market_cap",
      format: s => <div className="text-center"><div className="font-mono">{fmtCr(s.market_cap)}</div>
        <StatBar value={s.market_cap} max={Math.max(...selected.map(x => x.market_cap ?? 0))} color={STAT_BAR_COLORS[selected.indexOf(s)] ?? "bg-primary"} /></div>
    },
    {
      label: "P/E Ratio", key: "pe", compare: "lower",
      format: s => <div className="text-center">
        <div className="font-mono">{s.pe != null && s.pe > 0 ? s.pe.toFixed(2) : "-"}</div>
        {s.pe != null && s.pe > 0 && <div className={`text-[10px] mt-0.5 font-semibold ${s.pe < 20 ? "text-secondary" : s.pe > 50 ? "text-destructive" : "text-muted-foreground"}`}>
          {s.pe < 20 ? "Low" : s.pe > 50 ? "Premium" : "Fair"}
        </div>}
      </div>
    },
    {
      label: "Volume", key: "volume", compare: "higher", barkey: "volume",
      format: s => <div className="text-center"><div className="font-mono">{fmtVol(s.volume)}</div>
        <StatBar value={s.volume} max={Math.max(...selected.map(x => x.volume ?? 0))} color={STAT_BAR_COLORS[selected.indexOf(s)] ?? "bg-primary"} /></div>
    },
    { label: "Day High", key: "day_high", compare: "higher", format: s => <div className="font-mono text-center text-secondary">{fmt(s.day_high)}</div> },
    { label: "Day Low", key: "day_low", compare: "lower", format: s => <div className="font-mono text-center text-destructive">{fmt(s.day_low)}</div> },
    {
      label: "52W Range", key: "high_52", compare: undefined,
      format: s => <div className="flex justify-center"><RangeBar price={s.price} low={s.low_52} high={s.high_52} /></div>
    },
    { label: "Sector", key: "sector", compare: undefined, format: s => <div className="text-center text-xs text-muted-foreground">{s.sector ?? "-"}</div> },
  ];

  return (
    <PageTransition>
    <div className="min-h-screen bg-background">
      <SEOHead 
        title="Compare Stocks Side-by-Side NSE BSE | Parasram India" 
        description="Compare up to 3 NSE/BSE stocks side-by-side with live price, P/E ratio, market cap, 52-week range, volume and AI-powered analysis. Free tool." 
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Compare Stocks" },
        ]}
        jsonLd={{
          "@type": "WebApplication",
          "name": "Stock Comparison Tool - Parasram India",
          "description": "Free tool to compare up to 3 NSE/BSE stocks side-by-side with live price, P/E ratio, market cap, volume, 52-week range, and AI-powered analysis.",
          "applicationCategory": "FinanceApplication",
          "operatingSystem": "Web Browser",
          "url": "https://www.sphpnp.com/compare",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "INR" },
          "provider": {
            "@type": "Organization",
            "name": "Shri Parasram Holdings Panipat",
            "url": "https://www.sphpnp.com"
          },
          "featureList": [
            "Side-by-side comparison of up to 3 stocks",
            "Live NSE/BSE price data",
            "P/E ratio, market cap, volume comparison",
            "52-week high/low range visualizer",
            "Winner determination by composite score",
            "AI-powered stock analysis per stock",
            "Quick preset comparisons for Banking, IT, Auto sectors"
          ]
        }}
      />
      <ScrollProgress />
      <Header />
      <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Compare Stocks" }]} />
      <main className="container mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <GitCompareArrows className="w-8 h-8 text-primary" />
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground">Stock Comparison</h1>
          </div>
          <p className="text-muted-foreground">Compare up to 3 stocks side-by-side with live data, visual stat bars, and AI analysis</p>
        </motion.div>

        {/* Preset chips */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="flex flex-wrap gap-2 mb-6">
          <span className="text-xs text-muted-foreground self-center">Quick compare:</span>
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => loadPreset(p.symbols)}
              disabled={allStocks.length === 0}
              className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted/50 hover:bg-muted hover:border-primary/30 transition-colors font-medium disabled:opacity-40">
              {p.label}
            </button>
          ))}
        </motion.div>

        {/* Stock selector slots */}
        <div className="flex flex-wrap gap-3 mb-8">
          {[0, 1, 2].map(i => (
            <div key={i} className="relative">
              {selected[i] ? (
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold ${WINNER_COLORS[i]}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${["bg-brand-orange", "bg-secondary", "bg-blue-500"][i]}`} />
                  {selected[i].symbol}
                  {overallWinner === i && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                  <button
                    onClick={() => setAdvStock(selected[i])}
                    aria-label={`Open the advanced chart for ${selected[i].symbol}`}
                    className="hover:text-secondary ml-1"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => removeStock(selected[i].symbol)} className="hover:text-destructive ml-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ) : (
                <div>
                  <Button variant="outline" size="sm"
                    onClick={() => setSearchOpen(searchOpen === i ? null : i)}
                    className="border-dashed gap-1.5">
                    <Search className="w-3.5 h-3.5" />
                    Add Stock {i + 1}
                  </Button>
                  <AnimatePresence>
                    {searchOpen === i && (
                      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                        className="absolute top-full left-0 mt-1 w-72 bg-card border border-border rounded-xl shadow-xl z-30 p-3">
                        <Input autoFocus placeholder="Search stocks..." value={search}
                          onChange={e => setSearch(e.target.value)} className="mb-2 h-8 text-sm" />
                        <div className="max-h-52 overflow-y-auto space-y-0.5">
                          {filtered.map(stock => (
                            <button key={stock.symbol} onClick={() => addStock(stock)}
                              className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted/60 transition-colors flex items-center justify-between">
                              <div>
                                <div className="font-semibold text-foreground">{stock.symbol}</div>
                                <div className="text-xs text-muted-foreground truncate max-w-[140px]">{stock.name}</div>
                              </div>
                              {stock.price != null && (
                                <div className="text-right">
                                  <div className="text-xs font-mono font-medium">₹{stock.price.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</div>
                                  {stock.change_pct != null && (
                                    <div className={`text-[10px] font-semibold ${stock.change_pct >= 0 ? "text-secondary" : "text-destructive"}`}>
                                      {stock.change_pct >= 0 ? "+" : ""}{stock.change_pct.toFixed(2)}%
                                    </div>)}
                                </div>)}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          ))}

          {selected.length >= 2 && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 ml-auto">
              <Button variant="ghost" size="sm" onClick={handleShare} className="h-9 text-xs gap-1.5">
                <Share2 className="w-3.5 h-3.5" />Share
              </Button>
              <Button variant="outline" size="sm"
                className="h-9 text-xs gap-1.5 text-brand-orange border-brand-orange/30 hover:bg-brand-orange/10 bg-transparent"
                onClick={() => setAnalyzingStock(selected[0] ? {
                  name: selected[0].name, symbol: selected[0].symbol, price: selected[0].price ?? 0,
                  change_pct: selected[0].change_pct, pe: selected[0].pe, high_52: selected[0].high_52,
                  low_52: selected[0].low_52, day_high: selected[0].day_high, day_low: selected[0].day_low,
                  volume: selected[0].volume, market_cap: selected[0].market_cap, sector: selected[0].sector,
                } : null)}>
                <Bot className="w-3.5 h-3.5" />AI Analyze Top Pick
              </Button>
            </motion.div>
          )}
        </div>

        {/* Winner banner */}
        {overallWinner !== null && selected.length >= 2 && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center gap-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-5 py-3">
            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500 shrink-0" />
            <div>
              <span className="font-semibold text-foreground">{selected[overallWinner].symbol}</span>
              <span className="text-sm text-muted-foreground ml-2">looks strongest overall based on current price momentum, P/E valuation, and market cap.</span>
            </div>
            <Button variant="ghost" size="sm" className="ml-auto text-xs text-brand-orange h-8 px-3 shrink-0"
              onClick={() => setAnalyzingStock({
                name: selected[overallWinner].name, symbol: selected[overallWinner].symbol,
                price: selected[overallWinner].price ?? 0, change_pct: selected[overallWinner].change_pct,
                pe: selected[overallWinner].pe, high_52: selected[overallWinner].high_52,
                low_52: selected[overallWinner].low_52, day_high: selected[overallWinner].day_high,
                day_low: selected[overallWinner].day_low, volume: selected[overallWinner].volume,
                market_cap: selected[overallWinner].market_cap, sector: selected[overallWinner].sector,
              })}>
              <Bot className="w-3.5 h-3.5 mr-1" />AI Analysis
            </Button>
          </motion.div>
        )}

        {/* Comparison table */}
        <AnimatePresence>
          {selected.length === 0 ? (
            <Card className="p-16 text-center text-muted-foreground">
              <GitCompareArrows className="w-14 h-14 mx-auto mb-4 opacity-20" />
              <p className="text-xl font-semibold mb-1">Select stocks to compare</p>
              <p className="text-sm">Add up to 3 stocks, or pick a preset above</p>
            </Card>
          ) : (
            <motion.div key="table" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="overflow-x-auto rounded-xl border border-border/50 shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-5 py-4 font-semibold text-muted-foreground min-w-[140px]">Metric</th>
                      {selected.map((s, si) => (
                        <th key={s.symbol} className={`text-center px-5 py-4 font-bold min-w-[180px] ${si === overallWinner ? "text-yellow-600" : "text-foreground"}`}>
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2.5 h-2.5 rounded-full ${["bg-brand-orange", "bg-secondary", "bg-blue-500"][si]}`} />
                              {s.symbol}
                              {si === overallWinner && <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />}
                            </div>
                            <div className="text-xs font-normal text-muted-foreground truncate max-w-[150px]">{s.name}</div>
                            <button className="text-[10px] text-brand-orange hover:underline flex items-center gap-0.5"
                              onClick={() => setAnalyzingStock({
                                name: s.name, symbol: s.symbol, price: s.price ?? 0,
                                change_pct: s.change_pct, pe: s.pe, high_52: s.high_52, low_52: s.low_52,
                                day_high: s.day_high, day_low: s.day_low, volume: s.volume,
                                market_cap: s.market_cap, sector: s.sector,
                              })}>
                              <Bot className="w-2.5 h-2.5" />AI Analysis
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((m, idx) => {
                      const winner = m.compare ? getWinner(m.key, m.compare === "higher") : null;
                      return (
                        <motion.tr key={m.key}
                          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className="border-b border-border/30 hover:bg-muted/20">
                          <td className="px-5 py-3.5 font-medium text-muted-foreground text-sm">{m.label}</td>
                          {selected.map((s, si) => (
                            <td key={s.symbol}
                              className={`px-5 py-3.5 text-center ${si === winner ? "font-semibold text-secondary" : ""}`}>
                              {m.format(s)}
                              {si === winner && m.compare && (
                                <div className="text-[9px] text-secondary font-bold mt-0.5">
                                  {m.compare === "higher" ? "▲ Best" : "▼ Best"}
                                </div>
                              )}
                            </td>
                          ))}
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
              {selected.length > 0 && (
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  ⭐ Winner determined by composite score of P/E, market cap, and momentum. AI Analysis available per stock.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <Footer />
      <AdvancedChartDialog
        open={advStock !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAdvStock(null);
            // Cleared on close so a different symbol cannot briefly show the
            // previous one's history while its own fetch is in flight.
            setAdvPoints([]);
          }
        }}
        data={advPoints}
        ticker={advStock?.symbol ?? ""}
        title={advStock?.symbol ?? ""}
        subtitle={advStock?.name}
        price={advStock?.price != null ? `₹${advStock.price.toLocaleString("en-IN")}` : undefined}
        change={advStock?.change != null ? `${advStock.change >= 0 ? "+" : ""}${advStock.change.toFixed(2)}%` : undefined}
        up={(advStock?.change ?? 0) >= 0}
        ranges={CHART_RANGES}
        activeRange={advRange}
        onRangeChange={setAdvRange}
        loading={advLoading}
      />
      <WhatsAppButton />

      {/* Lazy: recharts only downloads when an analysis is opened */}
      {analyzingStock && (
        <Suspense fallback={null}>
          <AIAnalysisModal isOpen onClose={() => setAnalyzingStock(null)} stock={analyzingStock} />
        </Suspense>
      )}
    </div>
  </PageTransition>
  );
};

export default StockComparisonPage;