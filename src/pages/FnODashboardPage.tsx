import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useT } from "@/i18n/LanguageContext";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import SEOHead from "@/components/SEOHead";
import WhatsAppButton from "@/components/WhatsAppButton";
import ScrollProgress from "@/components/ScrollProgress";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Activity, Target, BarChart3, RefreshCw, Loader2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv, todayStamp } from "@/lib/exportData";
import PageTransition from "@/components/PageTransition";
import { EASE_IN_OUT } from "@/lib/motion";

type OptionRow = {
  strike: number;
  callOI: number;
  callChange: number;
  callLTP: number;
  callIV: number;
  callVolume: number;
  putOI: number;
  putChange: number;
  putLTP: number;
  putIV: number;
  putVolume: number;
};

type ExpiryOption = {
  timestamp: string;
  label: string;
};

type FnOData = {
  symbol: string;
  spot: number;
  chain: OptionRow[];
  expiries: ExpiryOption[];
  currentExpiry: string | null;
  maxPain: number;
  pcr: number;
  totalCallOI: number;
  totalPutOI: number;
  fetchedAt: string;
};

/** Professional F&O loading animation */
const FnOLoadingAnimation = () => {
  const columns = Array.from({ length: 20 });
  return (
    <div className="flex flex-col items-center justify-center py-8 md:py-16 gap-8">
      {/* Animated OI bars */}
      <div className="flex items-center gap-0.5">
        <div className="flex items-end gap-0.5 h-20">
          {columns.slice(0, 10).map((_, i) => (
            <motion.div
              key={`call-${i}`}
              className="w-2.5 bg-secondary/60 rounded-t-sm"
              initial={{ height: 0 }}
              animate={{ height: 15 + Math.random() * 50 }}
              transition={{ duration: 0.5, delay: i * 0.06, repeat: Infinity, repeatType: "reverse", repeatDelay: 1 }}
            />
          ))}
        </div>
        <div className="w-px h-20 bg-border mx-1" />
        <div className="flex items-end gap-0.5 h-20">
          {columns.slice(10).map((_, i) => (
            <motion.div
              key={`put-${i}`}
              className="w-2.5 bg-destructive/60 rounded-t-sm"
              initial={{ height: 0 }}
              animate={{ height: 15 + Math.random() * 50 }}
              transition={{ duration: 0.5, delay: i * 0.06, repeat: Infinity, repeatType: "reverse", repeatDelay: 1 }}
            />
          ))}
        </div>
      </div>

      {/* Labels */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-secondary/60" /> Calls
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-destructive/60" /> Puts
        </span>
      </div>

      <div className="flex flex-col items-center gap-2">
        <motion.p
          className="text-sm font-medium text-muted-foreground flex items-center gap-2"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading options chain...
        </motion.p>
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

/** Metric card skeleton */
const MetricSkeleton = () => (
  <Card className="p-4 text-center">
    <motion.div
      className="w-5 h-5 mx-auto mb-2 rounded bg-muted"
      animate={{ opacity: [0.3, 0.7, 0.3] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    />
    <motion.div
      className="h-3 w-20 mx-auto mb-2 rounded bg-muted"
      animate={{ opacity: [0.3, 0.6, 0.3] }}
      transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
    />
    <motion.div
      className="h-7 w-16 mx-auto rounded bg-muted"
      animate={{ opacity: [0.3, 0.8, 0.3] }}
      transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
    />
  </Card>
);

const FnODashboardPage = () => {
  const { t } = useT();
  const [symbol, setSymbol] = useState("NIFTY");
  const [expiry, setExpiry] = useState<string>("");
  const [data, setData] = useState<FnOData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (sym: string, exp?: string) => {
    try {
      setError(null);
      const body: Record<string, unknown> = { symbol: sym };
      if (exp) body.expiry = exp;

      const { data: res, error: fnError } = await supabase.functions.invoke("fetch-fno-data", { body });

      if (fnError) throw new Error(fnError.message);
      if (!res?.success) throw new Error(res?.error || "Failed to fetch data");

      setData(res as FnOData);
      if (!exp && res.expiries?.length > 0) {
        setExpiry(String(res.expiries[0].timestamp));
      }
    } catch (e) {
      console.error("F&O fetch error:", e);
      setError(e instanceof Error ? e.message : "Failed to load F&O data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData(symbol, expiry || undefined);
    
    // Refresh F&O data every 30 seconds
    const interval = setInterval(() => {
      fetchData(symbol, expiry || undefined);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [symbol, expiry, fetchData]);

  const handleExpiryChange = (val: string) => {
    setExpiry(val);
    setRefreshing(true);
    fetchData(symbol, val);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData(symbol, expiry || undefined);
  };

  const handleExport = () => {
    if (!data || data.chain.length === 0) return;
    const headers = [
      "Strike", "Call OI", "Call Chg", "Call LTP", "Call IV%",
      "Put OI", "Put Chg", "Put LTP", "Put IV%",
    ];
    const rows = data.chain.map((r) => [
      r.strike, r.callOI, r.callChange, r.callLTP, r.callIV,
      r.putOI, r.putChange, r.putLTP, r.putIV,
    ]);
    downloadCsv(`parasram-optionchain-${symbol}-${todayStamp()}`, headers, rows);
  };

  const chain = data?.chain || [];
  const spot = data?.spot || 0;
  const maxPain = data?.maxPain || 0;
  const pcr = data?.pcr || 0;
  const totalCallOI = data?.totalCallOI || 0;
  const totalPutOI = data?.totalPutOI || 0;
  const maxCallOI = chain.length > 0 ? Math.max(...chain.map(r => r.callOI)) : 1;
  const maxPutOI = chain.length > 0 ? Math.max(...chain.map(r => r.putOI)) : 1;

  return (
    <PageTransition>
    <div className="min-h-screen bg-background">
      <SEOHead 
        title="F&O Dashboard | Options Chain, PCR & Max Pain | Parasram India"
        description="Live F&O dashboard with options chain, Put-Call ratio and max pain for NIFTY, BANKNIFTY and FINNIFTY. Free real-time open interest data. Parasram India Panipat."
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "F&O Dashboard" },
        ]}
        jsonLd={{
          "@type": "WebApplication",
          "name": "F&O Options Chain Dashboard - Parasram India",
          "description": "Live NIFTY, BANKNIFTY, and FINNIFTY options chain viewer with Put-Call Ratio (PCR) analysis, max pain calculator, and real-time open interest data.",
          "applicationCategory": "FinanceApplication",
          "operatingSystem": "Web Browser",
          "url": "https://www.sphpnp.com/fno",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "INR" },
          "provider": {
            "@type": "Organization",
            "name": "Shri Parasram Holdings Panipat",
            "url": "https://www.sphpnp.com"
          },
          "featureList": [
            "Live NIFTY options chain",
            "Live BANKNIFTY options chain",
            "Live FINNIFTY options chain",
            "Put-Call Ratio (PCR) analysis",
            "Max Pain calculator",
            "Call and Put Open Interest by strike",
            "ATM strike highlighting",
            "OI analysis charts",
            "Auto-refresh every 30 seconds"
          ]
        }}
        faqItems={[
          { question: "What is Put-Call Ratio (PCR) in F&O?", answer: "PCR is the ratio of total put open interest to total call open interest. A PCR above 1 indicates more put buying (bearish sentiment), while below 0.8 suggests more call buying (bullish sentiment)." },
          { question: "What is Max Pain in options trading?", answer: "Max Pain is the strike price at which the maximum number of options (both calls and puts) expire worthless. It is the price at which option sellers gain the most, and is often used as a price target indicator." },
          { question: "How often is the F&O data updated?", answer: "The options chain data refreshes automatically every 30 seconds. You can also manually refresh using the Refresh button." },
          { question: "Which indices are available in the F&O dashboard?", answer: "Currently NIFTY 50, BANK NIFTY, and FIN NIFTY are available. You can switch between them using the dropdown selector." },
        ]}
      />
      <ScrollProgress />
      <Header />
      <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "F&O Dashboard" }]} />
      <main className="container mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-2">{t("page.fno")}</h1>
          <p className="text-muted-foreground">Live options chain, Put-Call Ratio & Max Pain analysis</p>
        </motion.div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Select value={symbol} onValueChange={(v) => { setSymbol(v); setExpiry(""); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="NIFTY">NIFTY 50</SelectItem>
              <SelectItem value="BANKNIFTY">BANK NIFTY</SelectItem>
              <SelectItem value="FINNIFTY">FIN NIFTY</SelectItem>
            </SelectContent>
          </Select>

          {data?.expiries && data.expiries.length > 0 && (
            <Select value={expiry} onValueChange={handleExpiryChange}>
              <SelectTrigger className="w-44" aria-label="Select expiry"><SelectValue placeholder="Select expiry" /></SelectTrigger>
              <SelectContent>
                {data.expiries.map(e => (
                  <SelectItem key={e.timestamp} value={String(e.timestamp)}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {spot > 0 && (
            <Badge variant="outline" className="text-sm py-1.5 px-3">
              Spot: <span className="font-mono font-bold ml-1">₹{spot.toLocaleString("en-IN")}</span>
            </Badge>
          )}

          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button variant="outline" size="sm" onClick={handleExport} disabled={!data || chain.length === 0}>
            <Download className="w-4 h-4 mr-1" />
            Export CSV
          </Button>

          {data?.fetchedAt && (
            <span className="text-xs text-muted-foreground ml-auto">
              Updated: {new Date(data.fetchedAt).toLocaleTimeString("en-IN")}
            </span>
          )}
        </div>

        {error && (
          <Card className="p-4 mb-6 border-destructive/50 bg-destructive/5">
            <p className="text-sm text-destructive">{error}</p>
            <p className="text-xs text-muted-foreground mt-1">Showing last available data or retry.</p>
          </Card>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <AnimatePresence mode="wait">
            {loading ? (
              <>
                {Array.from({ length: 4 }).map((_, i) => <MetricSkeleton key={`skel-${i}`} />)}
              </>
            ) : (
              <>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
                  <Card className="p-4 text-center">
                    <Activity className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Put-Call Ratio</p>
                    <p className={`text-2xl font-bold font-mono ${pcr > 1 ? "text-secondary" : "text-destructive"}`}>{pcr.toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">{pcr > 1.2 ? "Bullish" : pcr > 0.8 ? "Neutral" : "Bearish"}</p>
                  </Card>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <Card className="p-4 text-center">
                    <Target className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Max Pain</p>
                    <p className="text-2xl font-bold font-mono text-foreground">₹{maxPain.toLocaleString("en-IN")}</p>
                    <p className="text-[10px] text-muted-foreground">{maxPain > spot ? "Above Spot" : "Below Spot"}</p>
                  </Card>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <Card className="p-4 text-center">
                    <TrendingUp className="w-5 h-5 mx-auto mb-1 text-secondary" />
                    <p className="text-xs text-muted-foreground">Total Call OI</p>
                    <p className="text-xl font-bold font-mono text-foreground">{totalCallOI > 1000000 ? `${(totalCallOI / 1000000).toFixed(1)}M` : `${(totalCallOI / 1000).toFixed(0)}K`}</p>
                  </Card>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <Card className="p-4 text-center">
                    <TrendingDown className="w-5 h-5 mx-auto mb-1 text-destructive" />
                    <p className="text-xs text-muted-foreground">Total Put OI</p>
                    <p className="text-xl font-bold font-mono text-foreground">{totalPutOI > 1000000 ? `${(totalPutOI / 1000000).toFixed(1)}M` : `${(totalPutOI / 1000).toFixed(0)}K`}</p>
                  </Card>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="fno-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <FnOLoadingAnimation />
            </motion.div>
          ) : (
            <motion.div key="fno-content" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Tabs defaultValue="chain" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="chain">Options Chain</TabsTrigger>
                  <TabsTrigger value="oi">OI Analysis</TabsTrigger>
                </TabsList>

                <TabsContent value="chain">
                  <Card className="overflow-x-auto">
                    {chain.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        <p>No options data available for this symbol/expiry.</p>
                      </div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-muted/50">
                            <th colSpan={4} className="text-center px-2 py-2 font-semibold text-secondary border-r border-border">CALLS</th>
                            <th className="px-3 py-2 font-semibold text-foreground">STRIKE</th>
                            <th colSpan={4} className="text-center px-2 py-2 font-semibold text-destructive border-l border-border">PUTS</th>
                          </tr>
                          <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                            <th className="px-2 py-1.5 text-right">OI</th>
                            <th className="px-2 py-1.5 text-right">Chg</th>
                            <th className="px-2 py-1.5 text-right">LTP</th>
                            <th className="px-2 py-1.5 text-right border-r border-border">IV%</th>
                            <th className="px-3 py-1.5 text-center"></th>
                            <th className="px-2 py-1.5 text-left border-l border-border">OI</th>
                            <th className="px-2 py-1.5 text-left">Chg</th>
                            <th className="px-2 py-1.5 text-left">LTP</th>
                            <th className="px-2 py-1.5 text-left">IV%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {chain.map((row, i) => {
                            const isATM = Math.abs(row.strike - spot) <= (symbol === "BANKNIFTY" ? 50 : 25);
                            const isITMCall = row.strike < spot;
                            const isITMPut = row.strike > spot;
                            return (
                              <motion.tr
                                key={row.strike}
                                initial={{ opacity: 0, x: -5 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.015 }}
                                className={`border-b border-border/30 transition-colors hover:bg-muted/20 ${isATM ? "bg-brand-gold/10 font-semibold" : ""}`}
                              >
                                <td className={`px-2 py-2 text-right font-mono ${isITMCall ? "bg-secondary/5" : ""}`}>
                                  {row.callOI > 0 ? (row.callOI > 100000 ? `${(row.callOI / 100000).toFixed(1)}L` : `${(row.callOI / 1000).toFixed(1)}K`) : "-"}
                                  {row.callOI > 0 && <div className="h-1 bg-muted rounded-full mt-0.5"><div className="h-full bg-secondary/40 rounded-full" style={{ width: `${(row.callOI / maxCallOI) * 100}%` }} /></div>}
                                </td>
                                <td className={`px-2 py-2 text-right font-mono ${row.callChange >= 0 ? "text-secondary" : "text-destructive"}`}>
                                  {row.callChange !== 0 ? `${row.callChange >= 0 ? "+" : ""}${row.callChange.toFixed(1)}` : "-"}
                                </td>
                                <td className={`px-2 py-2 text-right font-mono ${isITMCall ? "bg-secondary/5" : ""}`}>
                                  {row.callLTP > 0 ? row.callLTP.toFixed(2) : "-"}
                                </td>
                                <td className="px-2 py-2 text-right font-mono text-muted-foreground border-r border-border">
                                  {row.callIV > 0 ? row.callIV.toFixed(1) : "-"}
                                </td>
                                <td className={`px-3 py-2 text-center font-bold font-mono ${isATM ? "text-brand-gold" : "text-foreground"}`}>
                                  {row.strike.toLocaleString("en-IN")}
                                  {isATM && <span className="block text-[9px] text-brand-gold">ATM</span>}
                                </td>
                                <td className={`px-2 py-2 text-left font-mono border-l border-border ${isITMPut ? "bg-destructive/5" : ""}`}>
                                  {row.putOI > 0 ? (row.putOI > 100000 ? `${(row.putOI / 100000).toFixed(1)}L` : `${(row.putOI / 1000).toFixed(1)}K`) : "-"}
                                  {row.putOI > 0 && <div className="h-1 bg-muted rounded-full mt-0.5"><div className="h-full bg-destructive/40 rounded-full" style={{ width: `${(row.putOI / maxPutOI) * 100}%` }} /></div>}
                                </td>
                                <td className={`px-2 py-2 text-left font-mono ${row.putChange >= 0 ? "text-secondary" : "text-destructive"}`}>
                                  {row.putChange !== 0 ? `${row.putChange >= 0 ? "+" : ""}${row.putChange.toFixed(1)}` : "-"}
                                </td>
                                <td className={`px-2 py-2 text-left font-mono ${isITMPut ? "bg-destructive/5" : ""}`}>
                                  {row.putLTP > 0 ? row.putLTP.toFixed(2) : "-"}
                                </td>
                                <td className="px-2 py-2 text-left font-mono text-muted-foreground">
                                  {row.putIV > 0 ? row.putIV.toFixed(1) : "-"}
                                </td>
                              </motion.tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </Card>
                </TabsContent>

                <TabsContent value="oi">
                  <div className="grid md:grid-cols-2 gap-4">
                    <Card className="p-4">
                      <h3 className="text-sm font-semibold mb-3 text-foreground flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-secondary" /> Call OI by Strike
                      </h3>
                      <div className="space-y-1.5">
                        {chain.filter((_, i) => i % 2 === 0).map((row, idx) => (
                          <motion.div
                            key={row.strike}
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: "100%" }}
                            transition={{ delay: idx * 0.03 }}
                            className="flex items-center gap-2 text-xs"
                          >
                            <span className="w-14 text-right font-mono text-muted-foreground">{row.strike.toLocaleString("en-IN")}</span>
                            <div className="flex-1 h-4 bg-muted rounded-sm relative">
                              <motion.div
                                className="absolute left-0 top-0 h-full bg-secondary/50 rounded-sm"
                                initial={{ width: 0 }}
                                animate={{ width: `${(row.callOI / maxCallOI) * 100}%` }}
                                transition={{ duration: 0.6, delay: idx * 0.03 }}
                              />
                            </div>
                            <span className="w-14 text-right font-mono">{row.callOI > 100000 ? `${(row.callOI / 100000).toFixed(1)}L` : `${(row.callOI / 1000).toFixed(0)}K`}</span>
                          </motion.div>
                        ))}
                      </div>
                    </Card>
                    <Card className="p-4">
                      <h3 className="text-sm font-semibold mb-3 text-foreground flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-destructive" /> Put OI by Strike
                      </h3>
                      <div className="space-y-1.5">
                        {chain.filter((_, i) => i % 2 === 0).map((row, idx) => (
                          <motion.div
                            key={row.strike}
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: "100%" }}
                            transition={{ delay: idx * 0.03 }}
                            className="flex items-center gap-2 text-xs"
                          >
                            <span className="w-14 text-right font-mono text-muted-foreground">{row.strike.toLocaleString("en-IN")}</span>
                            <div className="flex-1 h-4 bg-muted rounded-sm relative">
                              <motion.div
                                className="absolute left-0 top-0 h-full bg-destructive/50 rounded-sm"
                                initial={{ width: 0 }}
                                animate={{ width: `${(row.putOI / maxPutOI) * 100}%` }}
                                transition={{ duration: 0.6, delay: idx * 0.03 }}
                              />
                            </div>
                            <span className="w-14 text-right font-mono">{row.putOI > 100000 ? `${(row.putOI / 100000).toFixed(1)}L` : `${(row.putOI / 1000).toFixed(0)}K`}</span>
                          </motion.div>
                        ))}
                      </div>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SEBI risk transparency - serious-broker pattern (ref: SEBI study, Jan 2023) */}
        <div className="mt-8 bg-brand-orange/5 border border-brand-orange/20 rounded-xl p-4 text-center">
          <p className="text-sm text-foreground/80 font-medium">
            ⚠️ As per a SEBI study, <b className="text-brand-orange">9 out of 10 individual traders</b> in the equity
            F&amp;O segment incurred net losses.
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">
            Derivatives are leveraged instruments. New to derivatives? Start with our{" "}
            <a href="/learn/fno-basics" className="text-secondary font-semibold hover:underline">F&amp;O basics guide</a>{" "}
            and consult our SEBI-registered research desk before taking positions.
          </p>
        </div>

        <p className="text-xs text-muted-foreground mt-6 text-center">
          Live options data sourced from Yahoo Finance. Values update on refresh.
        </p>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  </PageTransition>
  );
};

export default FnODashboardPage;
