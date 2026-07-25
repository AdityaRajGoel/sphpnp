import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import SEOHead from "@/components/SEOHead";
import WhatsAppButton from "@/components/WhatsAppButton";
import ScrollProgress from "@/components/ScrollProgress";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IndianRupee, ArrowRight, TrendingUp, TrendingDown, Info, Calculator, BarChart3, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import PageTransition from "@/components/PageTransition";

/* ─── Parasram Brokerage & Statutory Rates (as of April 2026) ─── */

type SegmentConfig = {
  key: string;
  label: string;
  emoji: string;
  brokerageDesc: string;
  // Brokerage
  brokeragePercent?: number; // as decimal, e.g. 0.0015 = 0.15%
  brokerageFlatPerLot?: number; // flat ₹ per lot (options)
  // STT (effective 1 Apr 2026)
  sttBuyRate: number;
  sttSellRate: number;
  // Exchange transaction charge (NSE approx)
  exchangeRate: number;
  // Stamp duty (buy side only)
  stampRate: number;
};

const SEGMENTS: SegmentConfig[] = [
  {
    key: "equity_delivery",
    label: "Equity Delivery",
    emoji: "📦",
    brokerageDesc: "0.15% of turnover",
    brokeragePercent: 0.0015,
    sttBuyRate: 0.001,   // 0.1% buy
    sttSellRate: 0.001,  // 0.1% sell
    exchangeRate: 0.0000345,
    stampRate: 0.00015,  // 0.015%
  },
  {
    key: "equity_intraday",
    label: "Equity Intraday",
    emoji: "⚡",
    brokerageDesc: "0.015% of turnover",
    brokeragePercent: 0.00015,
    sttBuyRate: 0,
    sttSellRate: 0.00025, // 0.025% sell
    exchangeRate: 0.0000345,
    stampRate: 0.00003,   // 0.003%
  },
  {
    key: "futures",
    label: "F&O Futures",
    emoji: "📈",
    brokerageDesc: "0.015% of turnover",
    brokeragePercent: 0.00015,
    sttBuyRate: 0,
    sttSellRate: 0.0005,  // 0.05% sell (revised Apr 2026)
    exchangeRate: 0.0000190,
    stampRate: 0.00002,   // 0.002%
  },
  {
    key: "options",
    label: "F&O Options",
    emoji: "🎯",
    brokerageDesc: "₹15 per lot",
    brokerageFlatPerLot: 15,
    sttBuyRate: 0,
    sttSellRate: 0.0015,  // 0.15% on sell premium (revised Apr 2026)
    exchangeRate: 0.00053,
    stampRate: 0.00003,   // 0.003%
  },
  {
    key: "commodity",
    label: "Commodity",
    emoji: "🛢️",
    brokerageDesc: "0.015% of turnover",
    brokeragePercent: 0.00015,
    sttBuyRate: 0,
    sttSellRate: 0.0001, // CTT 0.01% sell
    exchangeRate: 0.00026,
    stampRate: 0.00002,
  },
  {
    key: "currency",
    label: "Currency",
    emoji: "💱",
    brokerageDesc: "0.015% of turnover",
    brokeragePercent: 0.00015,
    sttBuyRate: 0,
    sttSellRate: 0,
    exchangeRate: 0.00009,
    stampRate: 0.00001,
  },
];

type ChargeBreakdown = {
  brokerage: number;
  stt: number;
  exchangeTxn: number;
  gst: number;
  sebi: number;
  stampDuty: number;
  total: number;
};

