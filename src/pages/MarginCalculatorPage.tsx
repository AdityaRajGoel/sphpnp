import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import WhatsAppButton from "@/components/WhatsAppButton";
import ScrollProgress from "@/components/ScrollProgress";
import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { DURATION, EASE_OUT, REVEAL_Y } from "@/lib/motion";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calculator, TrendingUp, IndianRupee, Info } from "lucide-react";
import PageTransition from "@/components/PageTransition";

const MARGIN_RATES: Record<string, { span: number; exposure: number; label: string }> = {
  NIFTY: { span: 9, exposure: 3, label: "NIFTY 50" },
  BANKNIFTY: { span: 10, exposure: 3.5, label: "BANK NIFTY" },
  FINNIFTY: { span: 9.5, exposure: 3, label: "FIN NIFTY" },
  MIDCPNIFTY: { span: 11, exposure: 3.5, label: "MIDCAP NIFTY" },
};

const LOT_SIZES: Record<string, number> = {
  NIFTY: 25, BANKNIFTY: 15, FINNIFTY: 25, MIDCPNIFTY: 50,
};

const EQUITY_SEGMENTS = [
  { key: "delivery", label: "Delivery (CNC)", marginPct: 100 },
  { key: "intraday", label: "Intraday (MIS)", marginPct: 20 },
  { key: "btst", label: "BTST", marginPct: 100 },
];

