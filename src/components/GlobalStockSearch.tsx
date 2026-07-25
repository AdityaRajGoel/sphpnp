import { useState, useRef, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, X, TrendingUp, TrendingDown, Loader2, CandlestickChart, LineChart, Bot } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import PriceChart from "@/components/charts/PriceChart";
const AIAnalysisModal = lazy(() => import("@/components/AIAnalysisModal"));

type StockResult = {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  change_pct: number;
  market_cap: number;
  pe: number;
  high_52: number;
  low_52: number;
  volume: number;
  day_high: number;
  day_low: number;
  open_price: number;
  prev_close: number;
  yahoo?: string;
};

type ChartPoint = { t: number; o: number; h: number; l: number; c: number; v: number };
type TimeRange = "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y" | "5y";
type ChartMode = "candle" | "line";

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: "1d", label: "1D" },
  { key: "5d", label: "5D" },
  { key: "1mo", label: "1M" },
  { key: "3mo", label: "3M" },
  { key: "6mo", label: "6M" },
  { key: "1y", label: "1Y" },
  { key: "5y", label: "5Y" },
];

const formatMarketCap = (cr: number) => {
  if (cr >= 100000) return `₹${(cr / 100000).toFixed(1)}L Cr`;
  if (cr >= 1000) return `₹${(cr / 1000).toFixed(0)}K Cr`;
  if (cr > 0) return `₹${cr.toFixed(0)} Cr`;
  return "-";
};

type Props = { className?: string };