function calculateCharges(
  segmentKey: string,
  buyPrice: number,
  sellPrice: number,
  qty: number
): ChargeBreakdown {
  const seg = SEGMENTS.find((s) => s.key === segmentKey)!;
  const buyValue = buyPrice * qty;
  const sellValue = sellPrice * qty;
  const turnover = buyValue + sellValue;

  // Brokerage
  let brokerage: number;
  if (seg.brokerageFlatPerLot != null) {
    // Options: ₹15 per lot × 2 sides
    brokerage = seg.brokerageFlatPerLot * 2;
  } else {
    brokerage = turnover * (seg.brokeragePercent ?? 0);
  }

  // STT
  const stt = buyValue * seg.sttBuyRate + sellValue * seg.sttSellRate;

  // Exchange transaction charges
  const exchangeTxn = turnover * seg.exchangeRate;

  // GST 18% on brokerage + exchange txn charges
  const gst = (brokerage + exchangeTxn) * 0.18;

  // SEBI turnover fees: ₹10 per crore = 0.0001%
  const sebi = turnover * 0.000001;

  // Stamp duty (buy side only)
  const stampDuty = buyValue * seg.stampRate;

  const total = brokerage + stt + exchangeTxn + gst + sebi + stampDuty;

  return { brokerage, stt, exchangeTxn, gst, sebi, stampDuty, total };
}

