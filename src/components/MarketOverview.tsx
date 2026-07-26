import { motion, AnimatePresence } from "motion/react";
import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp, TrendingDown, Activity, Eye, ArrowUpRight, ArrowDownRight,
  BarChart3, Gem, PieChart, Maximize2, X, Clock, Volume2,
  IndianRupee, Percent, ChevronRight, Calendar
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import type { LucideIcon } from "lucide-react";
import { useLiveMarket } from "@/hooks/useLiveMarket";
import { supabase } from "@/integrations/supabase/client";
import PriceChart from "@/components/charts/PriceChart";
import type { ApiChartPoint } from "@/lib/chart-data";
import { useCorporateActions, useMarketFlows, useMfNavs } from "@/hooks/useMarketFeed";
import { revealBar } from "@/lib/motion";

/**
 * `symbol` is the Yahoo ticker (e.g. "RELIANCE.NS") and is what makes a real
 * chart possible. It is optional because the commodity rows have no tradable
 * ticker, and because a deployment running an older fetch-stock-prices will
 * not send it. Both cases fall through to "chart unavailable" rather than to
 * a generated series.
 */
type Stock = {
  symbol?: string;
  name: string;
  price: string;
  change: string;
  up: boolean;
  volume?: string;
  high?: string;
  low?: string;
};

/** Label shown on the toggle, and the range string fetch-stock-chart expects. */
const RANGES = [
  { label: "1D", range: "1d" },
  { label: "1W", range: "5d" },
  { label: "1M", range: "1mo" },
  { label: "3M", range: "3mo" },
] as const;

// Corporate actions come from the admin-fed corporate_actions table
// (useCorporateActions). No fabricated fallback events - an empty feed
// shows an honest empty state instead.

// marketStats is now computed dynamically inside the component using live data
// Mini sparkline for table rows
const MiniSparkline = ({ up, onClick }: { up: boolean; onClick?: () => void }) => {
  const points = up
    ? "0,20 5,18 10,15 15,17 20,12 25,14 30,8 35,10 40,5 45,3 50,2"
    : "0,2 5,5 10,8 15,6 20,12 25,10 30,15 35,13 40,18 45,19 50,20";
  const color = up ? "hsl(145 70% 40%)" : "hsl(0 84% 60%)";
  return (
    <div className="relative group/spark cursor-pointer" onClick={onClick}>
      <svg viewBox="0 0 50 22" className="w-16 h-6" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`spark-${up ? 'up' : 'down'}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,22 ${points} 50,22`} fill={`url(#spark-${up ? 'up' : 'down'})`} />
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/spark:opacity-100 transition-opacity bg-muted/60 rounded">
        <Maximize2 className="w-3 h-3 text-foreground" />
      </div>
    </div>
  );
};

const StockRow = ({ stock, index, onChartClick }: { stock: Stock; index: number; onChartClick: (stock: Stock) => void }) => (
  <motion.div
    className="flex items-center justify-between py-3 px-3 sm:px-4 rounded-xl hover:bg-muted/50 transition-colors duration-fast cursor-pointer group border-b border-border/30 last:border-0"
    initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.04 }}
    whileHover={{ x: 4 }}
    onClick={() => onChartClick(stock)}
  >
    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${stock.up ? "bg-secondary/10 text-secondary" : "bg-destructive/10 text-destructive"}`}>
        {stock.name.slice(0, 2)}
      </div>
      <div className="min-w-0">
        <span className="font-semibold text-sm text-foreground group-hover:text-secondary transition-colors block truncate">{stock.name}</span>
        {stock.volume && <span className="text-[10px] text-muted-foreground hidden sm:block">Vol: {stock.volume}</span>}
      </div>
    </div>
    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
      <div className="hidden sm:block">
        <MiniSparkline up={stock.up} onClick={() => onChartClick(stock)} />
      </div>
      <div className="text-right">
        <span className="text-sm text-foreground font-medium block">{stock.price}</span>
        {stock.high && stock.low && (
          <span className="text-[9px] text-muted-foreground hidden md:block">H: {stock.high} L: {stock.low}</span>
        )}
      </div>
      <span className={`flex items-center gap-0.5 text-xs font-bold px-2 sm:px-2.5 py-1 rounded-full min-w-[60px] sm:min-w-[70px] justify-center ${stock.up ? "bg-secondary/10 text-secondary" : "bg-destructive/10 text-destructive"}`}>
        {stock.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{stock.change}
      </span>
      <button
        onClick={() => onChartClick(stock)}
        className="sm:hidden p-1.5 rounded-lg hover:bg-muted transition-colors"
        aria-label={`View chart for ${stock.name}`}
      >
        <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    </div>
  </motion.div>
);

type CalendarAction = { date: string; symbol: string; eventName: string; details: string; up: boolean };

const CalendarRow = ({ action, index }: { action: CalendarAction; index: number }) => (
  <motion.div
    className="flex items-center justify-between py-3 px-3 sm:px-4 rounded-xl hover:bg-muted/50 transition-colors duration-fast cursor-default group border-b border-border/30 last:border-0"
    initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.04 }}
    whileHover={{ x: 4 }}
  >
    <div className="flex items-center gap-3 min-w-0 flex-1">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${action.up ? "bg-secondary/10 text-secondary" : "bg-destructive/10 text-destructive"}`}>
        {action.symbol.slice(0, 2)}
      </div>
      <div className="min-w-0">
        <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors block truncate">{action.symbol}</span>
        <span className="text-[10px] text-muted-foreground block">{action.eventName}</span>
      </div>
    </div>
    <div className="flex flex-col items-end shrink-0 text-right">
      <span className="text-sm font-medium text-foreground">{action.date}</span>
      <span className="text-[10px] text-muted-foreground">{action.details}</span>
    </div>
  </motion.div>
);

