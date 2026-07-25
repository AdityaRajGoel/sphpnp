import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import SEOHead from "@/components/SEOHead";
import WhatsAppButton from "@/components/WhatsAppButton";
import ScrollProgress from "@/components/ScrollProgress";
import { motion } from "motion/react";
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, RefreshCw, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useScreenerStocks, type ScreenerStock } from "@/hooks/useScreenerStocks";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import PageTransition from "@/components/PageTransition";

const StockRow = ({ stock, type }: { stock: ScreenerStock; type: "high" | "low" }) => {
  const range = stock.high_52 - stock.low_52;
  if (range <= 0) return null;
  const pctFromHigh = ((stock.high_52 - stock.price) / stock.high_52) * 100;
  const pctFromLow = ((stock.price - stock.low_52) / stock.low_52) * 100;
  const posInRange = ((stock.price - stock.low_52) / range) * 100;

  return (
    <Card className="p-4 hover:bg-muted/30 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="font-bold text-foreground">{stock.symbol}</span>
          <span className="text-xs text-muted-foreground ml-2">{stock.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{stock.sector}</Badge>
          <span className={`text-sm font-medium ${stock.change_pct >= 0 ? "text-secondary" : "text-destructive"}`}>
            {stock.change_pct >= 0 ? "+" : ""}{stock.change_pct.toFixed(2)}%
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <div className="text-muted-foreground min-w-[70px]">
          <div className="text-xs">52W Low</div>
          <div className="font-mono font-medium text-foreground">₹{stock.low_52.toLocaleString("en-IN")}</div>
        </div>
        <div className="flex-1">
          <div className="relative h-2 bg-muted rounded-full">
            <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-destructive via-brand-gold to-secondary rounded-full" style={{ width: "100%" }} />
            <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-card border-2 border-foreground rounded-full shadow" style={{ left: `${posInRange}%`, transform: `translate(-50%, -50%)` }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>{pctFromLow.toFixed(1)}% from low</span>
            <span className="font-semibold text-foreground">₹{stock.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span>{pctFromHigh.toFixed(1)}% from high</span>
          </div>
        </div>
        <div className="text-right min-w-[70px]">
          <div className="text-xs text-muted-foreground">52W High</div>
          <div className="font-mono font-medium text-foreground">₹{stock.high_52.toLocaleString("en-IN")}</div>
        </div>
      </div>
    </Card>
  );
};

const Week52TrackerPage = () => {
  const { stocks, loading, updatedAt, refresh } = useScreenerStocks();
  const [refreshing, setRefreshing] = useState(false);

  // Near 52W High: within 10% of high, sorted by proximity
  const nearHigh = useMemo(() =>
    stocks
      .filter(s => s.high_52 > 0 && s.low_52 > 0 && s.price > 0)
      .map(s => ({ ...s, pctFromHigh: ((s.high_52 - s.price) / s.high_52) * 100 }))
      .filter(s => s.pctFromHigh <= 10)
      .sort((a, b) => a.pctFromHigh - b.pctFromHigh)
      .slice(0, 25),
    [stocks]
  );

  // Near 52W Low: within 15% of low, sorted by proximity
  const nearLow = useMemo(() =>
    stocks
      .filter(s => s.high_52 > 0 && s.low_52 > 0 && s.price > 0)
      .map(s => ({ ...s, pctFromLow: ((s.price - s.low_52) / s.low_52) * 100 }))
      .filter(s => s.pctFromLow <= 15)
      .sort((a, b) => a.pctFromLow - b.pctFromLow)
      .slice(0, 25),
    [stocks]
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <PageTransition>
    <div className="min-h-screen bg-background">
      <SEOHead 
        title="52-Week High Low Tracker | NSE Stocks | Parasram India Panipat"
        description="Live NSE tracker for stocks near 52-week highs and lows. Spot breakout and reversal candidates with real-time data. Free tool by Parasram India Panipat."
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "52-Week High/Low Tracker" },
        ]}
        jsonLd={{
          "@type": "WebApplication",
          "name": "52-Week High/Low Tracker - Parasram India",
          "description": "Free live tracker showing NSE stocks near their 52-week highs and lows. Spot breakout and reversal candidates with real-time data.",
          "applicationCategory": "FinanceApplication",
          "operatingSystem": "Web Browser",
          "url": "https://www.sphpnp.com/52-week-tracker",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "INR" },
          "provider": {
            "@type": "Organization",
            "name": "Shri Parasram Holdings Panipat",
            "url": "https://www.sphpnp.com"
          },
          "featureList": [
            "Live 52-week high tracker",
            "Live 52-week low tracker",
            "52-week price range bar for each stock",
            "% distance from 52-week high and low",
            "Auto-refresh every 5 minutes"
          ]
        }}
      />
      <ScrollProgress />
      <Header />
      <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "52-Week Tracker" }]} />
      <main className="container mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-2">52-Week High / Low Tracker</h1>
            <p className="text-muted-foreground">Live stocks near their yearly extremes - spot breakout and reversal candidates</p>
          </div>
          <div className="flex items-center gap-3">
            {updatedAt && (
              <span className="text-xs text-muted-foreground">
                Updated {new Date(updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="ml-1.5">Refresh</span>
            </Button>
          </div>
        </motion.div>

        <Tabs defaultValue="high" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="high" className="gap-1.5">
              <ArrowUp className="w-4 h-4" /> Near 52W High ({loading ? "…" : nearHigh.length})
            </TabsTrigger>
            <TabsTrigger value="low" className="gap-1.5">
              <ArrowDown className="w-4 h-4" /> Near 52W Low ({loading ? "…" : nearLow.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="high">
            <div className="grid gap-3">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)
              ) : nearHigh.length > 0 ? (
                nearHigh.map((stock, i) => (
                  <motion.div key={stock.symbol} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                    <StockRow stock={stock} type="high" />
                  </motion.div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">No stocks currently within 10% of their 52-week high</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="low">
            <div className="grid gap-3">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)
              ) : nearLow.length > 0 ? (
                nearLow.map((stock, i) => (
                  <motion.div key={stock.symbol} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                    <StockRow stock={stock} type="low" />
                  </motion.div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">No stocks currently within 15% of their 52-week low</p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground mt-6 text-center">Live data from Yahoo Finance. Auto-refreshes every 5 minutes.</p>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  </PageTransition>
  );
};

export default Week52TrackerPage;