const GlobalStockSearch = ({ className }: Props) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockResult[]>([]);
  const [exchangeResults, setExchangeResults] = useState<StockResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<StockResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartRange, setChartRange] = useState<TimeRange>("3mo");
  const [chartMode, setChartMode] = useState<ChartMode>("candle");
  const [analyzingStock, setAnalyzingStock] = useState<StockResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const searchStocks = useCallback(async (q: string) => {
    if (q.length < 1) {
      setResults([]);
      setExchangeResults([]);
      return;
    }
    setSearching(true);

    // Fire DB and Yahoo exchange search in parallel simultaneously
    const dbPromise = Promise.resolve(
      supabase
        .from("screener_stocks")
        .select("*")
        .or(`symbol.ilike.%${q}%,name.ilike.%${q}%`)
        .order("market_cap", { ascending: false })
        .limit(8)
    ).then(({ data }) => (data as StockResult[]) || []);

    const exchangePromise = supabase.functions.invoke("fetch-screener-data", {
      body: { query: q },
    });

    // Show DB results immediately when they arrive (fast path - typically <100ms)
    dbPromise
      .then((data) => {
        setResults(data);
        if (data.length > 0) setShowDropdown(true);
      })
      .catch(() => setResults([]));

    try {
      const [localResult, exResult] = await Promise.allSettled([dbPromise, exchangePromise]);
      const localData = localResult.status === "fulfilled" ? localResult.value : [];

      if (exResult.status === "fulfilled") {
        const { data: exData, error } = exResult.value as { data: { success?: boolean; results?: StockResult[] } | null; error: unknown };
        if (!error && exData?.success) {
          const localSymbols = new Set(localData.map((s) => s.symbol));
          setExchangeResults(
            (exData.results || [])
              .filter((r: StockResult) => !localSymbols.has(r.symbol))
              .slice(0, 10)
          );
        }
      }
    } catch {
      // individual .then/.catch handlers already set state
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) searchStocks(query.trim());
      else {
        setResults([]);
        setExchangeResults([]);
      }
    }, 200); // Reduced from 350ms → 200ms for faster response
    return () => clearTimeout(timer);
  }, [query, searchStocks]);

  // Handle selecting a stock (either local or from exchange)
  // NOTE: We intentionally do NOT auto-open AI here - user must click the AI button explicitly
  const handleSelect = async (stock: StockResult, isExchange = false) => {
    if (isExchange) {
      setSearching(true);
      try {
        const { data, error } = await supabase.functions.invoke("fetch-screener-data", {
          body: { symbol: stock.symbol }
        });
        if (!error && data?.success && data.stocks?.length > 0) {
          setSelected(data.stocks[0]);
        }
      } catch (e) {
        console.error("Failed to select exchange stock", e);
      } finally {
        setSearching(false);
      }
    } else {
      setSelected(stock);
    }
    setChartRange("3mo");
    setShowDropdown(false);
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const fetchChartData = async () => {
      if (!selected) {
        setChartData([]);
        return;
      }
      setChartLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("fetch-screener-data", {
          body: { symbol: selected.yahoo || selected.symbol, range: chartRange }
        });
        if (!error && data?.success) {
          setChartData(data.chartData || []);
        }
      } catch (e) {
        console.error("Failed to fetch chart data", e);
      } finally {
        setChartLoading(false);
      }
    };
    fetchChartData();
  }, [selected, chartRange]);

  const chartUp = useMemo(() => {
    if (chartData.length < 2) return (selected?.change_pct ?? 0) >= 0;
    return chartData[chartData.length - 1].c >= chartData[0].c;
  }, [chartData, selected]);

  return (
    <>
      <div className={`relative ${className || ""}`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            aria-label="Search any NSE/BSE stock"
            placeholder="Search any NSE/BSE stock..."
            value={query}
            onChange={e => { setQuery(e.target.value); setShowDropdown(true); }}
            onFocus={() => { if (results.length > 0 || exchangeResults.length > 0) setShowDropdown(true); }}
            className="pl-9 pr-20"
          />
          {!query && (
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-muted/60 border border-border/50 rounded text-[10px] font-mono text-muted-foreground pointer-events-none">
              ⌘K
            </kbd>
          )}
          {query && (
            <button onClick={() => { setQuery(""); setResults([]); setExchangeResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
          {searching && <Loader2 className="absolute right-9 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
        </div>

        <AnimatePresence>
          {showDropdown && (results.length > 0 || exchangeResults.length > 0 || (query.length >= 2 && !searching)) && (
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-[400px] overflow-y-auto"
            >
              {results.length > 0 && (
                <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/30 border-b border-border/30">
                  Quick Results
                </div>
              )}
              {results.map(stock => (
                <button
                  key={stock.symbol}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors text-left border-b border-border/30 last:border-0"
                  onClick={() => handleSelect(stock)}
                >
                  <div>
                    <span className="font-semibold text-sm text-foreground">{stock.symbol}</span>
                    <span className="text-xs text-muted-foreground ml-2">{stock.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-foreground">₹{stock.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className={`text-xs font-medium ${stock.change_pct >= 0 ? "text-secondary" : "text-destructive"}`}>
                      {stock.change_pct >= 0 ? "+" : ""}{stock.change_pct.toFixed(2)}%
                    </span>
                  </div>
                </button>
              ))}

              {exchangeResults.length > 0 && (
                <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/30 border-y border-border/30">
                  NSE/BSE Exchange Results
                </div>
              )}
              {exchangeResults.map(stock => (
                <button
                  key={stock.yahoo}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors text-left border-b border-border/30 last:border-0"
                  onClick={() => handleSelect(stock, true)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">{stock.symbol}</span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1 leading-none uppercase">
                        {stock.yahoo.split('.')[1]}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{stock.name}</div>
                  </div>
                  <div className="text-[10px] text-brand-orange font-bold flex items-center gap-1">
                    <Bot className="w-3 h-3" /> ANALYZE
                  </div>
                </button>
              ))}

              {!searching && results.length === 0 && exchangeResults.length === 0 && query.length >= 2 && (
                <div className="p-6 text-center">
                  <Bot className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                  <p className="text-sm text-muted-foreground">No stocks matching "{query}"</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Try a common ticker like RELIANCE, TCS, or MRF.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {showDropdown && query.length > 0 && results.length === 0 && !searching && query.length < 3 && (
          <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg p-4 text-center text-sm text-muted-foreground">
            No stocks found for "{query}". Try entering full ticker.
          </div>
        )}
      </div>

      {/* Stock Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-2xl bg-background/95 backdrop-blur-xl border-border/50 shadow-2xl p-0 overflow-hidden">
          {selected && (
            <div className="flex flex-col h-full max-h-[90vh]">
              {/* Premium Header */}
              <div className="p-6 pb-4 border-b border-border/20 bg-gradient-to-br from-muted/50 to-transparent">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-black tracking-tight text-foreground">{selected.symbol}</span>
                    <Badge variant="secondary" className="bg-brand-orange/10 text-brand-orange border-brand-orange/20 text-[10px] font-bold uppercase tracking-wider">
                      {selected.sector}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelected(null)} className="h-8 w-8 rounded-full opacity-70 hover:opacity-100">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground font-medium">{selected.name}</p>

                {/* Live Price Section */}
                <div className="flex items-end gap-6 mt-6">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Current Price</p>
                    <div className="text-4xl font-bold tracking-tighter text-foreground">
                      ₹{selected.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className={`flex flex-col items-start pb-1 ${selected.change_pct >= 0 ? "text-secondary" : "text-destructive"}`}>
                    <div className="flex items-center gap-1 font-bold text-lg">
                      {selected.change_pct >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                      {selected.change >= 0 ? "+" : ""}{selected.change.toFixed(2)}
                    </div>
                    <div className="text-sm font-semibold">
                      ({selected.change_pct >= 0 ? "+" : ""}{selected.change_pct.toFixed(2)}%)
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {/* Chart Section */}
                <Card className="p-4 bg-muted/20 border-border/30 shadow-none">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1 bg-background/50 p-1 rounded-lg border border-border/20">
                      {TIME_RANGES.map(({ key, label }) => (
                        <Button key={key} variant={chartRange === key ? "secondary" : "ghost"} size="sm"
                          className={`h-7 px-3 text-[10px] font-bold transition-[color,background-color,border-color,box-shadow] ${chartRange === key ? "shadow-sm" : ""}`} onClick={() => setChartRange(key)}>
                          {label}
                        </Button>
                      ))}
                    </div>
                    
                    <div className="flex items-center gap-2">
                       <Button 
                        variant="default" 
                        size="sm" 
                        className="bg-brand-orange hover:bg-brand-orange/90 text-white text-[10px] font-bold h-7 px-4 shadow-lg shadow-brand-orange/20"
                        onClick={() => setAnalyzingStock(selected)}
                      >
                        <Bot className="w-3.5 h-3.5 mr-1.5" /> AI ANALYSIS
                      </Button>

                      <div className="flex items-center gap-1 bg-background/50 p-1 rounded-lg border border-border/20">
                        <button
                          className={`p-1 rounded ${chartMode === "candle" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"}`}
                          onClick={() => setChartMode("candle")}
                        >
                          <CandlestickChart className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className={`p-1 rounded ${chartMode === "line" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"}`}
                          onClick={() => setChartMode("line")}
                        >
                          <LineChart className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-background/40 backdrop-blur-md rounded-lg p-2 border border-border/10">
                    {chartLoading ? (
                      <div className="h-[220px] w-full flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-brand-orange opacity-50" />
                      </div>
                    ) : chartData.length > 1 ? (
                      <PriceChart
                        data={chartData}
                        mode={chartMode === "candle" ? "candle" : "area"}
                        height={220}
                      />
                    ) : (
                      <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground font-medium">
                        Live technical data unavailable for this range
                      </div>
                    )}
                  </div>
                </Card>

                {/* Performance Visualizer (52W Range) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Market Statistics</h3>
                    <div className="grid grid-cols-1 gap-1">
                      {[
                        { label: "Market Cap", value: selected.market_cap > 0 ? formatMarketCap(selected.market_cap) : "-" },
                        { label: "P/E Ratio", value: selected.pe > 0 ? selected.pe.toFixed(2) : "N/A" },
                        { label: "Day Range", value: `₹${selected.day_low.toFixed(1)} - ₹${selected.day_high.toFixed(1)}` },
                        { label: "Volume (24h)", value: selected.volume > 0 ? `${(selected.volume / 1000000).toFixed(2)}M` : "-" },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between items-center px-3 py-2.5 rounded-lg bg-muted/10 border border-transparent hover:border-border/20 transition-colors">
                          <span className="text-xs text-muted-foreground font-medium">{label}</span>
                          <span className="text-xs font-bold text-foreground font-mono">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 text-center md:text-left">
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">52-Week Range</h3>
                    <Card className="p-5 bg-muted/10 border-border/30 flex flex-col justify-center h-[calc(100%-32px)]">
                      <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground mb-4">
                        <div className="flex flex-col items-start gap-1">
                          <span className="uppercase text-[8px] opacity-70">Low</span>
                          <span className="text-foreground">₹{selected.low_52.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="uppercase text-[8px] opacity-70">High</span>
                          <span className="text-foreground">₹{selected.high_52.toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                      <div className="h-3 bg-muted rounded-full relative overflow-hidden shadow-inner">
                        <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-destructive/60 via-brand-orange/60 to-secondary/60"
                          style={{ width: `100%` }} />
                        <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white shadow-xl rounded-full border-2 border-brand-orange z-10"
                          style={{ left: `${Math.min(95, Math.max(5, ((selected.price - selected.low_52) / (selected.high_52 - selected.low_52)) * 100))}%`, transform: "translate(-50%, -50%)" }} />
                      </div>
                      <p className="text-[10px] text-center mt-4 text-muted-foreground font-medium">
                        Stock is trading at <span className="text-foreground font-bold">{Math.round(((selected.price - selected.low_52) / (selected.high_52 - selected.low_52)) * 100)}%</span> of its 52-week range
                      </p>
                    </Card>
                  </div>
                </div>

                {/* Additional Details Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Open", value: selected.open_price },
                    { label: "Prev Close", value: selected.prev_close },
                    { label: "Day High", value: selected.day_high },
                    { label: "Day Low", value: selected.day_low },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-3 bg-muted/5 rounded-xl border border-border/10">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">{label}</p>
                      <p className="text-xs font-bold font-mono text-foreground">₹{value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Footer */}
              <div className="p-4 border-t border-border/20 bg-muted/10 flex items-center justify-between gap-4">
                <p className="text-[10px] text-muted-foreground italic">
                  * Live data provided by Yahoo Finance exchanges. 
                </p>
                <div className="flex items-center gap-2">
                   <Button 
                    variant="outline" 
                    className="h-9 px-6 text-xs font-bold border-border/40 hover:bg-muted"
                    onClick={() => setSelected(null)}
                  >
                    CLOSE
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Lazy: recharts only downloads when an analysis is opened */}
      {analyzingStock && (
        <Suspense fallback={null}>
          <AIAnalysisModal
            isOpen
            onClose={() => setAnalyzingStock(null)}
            stock={{
              name: analyzingStock.name,
              symbol: analyzingStock.symbol,
              price: analyzingStock.price,
              change_pct: analyzingStock.change_pct,
              pe: analyzingStock.pe,
              high_52: analyzingStock.high_52,
              low_52: analyzingStock.low_52,
              day_high: analyzingStock.day_high,
              day_low: analyzingStock.day_low,
              volume: analyzingStock.volume,
              market_cap: analyzingStock.market_cap,
              sector: analyzingStock.sector,
            }}
          />
        </Suspense>
      )}
    </>
  );
};

export default GlobalStockSearch;