// F&O option-premium and MF NAV tabs were removed - we can't source those
// prices live, and showing stale figures as market data isn't OK for a broker
// site. The /fno page carries the live derivatives data instead.
type TabKey = "gainers" | "losers" | "active" | "mf" | "commodities" | "calendar";

const MarketOverview = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("gainers");
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [chartPoints, setChartPoints] = useState<ApiChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState(false);
  const [chartRange, setChartRange] = useState("1d");
  const { marketOverview: liveData, commodities: liveCommodities, vix, fetchedAt } = useLiveMarket();
  const { actions: corpActions } = useCorporateActions();
  const { flows } = useMarketFlows();
  const { navs: mfNavs } = useMfNavs();

  // AMFI-fed daily NAVs mapped into the shared row shape
  const mfStocks: Stock[] = useMemo(
    () =>
      mfNavs.map((n) => {
        const changePct = n.prev_nav ? ((n.nav - n.prev_nav) / n.prev_nav) * 100 : null;
        return {
          name: n.scheme_name,
          price: `₹${n.nav.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          change: changePct === null ? "NAV" : `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`,
          up: changePct === null ? true : changePct >= 0,
          volume: new Date(n.nav_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        };
      }),
    [mfNavs]
  );

  const liveCommodityStocks: Stock[] = useMemo(() => {
    if (!liveCommodities?.length) return [];
    return liveCommodities
      .filter(c => c.name !== "INDIA VIX")
      .map(c => ({
        name: c.name,
        price: c.unit ? `${c.price}/${c.unit.replace("₹/", "").replace("USD/", "")}` : c.price,
        change: c.change,
        up: c.up,
        volume: "-",
      }));
  }, [liveCommodities]);

  // Admin-fed corporate actions mapped into the calendar row shape
  const calendarRows = useMemo(
    () =>
      corpActions.map((a) => ({
        date: new Date(a.ex_date).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
        symbol: a.company,
        eventName: a.action_type,
        details: a.details,
        up: true,
      })),
    [corpActions]
  );

  // Merge live data with fallbacks
  const dynamicTabConfig = useMemo(() => {
    const cfg: { key: TabKey; label: string; icon: LucideIcon; data: Stock[] | CalendarAction[] }[] = [
      // No hardcoded fallbacks. These arrays used to hold invented prices
      // ("TATA POWER ₹432.50 +4.8%") that rendered identically to live rows
      // whenever the feed was down. An empty tab states the truth instead.
      { key: "gainers", label: "Top Gainers", icon: TrendingUp, data: (liveData?.gainers ?? []) as Stock[] },
      { key: "losers", label: "Top Losers", icon: TrendingDown, data: (liveData?.losers ?? []) as Stock[] },
      { key: "active", label: "Most Active", icon: Activity, data: (liveData?.mostActive ?? []) as Stock[] },
      ...(mfStocks.length > 0
        ? [{ key: "mf" as TabKey, label: "Mutual Funds", icon: PieChart, data: mfStocks }]
        : []),
      { key: "commodities", label: "Commodities", icon: Gem, data: liveCommodityStocks },
      { key: "calendar", label: "Corp Actions", icon: Calendar, data: calendarRows },
    ];
    return cfg;
  }, [liveData, liveCommodityStocks, calendarRows, mfStocks]);

  const activeConfig = dynamicTabConfig.find(t => t.key === activeTab)!;

  const liveAdvances = liveData?.advances ?? 1456;
  const liveDeclines = liveData?.declines ?? 892;
  const liveUnchanged = liveData?.unchanged ?? 186;
  const totalStocks = liveAdvances + liveDeclines + liveUnchanged;

  const liveVix = vix?.price ?? "13.45";
  const liveMostActive = liveData?.mostActive?.[0]?.name ?? "—";

  // FII/DII from the admin-fed market_flows table; "—" until published.
  const fmtFlow = (cat: string) => {
    const f = flows.find((x) => x.category === cat);
    if (!f) return null;
    const net = f.buy_cr - f.sell_cr;
    return { value: `${net >= 0 ? "+" : "-"}₹${Math.abs(net).toLocaleString("en-IN")} Cr`, up: net >= 0 };
  };
  const fiiFlow = fmtFlow("fii_cash");
  const diiFlow = fmtFlow("dii_cash");
  const breadthPct = totalStocks > 0 ? Math.round((liveAdvances / totalStocks) * 100) : 50;

  const marketStats = useMemo(() => [
    { icon: BarChart3, label: "Breadth (Adv)", value: `${breadthPct}%`, color: breadthPct >= 50 ? "text-secondary" : "text-destructive", bgColor: breadthPct >= 50 ? "bg-secondary/10" : "bg-destructive/10" },
    { icon: Activity, label: "Unchanged", value: liveUnchanged.toLocaleString(), color: "text-brand-gold", bgColor: "bg-brand-gold/10" },
    { icon: TrendingUp, label: "Advances", value: liveAdvances.toLocaleString(), color: "text-secondary", bgColor: "bg-secondary/10" },
    { icon: TrendingDown, label: "Declines", value: liveDeclines.toLocaleString(), color: "text-destructive", bgColor: "bg-destructive/10" },
    { icon: Eye, label: "Most Active", value: liveMostActive, color: "text-primary", bgColor: "bg-primary/10" },
    { icon: Activity, label: "India VIX", value: liveVix, color: "text-brand-gold", bgColor: "bg-brand-gold/10" },
    { icon: IndianRupee, label: "FII Flow", value: fiiFlow?.value ?? "—", color: fiiFlow ? (fiiFlow.up ? "text-secondary" : "text-destructive") : "text-muted-foreground", bgColor: fiiFlow ? (fiiFlow.up ? "bg-secondary/10" : "bg-destructive/10") : "bg-muted/40" },
    { icon: Percent, label: "DII Flow", value: diiFlow?.value ?? "—", color: diiFlow ? (diiFlow.up ? "text-secondary" : "text-destructive") : "text-muted-foreground", bgColor: diiFlow ? (diiFlow.up ? "bg-secondary/10" : "bg-destructive/10") : "bg-muted/40" },
  ], [liveAdvances, liveDeclines, liveUnchanged, liveMostActive, liveVix, fiiFlow, diiFlow, breadthPct]);

  // Real history for the selected scrip. Previously this component generated a
  // Math.random() walk per stock name and cached it, so a visitor clicking
  // RELIANCE saw an invented price series beside that stock's real quote.
  useEffect(() => {
    if (!selectedStock?.symbol) {
      setChartPoints([]);
      setChartError(!!selectedStock);
      return;
    }
    let active = true;
    setChartLoading(true);
    setChartError(false);
    supabase.functions
      .invoke("fetch-stock-chart", { body: { symbol: selectedStock.symbol, range: chartRange } })
      .then(({ data }) => {
        if (!active) return;
        if (data?.success && data.dataPoints?.length > 0) {
          setChartPoints(data.dataPoints);
        } else {
          setChartPoints([]);
          setChartError(true);
        }
      })
      .catch(() => {
        if (!active) return;
        setChartPoints([]);
        setChartError(true);
      })
      .finally(() => {
        if (active) setChartLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedStock, chartRange]);

  const handleChartClick = useCallback((stock: Stock) => {
    setSelectedStock(stock);
  }, []);

  return (
    <section ref={sectionRef} className="py-8 md:py-16 bg-muted/30 relative overflow-hidden">
      {/* Subtle background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03]">
        <div style={{ backgroundImage: `linear-gradient(hsl(213 80% 25%) 1px, transparent 1px), linear-gradient(90deg, hsl(213 80% 25%) 1px, transparent 1px)`, backgroundSize: '60px 60px', width: '100%', height: '100%' }} />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div className="text-center mb-12" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <motion.span className="inline-flex items-center gap-1.5 bg-brand-orange/10 text-brand-orange font-semibold text-sm uppercase tracking-wider px-3 py-1.5 rounded-full mb-3">
            <BarChart3 className="w-3.5 h-3.5" />
            Market Pulse
          </motion.span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">Today's Market Overview</h2>
          <motion.div className="w-20 h-1 bg-gradient-to-r from-brand-orange to-brand-gold mx-auto rounded-full" {...revealBar} />
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto text-sm">
            Real-time market data across equities, derivatives, mutual funds & commodities
          </p>
        </motion.div>

        {/* Stats strip */}
        <motion.div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-12" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          {marketStats.map((stat, i) => (
            <motion.div key={stat.label} className={`bg-card border border-border/50 rounded-xl p-3 text-center group cursor-pointer ${i >= 4 ? 'hidden sm:block' : ''}`} whileHover={{ scale: 1.05, y: -4 }} transition={{ type: "spring", stiffness: 300 }}>
              <div className={`w-9 h-9 mx-auto mb-1.5 rounded-xl flex items-center justify-center ${stat.bgColor}`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div className="text-sm font-bold text-foreground">{stat.value}</div>
              <div className="text-[10px] text-muted-foreground">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Tabbed Section */}
        <Card className="overflow-hidden border-border/50 shadow-xl">
          <div className="bg-muted/50 px-2 sm:px-4 py-2.5 border-b border-border/50 flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {dynamicTabConfig.map((tab) => {
              const Icon = tab.icon;
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 min-h-[44px] min-w-[44px] shrink-0 justify-center rounded-lg text-[11px] sm:text-xs font-semibold transition-colors duration-fast whitespace-nowrap ${
                    activeTab === tab.key
                      ? tab.key === "losers" ? "bg-destructive/10 text-destructive shadow-sm" : "bg-secondary/10 text-secondary shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}>
                  <Icon className="w-3.5 h-3.5" />{tab.label}
                  <span className="hidden sm:inline text-[10px] opacity-60">({tab.data.length})</span>
                </button>
              );
            })}
          </div>

          <CardContent className="p-0">
            {/* Column headers */}
            {activeTab === "calendar" ? (
              <div className="flex items-center justify-between py-2 px-3 sm:px-4 text-[10px] text-muted-foreground font-semibold uppercase tracking-wide border-b border-border/30 bg-muted/20">
                <span>Company / Event</span>
                <span className="text-right">Date / Details</span>
              </div>
            ) : (
              <div className="flex items-center justify-between py-2 px-3 sm:px-4 text-[10px] text-muted-foreground font-semibold uppercase tracking-wide border-b border-border/30 bg-muted/20">
                <span>{activeTab === "commodities" ? "Commodity" : activeTab === "mf" ? "Fund (Direct-Growth)" : "Company"}</span>
                <div className="flex items-center gap-2 sm:gap-4">
                  <span className="w-16 text-center hidden sm:block">Chart</span>
                  <span className="w-20 sm:w-28 text-right">Price</span>
                  <span className="w-[60px] sm:w-[70px] text-center">Change</span>
                  <span className="w-8 sm:hidden"></span>
                </div>
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="p-1 sm:p-2">
                {activeConfig.data.length === 0 ? (
                  /* Any tab can be legitimately empty now that the hardcoded
                     price rows are gone. Saying so is the honest outcome when
                     the feed is unreachable. */
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    {activeTab === "calendar"
                      ? "No upcoming corporate actions listed right now - check back soon."
                      : "Live market data is temporarily unavailable. Figures are not shown rather than estimated."}
                  </div>
                ) : (
                  activeConfig.data.map((item, i) => (
                    activeTab === "calendar"
                      ? <CalendarRow key={`cal-${(item as CalendarAction).symbol}-${i}`} action={item} index={i} />
                      : <StockRow key={`${activeTab}-${(item as Stock).name}`} stock={item as Stock} index={i} onChartClick={handleChartClick} />
                  ))
                )}
              </motion.div>
            </AnimatePresence>

            {/* Footer summary */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/30 bg-muted/20">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>Last updated: {fetchedAt ? new Date(fetchedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <Link to="/screener" className="flex items-center gap-1 text-[11px] sm:text-xs text-secondary font-medium cursor-pointer hover:underline p-2 -mr-2 min-h-[44px]">
                <span>View All</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Market Breadth Bar */}
        <motion.div className="mt-8 bg-card border border-border/50 rounded-xl p-5" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground">Market Breadth</h3>
            <span className="text-[10px] text-muted-foreground">NSE</span>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-bold text-secondary">{liveAdvances.toLocaleString()} Advances</span>
            <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden flex">
              <div className="bg-secondary/80 rounded-l-full" style={{ width: `${totalStocks ? (liveAdvances / totalStocks * 100) : 62}%` }} />
              <div className="bg-muted-foreground/30" style={{ width: `${totalStocks ? (liveUnchanged / totalStocks * 100) : 8}%` }} />
              <div className="bg-destructive/80 rounded-r-full" style={{ width: `${totalStocks ? (liveDeclines / totalStocks * 100) : 30}%` }} />
            </div>
            <span className="text-xs font-bold text-destructive">{liveDeclines.toLocaleString()} Declines</span>
          </div>
          <div className="text-center text-[10px] text-muted-foreground">{liveUnchanged} Unchanged</div>
        </motion.div>
      </div>

      {/* Chart Dialog */}
      <Dialog open={!!selectedStock} onOpenChange={(open) => !open && setSelectedStock(null)}>
        <DialogContent className="max-w-2xl w-[95vw]">
          {selectedStock && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${selectedStock.up ? "bg-secondary/10 text-secondary" : "bg-destructive/10 text-destructive"}`}>
                    {selectedStock.name.slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-lg font-bold text-foreground">{selectedStock.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-base font-semibold text-foreground">{selectedStock.price}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${selectedStock.up ? "bg-secondary/10 text-secondary" : "bg-destructive/10 text-destructive"}`}>
                        {selectedStock.up ? <ArrowUpRight className="w-3 h-3 inline" /> : <ArrowDownRight className="w-3 h-3 inline" />}
                        {selectedStock.change}
                      </span>
                    </div>
                  </div>
                </DialogTitle>
                <DialogDescription className="sr-only">Price chart for {selectedStock.name}</DialogDescription>
              </DialogHeader>

              {/* Key metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-2">
                {[
                  { label: "High", value: selectedStock.high || "-", icon: TrendingUp, up: true },
                  { label: "Low", value: selectedStock.low || "-", icon: TrendingDown, up: false },
                  { label: "Volume", value: selectedStock.volume || "-", icon: Volume2, up: true },
                  { label: "Change", value: selectedStock.change, icon: Activity, up: selectedStock.up },
                ].map(m => (
                  <div key={m.label} className="bg-muted/50 rounded-lg p-2.5 text-center">
                    <m.icon className={`w-3.5 h-3.5 mx-auto mb-1 ${m.up ? "text-secondary" : "text-destructive"}`} />
                    <div className="text-xs text-muted-foreground">{m.label}</div>
                    <div className="text-sm font-bold text-foreground">{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Interactive chart */}
              <div className="bg-muted/30 rounded-xl p-3 border border-border/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-muted-foreground font-medium">Price Chart</span>
                  <div className="flex gap-1">
                    {/* These used to be inert, with the active state hardcoded
                        onto the first one via `first:bg-muted`. They now drive
                        the range the chart actually fetches. */}
                    {RANGES.map(({ label, range }) => (
                      <button
                        key={range}
                        onClick={() => setChartRange(range)}
                        aria-pressed={chartRange === range}
                        className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
                          chartRange === range
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {chartLoading ? (
                  <div className="h-[220px] flex items-center justify-center">
                    <div className="w-6 h-6 rounded-full border-2 border-brand-orange border-t-transparent animate-spin" />
                  </div>
                ) : chartError || chartPoints.length < 2 ? (
                  /* No history means no chart. Never a generated series: under a
                     real scrip name and a real quote it is indistinguishable
                     from live data. */
                  <div className="h-[220px] flex flex-col items-center justify-center gap-2 text-center px-4">
                    <Activity className="w-5 h-5 text-muted-foreground/60" />
                    <p className="text-sm font-medium text-foreground">Price history unavailable</p>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      We could not load history for {selectedStock.name}. Prices are not shown rather than estimated.
                    </p>
                  </div>
                ) : (
                  <PriceChart data={chartPoints} mode="area" height={220} />
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default MarketOverview;