const MarginCalculatorPage = () => {
  const [segment, setSegment] = useState("futures");
  const [symbol, setSymbol] = useState("NIFTY");
  const [price, setPrice] = useState("22000");
  const [lots, setLots] = useState("1");
  const [equityPrice, setEquityPrice] = useState("1500");
  const [equityQty, setEquityQty] = useState("100");
  const [equitySegment, setEquitySegment] = useState("delivery");

  const futuresMargin = useMemo(() => {
    const p = parseFloat(price) || 0;
    const l = parseInt(lots) || 1;
    const rate = MARGIN_RATES[symbol];
    const lotSize = LOT_SIZES[symbol];
    const contractValue = p * lotSize * l;
    const spanMargin = (contractValue * rate.span) / 100;
    const exposureMargin = (contractValue * rate.exposure) / 100;
    const totalMargin = spanMargin + exposureMargin;
    return { contractValue, spanMargin, exposureMargin, totalMargin, lotSize, leverage: contractValue / totalMargin };
  }, [price, lots, symbol]);

  const equityMargin = useMemo(() => {
    const p = parseFloat(equityPrice) || 0;
    const q = parseInt(equityQty) || 0;
    const seg = EQUITY_SEGMENTS.find(s => s.key === equitySegment)!;
    const totalValue = p * q;
    const required = (totalValue * seg.marginPct) / 100;
    return { totalValue, required, leverage: totalValue / required };
  }, [equityPrice, equityQty, equitySegment]);

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  return (
    <PageTransition>
    <div className="min-h-screen bg-background">
      <SEOHead 
        title="F&O Margin Calculator - SPAN + Exposure NSE | Parasram India" 
        description="Free margin calculator for F&O and equity trades. Calculate SPAN margin, exposure margin, leverage and required capital for NIFTY, BANKNIFTY and stock futures."
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Margin Calculator" },
        ]}
        jsonLd={{
          "@type": "WebApplication",
          "name": "F&O Margin Calculator - Parasram India",
          "description": "Free online margin calculator for Futures & Options and equity trades. Calculate SPAN margin, exposure margin, leverage and required capital for NIFTY, BANKNIFTY, FINNIFTY trades.",
          "applicationCategory": "FinanceApplication",
          "operatingSystem": "Web Browser",
          "url": "https://www.sphpnp.com/margin-calculator",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "INR"
          },
          "provider": {
            "@type": "Organization",
            "name": "Shri Parasram Holdings Panipat",
            "url": "https://www.sphpnp.com"
          },
          "featureList": [
            "NIFTY futures margin calculation",
            "BANKNIFTY margin calculation",
            "Equity delivery and intraday margin",
            "Leverage calculation",
            "SPAN and exposure margin breakdown"
          ]
        }}
      />
      <ScrollProgress />
      <Header />
      <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Margin Calculator" }]} />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Calculator className="w-8 h-8 text-primary" />
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground">Margin Calculator</h1>
          </div>
          <p className="text-muted-foreground">Calculate required margin and leverage for F&O and equity trades</p>
        </motion.div>

        <Tabs defaultValue="futures" onValueChange={setSegment}>
          <TabsList className="mb-6">
            <TabsTrigger value="futures">Futures</TabsTrigger>
            <TabsTrigger value="equity">Equity</TabsTrigger>
          </TabsList>

          <TabsContent value="futures">
            <motion.div
              key="futures"
              className="grid md:grid-cols-2 gap-6"
              initial={{ opacity: 0, y: REVEAL_Y.item }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.base, ease: EASE_OUT }}
            >
              <Card className="p-6 space-y-4">
                <h2 className="font-semibold text-lg text-foreground">Trade Details</h2>
                <div className="space-y-3">
                  <div>
                    <Label>Index</Label>
                    <Select value={symbol} onValueChange={setSymbol}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(MARGIN_RATES).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Price (₹)</Label>
                    <Input type="number" value={price} onChange={e => setPrice(e.target.value)} />
                  </div>
                  <div>
                    <Label>Number of Lots</Label>
                    <Input type="number" min="1" value={lots} onChange={e => setLots(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>Lot size for {MARGIN_RATES[symbol].label}: {LOT_SIZES[symbol]} units</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6 space-y-4">
                <h2 className="font-semibold text-lg text-foreground">Margin Breakdown</h2>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Contract Value</span>
                    <span className="font-mono font-semibold">{fmt(futuresMargin.contractValue)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">SPAN Margin ({MARGIN_RATES[symbol].span}%)</span>
                    <span className="font-mono font-semibold text-brand-orange">{fmt(futuresMargin.spanMargin)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Exposure Margin ({MARGIN_RATES[symbol].exposure}%)</span>
                    <span className="font-mono font-semibold text-brand-orange">{fmt(futuresMargin.exposureMargin)}</span>
                  </div>
                  <div className="flex justify-between py-3 bg-primary/5 rounded-lg px-3">
                    <span className="font-semibold text-foreground">Total Margin Required</span>
                    <span className="font-mono font-bold text-lg text-primary">{fmt(futuresMargin.totalMargin)}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-sm text-muted-foreground">Leverage</span>
                    <Badge variant="secondary">{futuresMargin.leverage.toFixed(1)}x</Badge>
                  </div>
                </div>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="equity">
            <motion.div
              key="equity"
              className="grid md:grid-cols-2 gap-6"
              initial={{ opacity: 0, y: REVEAL_Y.item }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.base, ease: EASE_OUT }}
            >
              <Card className="p-6 space-y-4">
                <h2 className="font-semibold text-lg text-foreground">Trade Details</h2>
                <div className="space-y-3">
                  <div>
                    <Label>Segment</Label>
                    <Select value={equitySegment} onValueChange={setEquitySegment}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EQUITY_SEGMENTS.map(s => (
                          <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Stock Price (₹)</Label>
                    <Input type="number" value={equityPrice} onChange={e => setEquityPrice(e.target.value)} />
                  </div>
                  <div>
                    <Label>Quantity</Label>
                    <Input type="number" min="1" value={equityQty} onChange={e => setEquityQty(e.target.value)} />
                  </div>
                </div>
              </Card>

              <Card className="p-6 space-y-4">
                <h2 className="font-semibold text-lg text-foreground">Margin Summary</h2>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Trade Value</span>
                    <span className="font-mono font-semibold">{fmt(equityMargin.totalValue)}</span>
                  </div>
                  <div className="flex justify-between py-3 bg-primary/5 rounded-lg px-3">
                    <span className="font-semibold text-foreground">Margin Required</span>
                    <span className="font-mono font-bold text-lg text-primary">{fmt(equityMargin.required)}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-sm text-muted-foreground">Leverage</span>
                    <Badge variant="secondary">{equityMargin.leverage.toFixed(1)}x</Badge>
                  </div>
                </div>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>

        {/* Disclaimer */}
        <Card className="mt-8 p-4 bg-muted/30 border-muted">
          <p className="text-xs text-muted-foreground">
            <strong>Disclaimer:</strong> Margin requirements are approximate and may vary based on exchange regulations, volatility, and broker policies. Actual margins may differ. Please check with your broker for exact margin requirements.
          </p>
        </Card>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  </PageTransition>
  );
};

export default MarginCalculatorPage;