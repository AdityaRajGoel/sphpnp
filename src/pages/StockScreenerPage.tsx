import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useT } from "@/i18n/LanguageContext";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import SEOHead from "@/components/SEOHead";
import WhatsAppButton from "@/components/WhatsAppButton";
import ScrollProgress from "@/components/ScrollProgress";
import { useState, useMemo, useEffect, useRef, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, Filter, TrendingUp, TrendingDown, ArrowUpDown, RefreshCw, Loader2, BarChart3, Bot, LayoutGrid, List, Landmark, Cpu, Car, Building2, ShoppingCart, Activity, Zap, PiggyBank, Radar, X, Download, LineChart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "react-router-dom";
import { useScreenerStocks, type ScreenerStock } from "@/hooks/useScreenerStocks";
import { useBhavcopy, buildDeliveryMap } from "@/hooks/useBhavcopy";
import { useLiveMarket } from "@/hooks/useLiveMarket";
import StockHeatmap from "@/components/StockHeatmap";
import GlobalStockSearch from "@/components/GlobalStockSearch";
import MarketMovers from "@/components/MarketMovers";
import BulkBlockDeals from "@/components/BulkBlockDeals";
import CircuitWatch from "@/components/CircuitWatch";
import PageTransition from "@/components/PageTransition";
import { EASE_IN_OUT, EASE_OUT } from "@/lib/motion";
const AIAnalysisModal = lazy(() => import("@/components/AIAnalysisModal"));
const ChartCompare = lazy(() => import("@/components/ChartCompare"));

const MAX_COMPARE = 4;

const THEMATIC_BASKETS = [
  { id: "banking", name: "Banking & Finance", desc: "Top private & PSU banks", icon: Landmark, filter: (s: ScreenerStock) => s.sector === "Banking" || s.sector === "NBFC" || s.sector === "Insurance" },
  { id: "it", name: "IT Leaders", desc: "India's tech giants", icon: Cpu, filter: (s: ScreenerStock) => s.sector === "IT" },
  { id: "auto", name: "Auto & EV", desc: "Automobile stocks", icon: Car, filter: (s: ScreenerStock) => s.sector === "Auto" },
  { id: "psu", name: "PSU Momentum", desc: "Public sector entities", icon: Building2, filter: (s: ScreenerStock) => ["SBIN", "BANKBARODA", "PNB", "CANBK", "UNIONBANK", "COALINDIA", "NTPC", "POWERGRID", "ONGC", "IOC", "BPCL", "GAIL", "NHPC", "HAL", "BEL", "BHEL", "IRFC", "RECLTD", "PFC", "CONCOR", "NMDC", "SAIL", "NATIONALUM"].includes(s.symbol) },
  { id: "fmcg", name: "FMCG Staples", desc: "Everyday consumer goods", icon: ShoppingCart, filter: (s: ScreenerStock) => s.sector === "FMCG" },
];

const TECHNICAL_SCANNERS = [
  { id: "vol_shocker", name: "Volume Shockers", desc: "Unusual high volume today", icon: Activity, filter: (s: ScreenerStock) => s.volume > 5000000 && Math.abs(s.change_pct) > 2 },
  { id: "52w_high", name: "52W High Breakout", desc: "Trading near 52-week high", icon: TrendingUp, filter: (s: ScreenerStock) => s.price >= s.high_52 * 0.95 && s.high_52 > 0 },
  { id: "52w_low", name: "52W Low Breakdown", desc: "Trading near 52-week low", icon: TrendingDown, filter: (s: ScreenerStock) => s.price <= s.low_52 * 1.05 && s.low_52 > 0 },
  { id: "momentum", name: "High Momentum", desc: "Strong intraday trend", icon: Zap, filter: (s: ScreenerStock) => s.change_pct > 4 },
  { id: "value_buy", name: "Value Buys", desc: "Low P/E & profitable", icon: PiggyBank, filter: (s: ScreenerStock) => s.pe > 0 && s.pe < 15 && s.market_cap > 5000 },
];

const formatMarketCap = (cr: number) => {
  if (cr >= 100000) return `₹${(cr / 100000).toFixed(1)}L Cr`;
  if (cr >= 1000) return `₹${(cr / 1000).toFixed(0)}K Cr`;
  if (cr > 0) return `₹${cr.toFixed(0)} Cr`;
  return "-";
};

type SortKey = "symbol" | "price" | "change_pct" | "market_cap" | "pe";

// Download the current filtered view as CSV
const exportCsv = (rows: ScreenerStock[]) => {
  const header = "Symbol,Name,Sector,Price,Change %,Market Cap (Cr),P/E,52W High,52W Low,Volume";
  const body = rows.map(s =>
    [s.symbol, `"${s.name.replace(/"/g, '""')}"`, s.sector, s.price, s.change_pct, s.market_cap, s.pe, s.high_52, s.low_52, s.volume].join(",")
  );
  const blob = new Blob([[header, ...body].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `parasram-screener-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

/** Animated candlestick loading skeleton */
const StockLoadingAnimation = () => {
  const bars = Array.from({ length: 12 });
  return (
    <div className="flex flex-col items-center justify-center py-10 md:py-20 gap-6">
      <div className="flex items-end gap-1.5 h-24">
        {bars.map((_, i) => {
          const h = 30 + Math.random() * 60;
          const isGreen = Math.random() > 0.4;
          return (
            <motion.div
              key={i}
              className={`w-3 rounded-sm ${isGreen ? "bg-secondary/70" : "bg-destructive/70"}`}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: h, opacity: [0, 1, 0.7, 1] }}
              transition={{
                height: { duration: 0.6, delay: i * 0.08, ease: EASE_OUT },
                opacity: { duration: 1.5, delay: i * 0.08, repeat: Infinity, repeatType: "reverse" },
              }}
            />
          );
        })}
      </div>
      <div className="flex flex-col items-center gap-2">
        <motion.div
          className="flex items-center gap-2 text-muted-foreground"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-sm font-medium">Loading market data...</span>
        </motion.div>
        <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-secondary via-primary to-destructive rounded-full"
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ duration: 1.5, repeat: Infinity, ease: EASE_IN_OUT }}
            style={{ width: "60%" }}
          />
        </div>
      </div>
    </div>
  );
};

/** Row skeleton for table */
const TableRowSkeleton = ({ index }: { index: number }) => (
  <motion.tr
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.05 }}
    className="border-b border-border/50"
  >
    {[32, 20, 16, 20, 12, 40, 16, 14].map((w, j) => (
      <td key={j} className="px-4 py-3">
        <motion.div
          className={`h-5 bg-muted rounded ${j === 6 ? "ml-auto" : ""}`}
          style={{ width: `${w * 4}px`, maxWidth: "100%" }}
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: j * 0.1 }}
        />
      </td>
    ))}
  </motion.tr>
);

// Exchange-homepage-style market snapshot: index strip + market breadth + status.
const MarketSnapshot = () => {
  const { indices, marketOverview, marketOpen, marketStatusText } = useLiveMarket();
  const adv = marketOverview?.advances ?? 0;
  const dec = marketOverview?.declines ?? 0;
  const advPct = adv + dec > 0 ? (adv / (adv + dec)) * 100 : 50;

  return (
    <div className="mb-6 rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${marketOpen ? "bg-secondary animate-pulse" : "bg-muted-foreground"}`} />
          <span className="text-xs font-semibold text-foreground">
            {marketStatusText || (marketOpen ? "Market Open" : "Market Closed")}
          </span>
        </div>
        {adv + dec > 0 && (
          <div className="hidden sm:flex items-center gap-2 text-xs" title="Advances vs Declines">
            <span className="text-secondary font-semibold">{adv} Adv</span>
            <div className="w-24 h-1.5 rounded-full bg-destructive/40 overflow-hidden">
              <div className="h-full bg-secondary/70" style={{ width: `${advPct}%` }} />
            </div>
            <span className="text-destructive font-semibold">{dec} Dec</span>
          </div>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mb-1">
        {indices.map((idx) => (
          <div key={idx.key ?? idx.name} className="shrink-0 rounded-xl bg-muted/40 px-3 py-2 min-w-[118px]">
            <div className="text-[10px] text-muted-foreground font-medium truncate">{idx.name}</div>
            <div className="text-sm font-bold font-mono text-foreground">{idx.price}</div>
            <div className={`text-[10px] font-semibold ${idx.up ? "text-secondary" : "text-destructive"}`}>{idx.change}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const StockScreenerPage = () => {
  const { t } = useT();
  const { stocks, loading, refreshing: bgRefreshing, updatedAt, error, refresh } = useScreenerStocks();
  // Delivery % per symbol from the daily EOD bhavcopy (empty until the pipeline is deployed).
  const { rows: bhavRows, asOf: bhavAsOf, loading: bhavLoading } = useBhavcopy();
  const deliveryMap = useMemo(() => buildDeliveryMap(bhavRows), [bhavRows]);
  // Filters live in the URL so a configured screen can be shared/bookmarked.
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [sector, setSector] = useState(searchParams.get("sector") ?? "all");
  const [peRange, setPeRange] = useState(searchParams.get("pe") ?? "all");
  const [capRange, setCapRange] = useState(searchParams.get("cap") ?? "all");
  const [sortKey, setSortKey] = useState<SortKey>((searchParams.get("sort") as SortKey) || "market_cap");
  const [sortDir, setSortDir] = useState<"asc" | "desc">(searchParams.get("dir") === "asc" ? "asc" : "desc");
  const [refreshing, setRefreshing] = useState(false);
  const [analyzingStock, setAnalyzingStock] = useState<ScreenerStock | null>(null);
  const [activeBasket, setActiveBasket] = useState<string | null>(searchParams.get("basket"));
  const [activeScanner, setActiveScanner] = useState<string | null>(searchParams.get("scan"));
  const [viewMode, setViewMode] = useState<"list" | "heatmap" | "chart">("list");
  const [compareSymbols, setCompareSymbols] = useState<string[]>([]);

  // Seed the chart comparison with the two largest-cap stocks the first time
  // data arrives, so the Chart tab is never empty on first open.
  const seededCompare = useRef(false);
  useEffect(() => {
    if (seededCompare.current || stocks.length === 0) return;
    seededCompare.current = true;
    const topByCap = [...stocks].sort((a, b) => b.market_cap - a.market_cap).slice(0, 2).map(s => s.symbol);
    setCompareSymbols(topByCap);
  }, [stocks]);

  // Universe for the chart's search box (symbol + name), largest-cap first.
  const compareUniverse = useMemo(
    () => [...stocks].sort((a, b) => b.market_cap - a.market_cap).map(s => ({ symbol: s.symbol, name: s.name })),
    [stocks],
  );

  const addToChart = (symbol: string) => {
    setCompareSymbols(prev => (prev.includes(symbol) ? prev : [...prev, symbol].slice(0, MAX_COMPARE)));
    setViewMode("chart");
  };

  // Reflect filters into the URL (replace - no history spam)
  useEffect(() => {
    const p = new URLSearchParams();
    if (search) p.set("q", search);
    if (sector !== "all") p.set("sector", sector);
    if (peRange !== "all") p.set("pe", peRange);
    if (capRange !== "all") p.set("cap", capRange);
    if (sortKey !== "market_cap") p.set("sort", sortKey);
    if (sortDir !== "desc") p.set("dir", sortDir);
    if (activeBasket) p.set("basket", activeBasket);
    if (activeScanner) p.set("scan", activeScanner);
    setSearchParams(p, { replace: true });
  }, [search, sector, peRange, capRange, sortKey, sortDir, activeBasket, activeScanner, setSearchParams]);

  const activeFilterCount =
    (search ? 1 : 0) + (sector !== "all" ? 1 : 0) + (peRange !== "all" ? 1 : 0) +
    (capRange !== "all" ? 1 : 0) + (activeBasket ? 1 : 0) + (activeScanner ? 1 : 0);

  const clearAllFilters = () => {
    setSearch(""); setSector("all"); setPeRange("all"); setCapRange("all");
    setActiveBasket(null); setActiveScanner(null);
  };

  const sectors = useMemo(() => [...new Set(stocks.map(s => s.sector))].sort(), [stocks]);

  const filtered = useMemo(() => {
    let list = [...stocks];
    if (search) list = list.filter(s => s.symbol.toLowerCase().includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase()));
    if (sector !== "all") list = list.filter(s => s.sector === sector);
    if (peRange === "low") list = list.filter(s => s.pe > 0 && s.pe < 20);
    else if (peRange === "mid") list = list.filter(s => s.pe >= 20 && s.pe <= 40);
    else if (peRange === "high") list = list.filter(s => s.pe > 40);
    if (capRange === "large") list = list.filter(s => s.market_cap >= 50000);
    else if (capRange === "mid") list = list.filter(s => s.market_cap >= 10000 && s.market_cap < 50000);
    else if (capRange === "small") list = list.filter(s => s.market_cap > 0 && s.market_cap < 10000);

    if (activeBasket) {
      const basket = THEMATIC_BASKETS.find(b => b.id === activeBasket);
      if (basket) list = list.filter(basket.filter);
    }
    if (activeScanner) {
      const scanner = TECHNICAL_SCANNERS.find(s => s.id === activeScanner);
      if (scanner) list = list.filter(scanner.filter);
    }

    list.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return list;
  }, [stocks, search, sector, peRange, capRange, sortKey, sortDir, activeBasket, activeScanner]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <PageTransition>
    <div className="min-h-screen bg-background">
      <SEOHead 
        title="Stock Screener | Live NSE BSE Stocks | Parasram India Panipat"
        description="Screen and filter live Indian stocks by sector, market cap, P/E ratio, 52-week high/low range. Free real-time stock screener by Parasram India Panipat."
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Stock Screener" },
        ]}
        jsonLd={{
          "@type": "WebApplication",
          "name": "Stock Screener - Parasram India",
          "description": "Free live Indian stock screener. Filter NSE/BSE stocks by sector, market cap, P/E ratio, and 52-week range with real-time Yahoo Finance prices.",
          "applicationCategory": "FinanceApplication",
          "operatingSystem": "Web Browser",
          "url": "https://www.sphpnp.com/screener",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "INR" },
          "provider": {
            "@type": "Organization",
            "name": "Shri Parasram Holdings Panipat",
            "url": "https://www.sphpnp.com"
          },
          "featureList": [
            "Live NSE/BSE stock prices",
            "Filter by sector, market cap, P/E ratio",
            "52-week high/low range display",
            "Thematic baskets - Banking, IT, Auto, PSU, FMCG",
            "Technical scanners - Volume Shockers, Momentum, Value Buys",
            "Stock heatmap view",
            "Multi-stock chart comparison with SMA & RSI indicators",
            "AI-powered stock analysis"
          ]
        }}
      />
      <ScrollProgress />
      <Header />
      <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Stock Screener" }]} />
      <main className="container mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-2">{t("page.screener")}</h1>
            <p className="text-muted-foreground">Live prices for {stocks.length}+ NSE stocks • Filter by sector, market cap, P/E & more</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {updatedAt && (
              <span className="text-xs text-muted-foreground">
                Updated {new Date(updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-8 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5 mr-1" /> Clear filters ({activeFilterCount})
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => exportCsv(filtered)} disabled={filtered.length === 0}>
              <Download className="w-4 h-4" />
              <span className="ml-1.5">CSV</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="ml-1.5">Refresh</span>
            </Button>
          </div>
        </motion.div>

        {/* Exchange-style market snapshot */}
        <MarketSnapshot />

        {/* Exchange-homepage-style movers board */}
        {!loading && stocks.length > 0 && (
          <MarketMovers stocks={stocks} onPick={addToChart} />
        )}

        {/* EOD smart-money boards: bulk/block deals + circuit hitters */}
        <div className="grid md:grid-cols-2 gap-6 mb-8 empty:hidden">
          <BulkBlockDeals />
          <CircuitWatch rows={bhavRows} asOf={bhavAsOf} loading={bhavLoading} />
        </div>

        {/* Global Stock Search */}
        <GlobalStockSearch className="mb-6" />

        {/* Thematic Baskets */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-heading font-bold flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-brand-orange" />
              Thematic Baskets
            </h2>
            {activeBasket && (
              <Button variant="ghost" size="sm" onClick={() => setActiveBasket(null)} className="h-8 text-muted-foreground hover:text-foreground">
                Clear Selection
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {THEMATIC_BASKETS.map(b => {
              const Icon = b.icon;
              const isActive = activeBasket === b.id;
              return (
                <Card 
                  key={b.id} 
                  className={`p-4 flex flex-col cursor-pointer transition-transform ease-out hover:scale-[1.02] active:scale-[0.97] ${isActive ? "ring-2 ring-brand-orange bg-brand-orange/5 border-brand-orange/50" : "hover:border-primary/50"}`}
                  onClick={() => setActiveBasket(isActive ? null : b.id)}
                >
                  <Icon className={`w-6 h-6 mb-3 ${isActive ? "text-brand-orange" : "text-muted-foreground"}`} />
                  <h3 className="font-semibold text-sm mb-1 text-foreground">{b.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">{b.desc}</p>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Technical Scanners */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-heading font-bold flex items-center gap-2">
              <Radar className="w-5 h-5 text-secondary" />
              Technical Scanners
            </h2>
            {activeScanner && (
              <Button variant="ghost" size="sm" onClick={() => setActiveScanner(null)} className="h-8 text-muted-foreground hover:text-foreground">
                Clear Selection
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {TECHNICAL_SCANNERS.map(s => {
              const Icon = s.icon;
              const isActive = activeScanner === s.id;
              return (
                <Card 
                  key={s.id} 
                  className={`p-4 flex flex-col cursor-pointer transition-transform ease-out hover:scale-[1.02] active:scale-[0.97] ${isActive ? "ring-2 ring-secondary bg-secondary/5 border-secondary/50" : "hover:border-primary/50"}`}
                  onClick={() => setActiveScanner(isActive ? null : s.id)}
                >
                  <Icon className={`w-6 h-6 mb-3 ${isActive ? "text-secondary" : "text-muted-foreground"}`} />
                  <h3 className="font-semibold text-sm mb-1 text-foreground">{s.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">{s.desc}</p>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
            <Filter className="w-4 h-4" /> Filters
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input aria-label="Search stock" placeholder="Search stock..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={sector} onValueChange={setSector}>
              <SelectTrigger aria-label="Select Sector"><SelectValue placeholder="Sector" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sectors</SelectItem>
                {sectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={peRange} onValueChange={setPeRange}>
              <SelectTrigger aria-label="Select P/E Ratio"><SelectValue placeholder="P/E Ratio" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All P/E</SelectItem>
                <SelectItem value="low">Low (&lt;20)</SelectItem>
                <SelectItem value="mid">Mid (20-40)</SelectItem>
                <SelectItem value="high">High (&gt;40)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={capRange} onValueChange={setCapRange}>
              <SelectTrigger aria-label="Select Market Cap"><SelectValue placeholder="Market Cap" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Caps</SelectItem>
                <SelectItem value="large">Large Cap (₹50K+ Cr)</SelectItem>
                <SelectItem value="mid">Mid Cap (₹10K-50K Cr)</SelectItem>
                <SelectItem value="small">Small Cap (&lt;₹10K Cr)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Heatmap (Moved inside View Toggles) */}

        {error && (
          <Card className="p-4 mb-4 border-destructive/50 bg-destructive/5">
            <p className="text-sm text-destructive">⚠️ {error}. Showing cached data if available.</p>
          </Card>
        )}

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <StockLoadingAnimation />
            </motion.div>
          ) : (
            <motion.div key="content" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  {filtered.length > 0
                    ? `${filtered.length} stocks matching criteria`
                    : "No stocks match your filters - try clearing search or changing the sector"}
                  {bgRefreshing && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-brand-orange animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" /> Refreshing prices...
                    </span>
                  )}
                </p>
                
                {/* View Toggles */}
                <div className="flex bg-muted rounded-lg p-1 self-start sm:self-auto">
                  <button 
                    onClick={() => setViewMode("list")} 
                    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-2 ${viewMode === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <List className="w-4 h-4" /> List
                  </button>
                  <button
                    onClick={() => setViewMode("heatmap")}
                    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-2 ${viewMode === "heatmap" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <LayoutGrid className="w-4 h-4" /> Heatmap
                  </button>
                  <button
                    onClick={() => setViewMode("chart")}
                    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-2 ${viewMode === "chart" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <LineChart className="w-4 h-4" /> Chart
                  </button>
                </div>
              </div>

              {viewMode === "chart" ? (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="min-h-[50vh]">
                  <Suspense fallback={<StockLoadingAnimation />}>
                    <ChartCompare stocks={compareUniverse} selected={compareSymbols} onChange={setCompareSymbols} />
                  </Suspense>
                </motion.div>
              ) : viewMode === "heatmap" ? (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="min-h-[50vh]">
                  <StockHeatmap stocks={filtered} maxItems={150} />
                </motion.div>
              ) : (
              <Card className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm">
                    <tr className="border-b border-border bg-muted/50">
                      {([["symbol", "Stock"], ["price", "Price"], ["change_pct", "Change"], ["market_cap", "Market Cap"], ["pe", "P/E"]] as [SortKey, string][]).map(([key, label]) => (
                        <th key={key} className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort(key)}>
                          <span className="inline-flex items-center gap-1">{label} <ArrowUpDown className="w-3 h-3" /></span>
                        </th>
                      ))}
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">52W Range</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Volume</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground" title="Delivery % (EOD)">Deliv %</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s, i) => {
                      const range = s.high_52 - s.low_52;
                      const pct52 = range > 0 ? ((s.price - s.low_52) / range) * 100 : 50;
                      return (
                        <motion.tr key={s.symbol} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.01 }} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-foreground">{s.symbol}</div>
                            <div className="text-xs text-muted-foreground">{s.name}</div>
                          </td>
                          <td className="px-4 py-3 font-mono font-medium text-foreground">₹{s.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 font-medium ${s.change_pct >= 0 ? "text-secondary" : "text-destructive"}`}>
                              {s.change_pct >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                              {s.change_pct >= 0 ? "+" : ""}{s.change_pct.toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-foreground">{formatMarketCap(s.market_cap)}</td>
                          <td className="px-4 py-3">
                            {s.pe > 0 ? (
                              <Badge variant={s.pe < 20 ? "default" : s.pe <= 40 ? "secondary" : "outline"} className="text-xs">{s.pe.toFixed(1)}</Badge>
                            ) : <span className="text-muted-foreground text-xs">-</span>}
                          </td>
                          <td className="px-4 py-3 min-w-[180px]">
                            {s.high_52 > 0 ? (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>₹{s.low_52.toLocaleString("en-IN")}</span>
                                <div className="flex-1 h-1.5 bg-muted rounded-full relative">
                                  <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-destructive to-secondary rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct52))}%` }} />
                                </div>
                                <span>₹{s.high_52.toLocaleString("en-IN")}</span>
                              </div>
                            ) : <span className="text-muted-foreground text-xs">-</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                            {s.volume > 0 ? `${(s.volume / 1000000).toFixed(1)}M` : "-"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {deliveryMap[s.symbol] != null
                              ? <span className={deliveryMap[s.symbol] >= 60 ? "text-secondary font-semibold" : "text-muted-foreground"}>{deliveryMap[s.symbol].toFixed(1)}%</span>
                              : <span className="text-muted-foreground text-xs">-</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                title={compareSymbols.includes(s.symbol) ? "In chart comparison" : "Add to chart comparison"}
                                aria-label={`Add ${s.symbol} to chart comparison`}
                                className={`border-primary/30 bg-transparent min-h-[44px] md:min-h-0 md:h-8 w-9 p-0 ${compareSymbols.includes(s.symbol) ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
                                onClick={(e) => { e.stopPropagation(); addToChart(s.symbol); }}
                              >
                                <LineChart className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-brand-orange border-brand-orange/30 hover:bg-brand-orange/10 bg-transparent text-xs min-h-[44px] md:min-h-0 md:h-8 px-3"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAnalyzingStock(s);
                                }}
                              >
                                <Bot className="w-3.5 h-3.5 mr-1" /> AI Edit
                              </Button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
              )}

              <p className="text-xs text-muted-foreground mt-4 text-center">
                Live data from Yahoo Finance. Prices may be delayed by up to 15 minutes. Auto-refreshes every 5 minutes.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

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
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  </PageTransition>
  );
};

export default StockScreenerPage;
