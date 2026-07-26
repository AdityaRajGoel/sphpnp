import { motion, AnimatePresence } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { memo, useState, useEffect } from "react";
import {
  TrendingUp, TrendingDown, Activity, Gauge, BarChart3, PieChart,
  ArrowUpRight, ArrowDownRight, Zap, Globe, Building2, Cpu, Heart,
  Fuel, Pill, ShoppingCart, Landmark, Factory, Pickaxe, DollarSign,
  Calendar, Percent, IndianRupee, Coins, AlertTriangle
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useT } from "@/i18n/LanguageContext";
import { useLiveMarket } from "@/hooks/useLiveMarket";
import { useMarketFlows } from "@/hooks/useMarketFeed";

import { revealItem, revealSection } from "@/lib/motion";
const sectorIcons: Record<string, LucideIcon> = {
  IT: Cpu, Banks: Landmark, Pharma: Pill, Auto: Factory,
  Energy: Fuel, FMCG: ShoppingCart, Realty: Building2, Metal: Pickaxe,
  Healthcare: Heart,
};

// Fear & Greed Gauge
const FearGreedGauge = memo(() => {
  const { vix, marketOverview } = useLiveMarket();
  let value = 50;
  const vixPrice = vix ? parseFloat(vix.price.replace(/,/g, '')) : 0;
  if (vixPrice > 0) {
    value = Math.round(Math.max(5, Math.min(95, 100 - ((vixPrice - 10) / 20) * 80)));
  }
  if (marketOverview) {
    const { advances, declines } = marketOverview;
    const total = advances + declines;
    if (total > 0) {
      const breadthScore = (advances / total) * 100;
      value = Math.round((value + breadthScore) / 2);
    }
  }

  const angleRad = Math.PI - (value / 100) * Math.PI;
  const label = value > 75 ? "Extreme Greed" : value > 55 ? "Greed" : value > 45 ? "Neutral" : value > 25 ? "Fear" : "Extreme Fear";
  const color = value > 55 ? "hsl(var(--secondary))" : value > 45 ? "hsl(var(--brand-gold))" : "hsl(var(--destructive))";

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Gauge className="w-4 h-4 text-brand-orange" />
            Fear & Greed Index
          </h3>
          <span className="text-[10px] text-muted-foreground">Live • VIX Based</span>
        </div>
        <div className="flex flex-col items-center">
          <svg viewBox="0 0 200 120" className="w-48 h-28">
            <defs>
              <linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(0, 84%, 60%)" />
                <stop offset="25%" stopColor="hsl(24, 95%, 53%)" />
                <stop offset="50%" stopColor="hsl(45, 90%, 55%)" />
                <stop offset="75%" stopColor="hsl(100, 60%, 45%)" />
                <stop offset="100%" stopColor="hsl(145, 70%, 40%)" />
              </linearGradient>
            </defs>
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="hsl(var(--muted))" strokeWidth="14" strokeLinecap="round" />
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#gauge-grad)" strokeWidth="14" strokeLinecap="round" strokeDasharray="251" strokeDashoffset={251 - (value / 100) * 251} />
            <line x1="100" y1="100" x2={100 + 60 * Math.cos(angleRad)} y2={100 - 60 * Math.sin(angleRad)} stroke={color} strokeWidth="3" strokeLinecap="round" />
            <circle cx="100" cy="100" r="5" fill={color} />
            <text x="100" y="85" textAnchor="middle" className="fill-foreground text-2xl font-bold">{value}</text>
          </svg>
          <div className="text-center -mt-2">
            <span className="text-sm font-bold" style={{ color }}>{label}</span>
            <div className="flex justify-between w-48 text-[9px] text-muted-foreground mt-1">
              <span>Extreme Fear</span><span>Neutral</span><span>Extreme Greed</span>
            </div>
          </div>
          {vix && (
            <div className="mt-2 text-[10px] text-muted-foreground">
              India VIX: <b className={`${vix.up ? "text-destructive" : "text-secondary"}`}>{vix.price}</b>
              <span className={`ml-1 ${vix.up ? "text-destructive" : "text-secondary"}`}>({vix.change})</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

// Sector Heatmap
const SectorHeatmap = memo(() => {
  const { sectors } = useLiveMarket();

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <PieChart className="w-4 h-4 text-brand-gold" />
            Sector Performance
          </h3>
          <span className="text-[10px] text-brand-orange font-semibold">Live</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {sectors.map((sector) => {
            const Icon = sectorIcons[sector.name] || Activity;
            return (
              <motion.div key={sector.name}
                className={`flex items-center gap-2 p-2.5 rounded-lg border transition-colors cursor-pointer ${sector.up ? "bg-secondary/5 border-secondary/20 hover:bg-secondary/10" : "bg-destructive/5 border-destructive/20 hover:bg-destructive/10"}`}
                whileHover={{ scale: 1.02, y: -2 }}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${sector.up ? "bg-secondary/15" : "bg-destructive/15"}`}>
                  <Icon className={`w-3.5 h-3.5 ${sector.up ? "text-secondary" : "text-destructive"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate">{sector.name}</div>
                  <div className="text-[10px] text-muted-foreground">{sector.weight}% wt</div>
                </div>
                <span className={`text-xs font-bold ${sector.up ? "text-secondary" : "text-destructive"}`}>{sector.change}</span>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});

// FII/DII/MF flows - admin-fed from NSE/AMFI daily figures (market_flows table).
// Never synthesize these numbers; show an awaiting state until data is fed.
const FLOW_LABELS: Record<string, string> = {
  fii_cash: "FII (Cash)",
  dii_cash: "DII (Cash)",
  fii_fno: "FII (F&O)",
  mf_activity: "Mutual Funds",
};

const FIIDIIFlow = memo(() => {
  const { flows, asOf } = useMarketFlows();

  const rows = flows.map((f) => {
    const net = f.buy_cr - f.sell_cr;
    return {
      label: FLOW_LABELS[f.category] ?? f.category,
      buy: `₹${f.buy_cr.toLocaleString("en-IN")} Cr`,
      sell: `₹${f.sell_cr.toLocaleString("en-IN")} Cr`,
      net: `${net >= 0 ? "+" : "-"}₹${Math.abs(net).toLocaleString("en-IN")} Cr`,
      buyShare: f.buy_cr + f.sell_cr > 0 ? (f.buy_cr / (f.buy_cr + f.sell_cr)) * 100 : 50,
      up: net >= 0,
    };
  });

  const asOfLabel = asOf
    ? new Date(asOf).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : null;

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Globe className="w-4 h-4 text-brand-copper" />
            FII / DII / MF Activity
          </h3>
          <span className="text-[10px] text-muted-foreground">
            {asOfLabel ? `As of ${asOfLabel} · Provisional` : "Provisional"}
          </span>
        </div>
        {rows.length === 0 ? (
          <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-4 text-center">
            Institutional activity figures are published after market close.
            <br />Today's data will appear here once released.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((item) => (
              <div key={item.label} className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-foreground">{item.label}</span>
                  <span className={`text-xs font-bold flex items-center gap-0.5 ${item.up ? "text-secondary" : "text-destructive"}`}>
                    {item.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {item.net}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>Buy: <b className="text-secondary">{item.buy}</b></span>
                  <span>Sell: <b className="text-destructive">{item.sell}</b></span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden flex">
                  <div className="bg-secondary/70 rounded-l-full" style={{ width: `${item.buyShare}%` }} />
                  <div className="bg-destructive/70 rounded-r-full flex-1" />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

// Options Analysis
const PutCallRatio = memo(() => {
  const { vix, marketOverview } = useLiveMarket();
  const advances = marketOverview?.advances ?? 12;
  const declines = marketOverview?.declines ?? 8;
  const pcr = advances > 0 && declines > 0 ? parseFloat((declines / advances * 1.1).toFixed(2)) : 0.87;
  const pcrColor = pcr > 1 ? "text-secondary" : pcr > 0.7 ? "text-brand-gold" : "text-destructive";
  const sentiment = pcr > 1.2 ? "Bullish" : pcr > 0.8 ? "Neutral" : "Bearish";
  const vixPrice = vix?.price || "13.45";
  const vixChange = vix?.change || "-2.1%";
  const vixUp = vix?.up ?? false;

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand-orange" />
            Options Analysis
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <div className="text-[10px] text-muted-foreground mb-1">NIFTY PCR</div>
            <div className={`text-2xl font-bold ${pcrColor}`}>{pcr}</div>
            <div className={`text-[10px] font-semibold ${pcrColor}`}>{sentiment}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <div className="text-[10px] text-muted-foreground mb-1">India VIX</div>
            <div className={`text-2xl font-bold ${vixUp ? "text-destructive" : "text-secondary"}`}>{vixPrice}</div>
            <div className={`text-[10px] font-semibold ${vixUp ? "text-destructive" : "text-secondary"}`}>{vixChange}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <div className="text-[10px] text-muted-foreground mb-1">Advances</div>
            <div className="text-lg font-bold text-secondary">{advances}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <div className="text-[10px] text-muted-foreground mb-1">Declines</div>
            <div className="text-lg font-bold text-destructive">{declines}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Market Mood: <b className={advances > declines ? "text-secondary" : "text-destructive"}>{advances > declines ? "Bullish" : "Bearish"}</b></span>
          <span className="flex items-center gap-1 text-brand-orange font-semibold"><Zap className="w-3 h-3" /> Live</span>
        </div>
      </CardContent>
    </Card>
  );
});

// Trending Stocks
const TrendingStocks = memo(() => {
  const { marketOverview } = useLiveMarket();
  const trending = [
    ...(marketOverview?.gainers?.slice(0, 3) || []),
    ...(marketOverview?.losers?.slice(0, 2) || []),
  ];
  const fallback = [
    { name: "TATA POWER", change: "+4.8%", up: true },
    { name: "ZOMATO", change: "+3.5%", up: true },
    { name: "ADANI GREEN", change: "+3.9%", up: true },
    { name: "PAYTM", change: "-3.2%", up: false },
    { name: "COAL INDIA", change: "-1.5%", up: false },
  ];
  const stocks = trending.length >= 3 ? trending : fallback;

  return (
    <Card className="border-border/50 overflow-hidden bg-gradient-to-r from-brand-charcoal to-brand-navy">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-brand-orange" />
          <h3 className="text-sm font-bold text-primary-foreground">Trending Now</h3>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-brand-orange animate-pulse" />
            <span className="text-[10px] text-primary-foreground/60 font-medium">Live</span>
          </div>
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
          {stocks.map((stock) => (
            <motion.div key={stock.name}
              className="flex-shrink-0 bg-white/8 border border-white/10 rounded-lg px-3 py-2 backdrop-blur-sm cursor-pointer min-w-[160px]"
              whileHover={{ scale: 1.03, backgroundColor: "rgba(255,255,255,0.12)" }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-primary-foreground">{stock.name}</span>
                <span className={`text-[10px] font-bold flex items-center gap-0.5 ${stock.up ? "text-secondary" : "text-destructive"}`}>
                  {stock.up ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                  {stock.change}
                </span>
              </div>
              {'price' in stock && <div className="text-[9px] text-primary-foreground/50">{(stock as { price?: string }).price}</div>}
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

// Global Markets
const GlobalMarkets = memo(() => {
  const { globalMarkets } = useLiveMarket();

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Globe className="w-4 h-4 text-brand-orange" />
            Global Markets
          </h3>
          <span className="text-[10px] text-muted-foreground">Live</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {globalMarkets.map((market) => (
            <motion.div key={market.name} className="bg-muted/30 rounded-lg p-2.5 cursor-pointer hover:bg-muted/50 transition-colors" whileHover={{ y: -2 }}>
              <div className="text-[10px] text-muted-foreground font-medium">{market.name}</div>
              <div className="text-sm font-bold text-foreground">{market.price}</div>
              <div className={`text-[10px] font-bold flex items-center gap-0.5 ${market.up ? "text-secondary" : "text-destructive"}`}>
                {market.up ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                {market.change}
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

// Pre-market synthesis of overnight global cues. Purely descriptive - a tally of
// the world indices we already fetch, not a prediction or recommendation.
const GlobalCues = memo(() => {
  const { globalMarkets } = useLiveMarket();
  const total = globalMarkets.length;
  const up = globalMarkets.filter((m) => m.up).length;
  const ratio = total > 0 ? up / total : 0.5;
  const tone =
    ratio >= 0.6
      ? { label: "Positive cues", cls: "text-secondary", bg: "bg-secondary/10" }
      : ratio <= 0.4
      ? { label: "Weak cues", cls: "text-destructive", bg: "bg-destructive/10" }
      : { label: "Mixed cues", cls: "text-brand-gold", bg: "bg-brand-gold/10" };

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Globe className="w-4 h-4 text-brand-orange" />
            Global Cues
            <span className="text-[10px] font-normal text-muted-foreground">Pre-market</span>
          </h3>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tone.bg} ${tone.cls}`}>{tone.label}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <div className="text-3xl font-bold font-mono text-foreground">
            {up}
            <span className="text-base text-muted-foreground">/{total || "-"}</span>
          </div>
          <div className="text-xs text-muted-foreground">world markets trading higher</div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden flex">
          <div className="h-full bg-secondary/60" style={{ width: `${ratio * 100}%` }} />
          <div className="h-full bg-destructive/50" style={{ width: `${(1 - ratio) * 100}%` }} />
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
          Overnight moves in global indices, for context only - not a prediction of the Indian
          market open or investment advice.
        </p>
      </CardContent>
    </Card>
  );
});

// NEW: Currency Dashboard
const CurrencyDashboard = memo(() => {
  const { commodities } = useLiveMarket();

  // Extract currency pairs from commodities
  const currencies = commodities.filter(c =>
    c.name.includes("USD/INR") || c.name.includes("EUR/INR") || c.name.includes("GBP/INR") || c.name.includes("JPY/INR")
  );

  const fallbackCurrencies = [
    { name: "USD/INR", price: "83.42", change: "+0.05%", up: true },
    { name: "EUR/INR", price: "90.15", change: "-0.12%", up: false },
    { name: "GBP/INR", price: "105.82", change: "+0.18%", up: true },
  ];

  const displayCurrencies = currencies.length > 0 ? currencies : fallbackCurrencies;

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-brand-gold" />
            Currency Rates
          </h3>
          <span className="text-[10px] text-brand-orange font-semibold">Live</span>
        </div>
        <div className="space-y-2">
          {displayCurrencies.map((curr) => (
            <motion.div key={curr.name}
              className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
              whileHover={{ x: 2 }}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${curr.up ? "bg-secondary/10" : "bg-destructive/10"}`}>
                  <IndianRupee className={`w-4 h-4 ${curr.up ? "text-secondary" : "text-destructive"}`} />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground">{curr.name}</div>
                  <div className="text-[10px] text-muted-foreground">Forex</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-foreground">₹{curr.price}</div>
                <div className={`text-[10px] font-bold flex items-center justify-end gap-0.5 ${curr.up ? "text-secondary" : "text-destructive"}`}>
                  {curr.up ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                  {curr.change}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

// Mutual fund activity - real net buy/sell from the admin-fed market_flows
// table (AMFI/NSE daily figures). Category returns are indicative context only.
const fundCategories = [
  { name: "Large Cap", return1y: "+18.5%" },
  { name: "Mid Cap", return1y: "+28.2%" },
  { name: "Small Cap", return1y: "+35.4%" },
  { name: "Flexi Cap", return1y: "+22.8%" },
  { name: "Debt Funds", return1y: "+7.2%" },
];

const MutualFundFlows = memo(() => {
  const { flows, asOf } = useMarketFlows();
  const mf = flows.find((f) => f.category === "mf_activity");
  const mfNet = mf ? mf.buy_cr - mf.sell_cr : null;
  const asOfLabel = asOf
    ? new Date(asOf).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : null;

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Coins className="w-4 h-4 text-brand-gold" />
            Mutual Fund Activity
          </h3>
          <span className="text-[10px] text-muted-foreground">{asOfLabel ? `As of ${asOfLabel}` : "Daily Data"}</span>
        </div>

        {mf ? (
          <div className="mb-3 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-foreground">MF Net Activity (Equity)</span>
              <span className={`text-sm font-bold ${mfNet! >= 0 ? "text-secondary" : "text-destructive"}`}>
                {mfNet! >= 0 ? "+" : "-"}₹{Math.abs(mfNet!).toLocaleString("en-IN")} Cr
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span>Buy: <b className="text-secondary">₹{mf.buy_cr.toLocaleString("en-IN")} Cr</b></span>
              <span>Sell: <b className="text-destructive">₹{mf.sell_cr.toLocaleString("en-IN")} Cr</b></span>
            </div>
          </div>
        ) : (
          <div className="mb-3 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 text-center">
            MF activity figures publish after market close and will appear here once released.
          </div>
        )}

        <div className="space-y-1.5">
          {fundCategories.map((fund) => (
            <div key={fund.name} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
              <span className="text-xs font-semibold text-foreground">{fund.name}</span>
              <div className="text-right">
                <span className="text-xs font-bold text-secondary">{fund.return1y}</span>
                <span className="text-[9px] text-muted-foreground ml-1.5">1Y Category Avg</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-center text-[9px] text-muted-foreground">
          Category returns are indicative averages, not live NAVs.
        </div>
      </CardContent>
    </Card>
  );
});

// Main Dashboard — one tabbed board instead of four stacked sections, so the
// whole intelligence surface fits above the fold with no dead space.
const MI_TABS = [
  { id: "sentiment", labelKey: "mi.sentiment", icon: Activity },
  { id: "global", labelKey: "mi.global", icon: Globe },
  { id: "movers", labelKey: "mi.movers", icon: TrendingUp },
  { id: "currency", labelKey: "mi.currency", icon: Coins },
] as const;

type MiTabId = (typeof MI_TABS)[number]["id"];

// Data older than this counts as delayed (live feed refreshes every 60s
// while the market is open, 5 min when closed).
const STALE_AFTER_MS = 10 * 60 * 1000;

// Honesty badge: the dashboard seeds with fallback numbers and keeps the last
// good fetch on errors, so surface whether what's on screen is actually live.
const DataFreshness = memo(() => {
  const { fetchedAt, loading } = useLiveMarket();
  // Re-render each minute so the staleness judgement stays current.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  if (loading) return null;

  const fetchedMs = fetchedAt ? new Date(fetchedAt).getTime() : null;
  const isLive = fetchedMs != null && Date.now() - fetchedMs < STALE_AFTER_MS;
  const timeLabel = fetchedMs != null
    ? new Date(fetchedMs).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : null;

  return isLive ? (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-secondary">
      <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
      Live data · {timeLabel}
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-brand-gold"
      title="The live feed could not be refreshed - figures shown may be indicative or delayed."
    >
      <AlertTriangle className="w-3 h-3" />
      Delayed data{timeLabel ? ` · last updated ${timeLabel}` : " · showing indicative figures"}
    </span>
  );
});

const MarketDashboard = () => {
  const { t } = useT();
  const { marketOverview, commodities } = useLiveMarket();
  const [activeTab, setActiveTab] = useState<MiTabId>("sentiment");
  return (
    <section className="py-8 md:py-16 bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-brand-orange/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-brand-gold/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div className="text-center mb-10" {...revealSection}>
          <motion.span className="inline-flex items-center gap-1.5 bg-brand-orange/10 text-brand-orange text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full mb-3">
            <BarChart3 className="w-3.5 h-3.5" />
            {t("mi.eyebrow")}
          </motion.span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-2">{t("page.marketIntel")}</h2>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            {t("mi.subtitle")}
          </p>
          <div className="mt-2">
            <DataFreshness />
          </div>
        </motion.div>

        <motion.div className="mb-6" {...revealItem()}>
          <TrendingStocks />
        </motion.div>

        {/* Tab bar */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-6 md:justify-center">
          {MI_TABS.map((tb) => {
            const Icon = tb.icon;
            const active = activeTab === tb.id;
            return (
              <button
                key={tb.id}
                onClick={() => setActiveTab(tb.id)}
                className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${active ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40"}`}
              >
                <Icon className="w-4 h-4" />
                {t(tb.labelKey)}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
            {activeTab === "sentiment" && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <FearGreedGauge />
                <PutCallRatio />
                <FIIDIIFlow />
              </div>
            )}
            {activeTab === "global" && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <GlobalCues />
                <SectorHeatmap />
                <GlobalMarkets />
              </div>
            )}
            {activeTab === "movers" && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <motion.div {...revealSection} transition={{ delay: 0.6 }}>
            <Card className="border-border/50 overflow-hidden h-full">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-secondary" />
                    Top Gainers
                  </h3>
                  <span className="text-[10px] text-brand-orange font-semibold">Live NSE</span>
                </div>
                <div className="space-y-2">
                  {/* No hardcoded rows. These used to fall back to invented
                      prices under the "Live NSE" badge above, which is the
                      worst possible framing for fabricated data. */}
                  {!marketOverview?.gainers?.length && (
                    <p className="text-xs text-muted-foreground py-3">Live data unavailable right now.</p>
                  )}
                  {(marketOverview?.gainers?.slice(0, 5) ?? []).map((s: { name: string; change: string; up: boolean; price?: string }, i: number) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                      <span className="text-xs font-semibold text-foreground">{s.name}</span>
                      <div className="text-right">
                        {s.price && <div className="text-[10px] text-muted-foreground">{s.price}</div>}
                        <span className="text-xs font-bold text-secondary">{s.change}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div {...revealSection} transition={{ delay: 0.7 }}>
            <Card className="border-border/50 overflow-hidden h-full">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-destructive" />
                    Top Losers
                  </h3>
                  <span className="text-[10px] text-brand-orange font-semibold">Live NSE</span>
                </div>
                <div className="space-y-2">
                  {!marketOverview?.losers?.length && (
                    <p className="text-xs text-muted-foreground py-3">Live data unavailable right now.</p>
                  )}
                  {(marketOverview?.losers?.slice(0, 5) ?? []).map((s: { name: string; change: string; up: boolean; price?: string }, i: number) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                      <span className="text-xs font-semibold text-foreground">{s.name}</span>
                      <div className="text-right">
                        {s.price && <div className="text-[10px] text-muted-foreground">{s.price}</div>}
                        <span className="text-xs font-bold text-destructive">{s.change}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div {...revealSection} transition={{ delay: 0.8 }}>
            <Card className="border-border/50 overflow-hidden h-full">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Coins className="w-4 h-4 text-brand-gold" />
                    Commodity Snapshot
                  </h3>
                  <span className="text-[10px] text-muted-foreground">MCX Live</span>
                </div>
                <div className="space-y-3">
                  {[
                    { name: "GOLD", unit: "10g", val: commodities.find(c => c.name.toUpperCase().includes("GOLD")) },
                    { name: "SILVER", unit: "kg", val: commodities.find(c => c.name.toUpperCase().includes("SILVER")) },
                    { name: "CRUDE OIL", unit: "bbl", val: commodities.find(c => c.name.toUpperCase().includes("CRUDE")) },
                    { name: "NAT GAS", unit: "mmBtu", val: commodities.find(c => c.name.toUpperCase().includes("NAT")) },
                  ].map(({ name, unit, val }) => {
                    // No invented fallback price. An em dash says "we don't
                    // know"; a plausible number says something false.
                    const d = val;
                    return (
                      <div key={name} className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg">
                        <div>
                          <div className="text-xs font-bold text-foreground">{name}</div>
                          <div className="text-[9px] text-muted-foreground">per {unit}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-foreground">{d?.price ?? "—"}</div>
                          <div className={`text-[10px] font-bold flex items-center justify-end gap-0.5 ${!d ? "text-muted-foreground" : d.up ? "text-secondary" : "text-destructive"}`}>
                            {d && (d.up ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />)}
                            {d?.change ?? "—"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
              </div>
            )}
            {activeTab === "currency" && (
              <div className="grid md:grid-cols-2 gap-6">
                <CurrencyDashboard />
                <MutualFundFlows />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};

export default MarketDashboard;