const fmt = (n: number) =>
  `₹${Math.abs(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const pct = (n: number) => `${(n * 100).toFixed(4)}%`;

/* ─── Component ─── */

const BrokerageCalculatorPage = () => {
  const [segment, setSegment] = useState("equity_intraday");
  const [buyPrice, setBuyPrice] = useState("1500");
  const [sellPrice, setSellPrice] = useState("1520");
  const [qty, setQty] = useState("100");
  const [showRateCard, setShowRateCard] = useState(false);

  const segConfig = SEGMENTS.find((s) => s.key === segment)!;

  const charges = useMemo(
    () =>
      calculateCharges(
        segment,
        parseFloat(buyPrice) || 0,
        parseFloat(sellPrice) || 0,
        parseInt(qty) || 0
      ),
    [segment, buyPrice, sellPrice, qty]
  );

  const buyVal = (parseFloat(buyPrice) || 0) * (parseInt(qty) || 0);
  const sellVal = (parseFloat(sellPrice) || 0) * (parseInt(qty) || 0);
  const turnover = buyVal + sellVal;
  const grossPnL = sellVal - buyVal;
  const netPnL = grossPnL - charges.total;

  const chargeRows = [
    { label: "Brokerage", value: charges.brokerage, hint: segConfig.brokerageDesc },
    {
      label: "STT / CTT",
      value: charges.stt,
      hint:
        segConfig.sttBuyRate > 0
          ? `Buy ${pct(segConfig.sttBuyRate)} + Sell ${pct(segConfig.sttSellRate)}`
          : segConfig.sttSellRate > 0
          ? `${pct(segConfig.sttSellRate)} on sell side`
          : "Not applicable",
    },
    {
      label: "Exchange Txn",
      value: charges.exchangeTxn,
      hint: `${pct(segConfig.exchangeRate)} of turnover`,
    },
    { label: "GST (18%)", value: charges.gst, hint: "On brokerage + exchange charges" },
    { label: "SEBI Charges", value: charges.sebi, hint: "₹10 per crore turnover" },
    {
      label: "Stamp Duty",
      value: charges.stampDuty,
      hint: `${pct(segConfig.stampRate)} on buy side`,
    },
  ];

  return (
    <PageTransition>
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Brokerage Calculator | Parasram India - Panipat"
        description="Calculate Parasram brokerage, STT, GST, exchange charges, and net P&L for equity, F&O, commodity, and currency trades. Updated for April 2026 STT rates."
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Brokerage Calculator" },
        ]}
        jsonLd={{
          "@type": "WebApplication",
          "name": "Brokerage Calculator - Parasram India",
          "description": "Free online brokerage calculator for Indian stock market trades. Calculates Parasram brokerage, STT, GST, exchange charges, SEBI fees, stamp duty, and net P&L.",
          "applicationCategory": "FinanceApplication",
          "operatingSystem": "Web Browser",
          "url": "https://www.sphpnp.com/brokerage-calculator",
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
            "Equity Delivery brokerage calculation",
            "Equity Intraday brokerage calculation",
            "F&O Futures and Options charges",
            "Commodity trading charges",
            "Currency segment charges",
            "STT, GST, Stamp Duty, SEBI fee breakdown"
          ]
        }}
      />
      <ScrollProgress />
      <Header />
      <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Brokerage Calculator" }]} />

      <main className="container mx-auto px-4 py-8 md:py-12 max-w-5xl">
        {/* ─── Hero ─── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10 text-center"
        >
          <motion.div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-blue-600 shadow-lg mb-4"
            whileHover={{ rotate: [0, -8, 8, 0], scale: 1.08 }}
          >
            <Calculator className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-2">
            Brokerage Calculator
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Estimate total trading charges including Parasram's brokerage, STT, GST & more - updated with{" "}
            <span className="text-secondary font-semibold">April 2026 STT rates</span>.
          </p>
        </motion.div>

        {/* ─── Segment Selector (pill bar) ─── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap justify-center gap-2 mb-8"
        >
          {SEGMENTS.map((seg) => (
            <button
              key={seg.key}
              onClick={() => setSegment(seg.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-fast ${
                segment === seg.key
                  ? "bg-primary text-primary-foreground shadow-md scale-105"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span className="mr-1.5">{seg.emoji}</span>
              {seg.label}
            </button>
          ))}
        </motion.div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* ─── Left: Inputs ─── */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="p-6 space-y-5 border-border/60 bg-card shadow-lg">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h2 className="font-heading font-semibold text-lg text-foreground">
                  Trade Details
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="segment-select" className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
                    Segment
                  </Label>
                  <Select value={segment} onValueChange={setSegment}>
                    <SelectTrigger id="segment-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEGMENTS.map((s) => (
                        <SelectItem key={s.key} value={s.key}>
                          {s.emoji} {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="buy-price" className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
                      Buy Price (₹)
                    </Label>
                    <Input
                      id="buy-price"
                      type="number"
                      min="0"
                      step="0.05"
                      value={buyPrice}
                      onChange={(e) => setBuyPrice(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sell-price" className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
                      Sell Price (₹)
                    </Label>
                    <Input
                      id="sell-price"
                      type="number"
                      min="0"
                      step="0.05"
                      value={sellPrice}
                      onChange={(e) => setSellPrice(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="quantity" className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
                    {segment === "options" ? "Quantity (Lot size × No. of lots)" : "Quantity"}
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>

              {/* ─── Quick Stats ─── */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-lg bg-muted/40 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                    Buy Value
                  </p>
                  <p className="font-mono text-sm font-semibold text-foreground">{fmt(buyVal)}</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                    Sell Value
                  </p>
                  <p className="font-mono text-sm font-semibold text-foreground">{fmt(sellVal)}</p>
                </div>
              </div>
            </Card>

            {/* Parasram Rate Card toggle */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-4"
            >
              <button
                onClick={() => setShowRateCard(!showRateCard)}
                className="w-full flex items-center justify-between gap-2 text-sm text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 rounded-lg px-4 py-3 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-primary" />
                  Parasram Brokerage Rate Card
                </span>
                {showRateCard ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <AnimatePresence>
                {showRateCard && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 rounded-lg border border-border/50 bg-card p-4 text-xs space-y-1.5">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {SEGMENTS.map((s) => (
                          <div key={s.key} className="flex justify-between">
                            <span className="text-muted-foreground">
                              {s.emoji} {s.label}
                            </span>
                            <span className="font-mono font-medium text-foreground">
                              {s.brokerageDesc}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-muted-foreground/70 pt-2 border-t border-border/30">
                        Rates are as per Parasram's standard plan. Contact your RM for negotiated rates.
                      </p>
                    </div>
                  </motion.div>
                  )}
              </AnimatePresence>
            </motion.div>
          </motion.div>

          {/* ─── Right: Results ─── */}
          <motion.div
            className="lg:col-span-3 space-y-6"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            {/* P&L Hero Card */}
            <Card
              className={`relative overflow-hidden border-0 shadow-xl ${
                netPnL >= 0
                  ? "bg-gradient-to-br from-secondary/10 via-brand-green/5 to-transparent"
                  : "bg-gradient-to-br from-destructive/10 via-red-500/5 to-transparent"
              }`}
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent" style={{ color: netPnL >= 0 ? "var(--secondary)" : "var(--destructive)" }} />
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-muted-foreground">Net Profit / Loss</span>
                  <motion.div
                    className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      netPnL >= 0
                        ? "bg-secondary/15 text-secondary"
                        : "bg-destructive/15 text-destructive"
                    }`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    key={netPnL >= 0 ? "profit" : "loss"}
                  >
                    {netPnL >= 0 ? (
                      <TrendingUp className="w-3.5 h-3.5" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5" />
                    )}
                    {netPnL >= 0 ? "Profit" : "Loss"}
                  </motion.div>
                </div>

                <motion.p
                  className={`text-4xl md:text-5xl font-bold font-mono tracking-tight ${
                    netPnL >= 0 ? "text-secondary" : "text-destructive"
                  }`}
                  key={netPnL}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {netPnL >= 0 ? "+" : "−"}{fmt(netPnL)}
                </motion.p>

                <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    Gross: <span className={`font-mono font-medium ${grossPnL >= 0 ? "text-secondary" : "text-destructive"}`}>{grossPnL >= 0 ? "+" : "−"}{fmt(grossPnL)}</span>
                  </span>
                  <ArrowRight className="w-3 h-3 opacity-40" />
                  <span className="flex items-center gap-1">
                    Charges: <span className="font-mono font-medium text-foreground">{fmt(charges.total)}</span>
                  </span>
                </div>
              </div>
            </Card>

            {/* Charge Breakdown */}
            <Card className="p-6 border-border/60 bg-card shadow-lg">
              <h2 className="font-heading font-semibold text-lg text-foreground mb-4 flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-primary" />
                Charge Breakdown
              </h2>

              <div className="space-y-0">
                {chargeRows.map((row, i) => (
                  <motion.div
                    key={row.label}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i }}
                    className="flex items-center justify-between py-3 border-b border-border/20 last:border-0 group"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm text-foreground">{row.label}</span>
                      <span className="text-[11px] text-muted-foreground/70">{row.hint}</span>
                    </div>
                    <span className="font-mono text-sm font-medium text-foreground tabular-nums">
                      {fmt(row.value)}
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* Total */}
              <div className="mt-4 flex items-center justify-between bg-primary/5 rounded-xl px-4 py-3.5">
                <span className="font-heading font-bold text-foreground">Total Charges</span>
                <span className="font-mono text-lg font-bold text-primary tabular-nums">
                  {fmt(charges.total)}
                </span>
              </div>

              {/* Charges % */}
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground px-1">
                <span>Charges as % of turnover</span>
                <span className="font-mono">
                  {turnover > 0 ? ((charges.total / turnover) * 100).toFixed(4) : "0.0000"}%
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1 mt-0.5">
                <span>Break-even points required</span>
                <span className="font-mono">
                  {(parseInt(qty) || 0) > 0
                    ? `₹${(charges.total / (parseInt(qty) || 1)).toFixed(2)}/share`
                    : "-"}
                </span>
              </div>
            </Card>

            {/* F&O Margin Calculator CTA */}
            <motion.a
              href="https://webtrade.parasramindia.com/calculator#!/span"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-xl border border-secondary/30 bg-secondary/5 hover:bg-secondary/10 px-5 py-4 transition-colors group"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <div>
                <p className="font-semibold text-foreground text-sm flex items-center gap-2">
                  🎯 F&O Margin Calculator (SPAN)
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Calculate SPAN & exposure margin requirements for your F&O positions
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-secondary opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-[opacity,transform] ease-out" />
            </motion.a>
          </motion.div>
        </div>

        {/* ─── Disclaimer ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
        >
          <Card className="mt-10 p-5 bg-muted/20 border-muted/50">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Disclaimer:</strong> These calculations are indicative and based on Parasram's standard brokerage plan and current statutory rates (STT revised effective 1 Apr 2026). Actual charges may vary based on your negotiated brokerage plan, exchange notifications, and regulatory changes. STT/CTT rates are as per current SEBI/Govt. guidelines. Please consult your Relationship Manager for exact charges.
            </p>
          </Card>
        </motion.div>
      </main>

      <Footer />
      <WhatsAppButton />
    </div>
    </PageTransition>
  );
};

export default BrokerageCalculatorPage;