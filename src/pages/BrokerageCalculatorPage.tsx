import Header from "@/components/Header";
import PageHeader from "@/components/PageHeader";
import Footer from "@/components/Footer";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import SEOHead from "@/components/SEOHead";
import WhatsAppButton from "@/components/WhatsAppButton";
import ScrollProgress from "@/components/ScrollProgress";
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  IndianRupee, ArrowRight, TrendingUp, TrendingDown, Info, Calculator, BarChart3, ExternalLink, ChevronDown, ChevronUp, Scale,
} from "lucide-react";
import PageTransition from "@/components/PageTransition";
import { revealFade } from "@/lib/motion";
import {
  calculateCharges, formatRule, GST_RATE, RATE_CARD, RATES_AS_OF, SEGMENTS, segmentByKey, type SegmentKey,
} from "@/lib/brokerage";

// A worked example per segment, filled in when the segment changes, so every
// segment opens on numbers of the right size (a premium, a crude lot, a USDINR lot).
const EXAMPLES: Record<SegmentKey, { buy: string; sell: string; qty: string; lotSize: string; lots: string }> = {
  equity_delivery: { buy: "1500", sell: "1560", qty: "50", lotSize: "", lots: "" },
  equity_intraday: { buy: "1500", sell: "1520", qty: "100", lotSize: "", lots: "" },
  futures: { buy: "1500", sell: "1520", qty: "", lotSize: "500", lots: "1" },
  options: { buy: "100", sell: "120", qty: "", lotSize: "75", lots: "2" },
  currency_futures: { buy: "88.20", sell: "88.35", qty: "", lotSize: "1000", lots: "5" },
  currency_options: { buy: "0.40", sell: "0.55", qty: "", lotSize: "1000", lots: "5" },
  commodity_futures: { buy: "6500", sell: "6560", qty: "", lotSize: "100", lots: "1" },
  commodity_options: { buy: "150", sell: "175", qty: "", lotSize: "100", lots: "1" },
};

const fmt = (n: number) =>
  `₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (rate: number) => `${+(rate * 100).toFixed(5)}%`;
const num = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const FieldLabel = ({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) => (
  <Label htmlFor={htmlFor} className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
    {children}
  </Label>
);

const BrokerageCalculatorPage = () => {
  const [segment, setSegment] = useState<SegmentKey>("equity_intraday");
  const [buyPrice, setBuyPrice] = useState(EXAMPLES.equity_intraday.buy);
  const [sellPrice, setSellPrice] = useState(EXAMPLES.equity_intraday.sell);
  const [qty, setQty] = useState(EXAMPLES.equity_intraday.qty);
  const [lotSize, setLotSize] = useState("");
  const [lots, setLots] = useState("");
  const [showRateCard, setShowRateCard] = useState(false);

  const seg = segmentByKey(segment);

  const chooseSegment = (key: SegmentKey) => {
    const ex = EXAMPLES[key];
    setSegment(key);
    setBuyPrice(ex.buy);
    setSellPrice(ex.sell);
    setQty(ex.qty);
    setLotSize(ex.lotSize);
    setLots(ex.lots);
  };

  const quantity = seg.byLot ? num(lotSize) * Math.floor(num(lots)) : Math.floor(num(qty));
  const lotCount = seg.byLot ? Math.floor(num(lots)) : 0;

  const charges = useMemo(
    () => calculateCharges(seg, { buyPrice: num(buyPrice), sellPrice: num(sellPrice), quantity, lots: lotCount }),
    [seg, buyPrice, sellPrice, quantity, lotCount],
  );

  const grossPnL = charges.sellValue - charges.buyValue;
  const netPnL = grossPnL - charges.total;
  const isProfit = netPnL >= 0;
  const priceWord = seg.isOption ? "premium" : "price";

  const chargeRows = [
    { label: "Brokerage", value: charges.brokerage, hint: `${formatRule(seg.brokerage)}${seg.brokerage.kind === "perLot" ? ", each side" : " of turnover"}` },
    {
      label: seg.taxName,
      value: charges.stt,
      hint:
        seg.sttBuy > 0
          ? `${pct(seg.sttBuy)} on buy + ${pct(seg.sttSell)} on sell`
          : seg.sttSell > 0
          ? `${pct(seg.sttSell)} on the sell side${seg.isOption ? " (premium)" : ""}`
          : "Not charged on currency",
    },
    { label: "Exchange transaction", value: charges.exchange, hint: `${pct(seg.exchange)} of turnover (${seg.exchangeNote})` },
    { label: "SEBI fee", value: charges.sebi, hint: "₹10 per crore of turnover" },
    { label: `GST (${GST_RATE * 100}%)`, value: charges.gst, hint: "On brokerage, exchange charges and SEBI fee" },
    { label: "Stamp duty", value: charges.stamp, hint: `${pct(seg.stamp)} on the buy side` },
  ];

  return (
    <PageTransition>
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Brokerage Calculator | Parasram India - Panipat"
        description="Work out Parasram brokerage, STT, exchange charges, GST, stamp duty and net P&L for equity, F&O, currency and MCX trades at September 2026 rates."
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Brokerage Calculator" },
        ]}
        jsonLd={{
          "@type": "WebApplication",
          "name": "Brokerage Calculator - Parasram India",
          "description": "Free brokerage calculator for Indian trades: Parasram brokerage, STT/CTT, exchange transaction charges, SEBI fee, GST, stamp duty and net P&L.",
          "applicationCategory": "FinanceApplication",
          "operatingSystem": "Web Browser",
          "url": "https://www.sphpnp.com/brokerage-calculator",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "INR" },
          "provider": { "@type": "Organization", "name": "Shri Parasram Holdings Panipat", "url": "https://www.sphpnp.com" },
          "featureList": [
            "Equity delivery and intraday charges",
            "Equity futures and options, priced per lot",
            "Currency futures and options",
            "MCX commodity futures and options with CTT",
            "STT, exchange, SEBI, GST and stamp duty breakdown",
          ],
        }}
      />
      <ScrollProgress />
      <Header />
      <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Brokerage Calculator" }]} />

      <main className="container mx-auto px-4 py-8 md:py-12 max-w-5xl">
        <PageHeader
          className="mb-10"
          eyebrow={<><Calculator className="h-3.5 w-3.5" aria-hidden="true" /> Calculator</>}
          title="Brokerage Calculator"
          description={<>What a trade costs you: Parasram&apos;s brokerage plus every statutory charge, at <span className="font-semibold text-secondary">{RATES_AS_OF} rates</span>.</>}
        />

        {/* Segment picker */}
        <div role="group" aria-label="Segment" className="flex flex-wrap justify-center gap-2 mb-8">
          {SEGMENTS.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={segment === s.key}
              onClick={() => chooseSegment(s.key)}
              className={`min-h-[40px] px-4 py-2 rounded-full text-sm font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
                segment === s.key
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Inputs */}
          <div className="lg:col-span-2">
            <Card className="p-6 space-y-5 border-border/60 bg-card shadow-lg">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-5 h-5 text-primary" aria-hidden />
                <h2 className="font-heading font-semibold text-lg text-foreground">Trade details</h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel htmlFor="buy-price">Buy {priceWord} (₹)</FieldLabel>
                  <Input id="buy-price" type="number" inputMode="decimal" min="0" step="0.05" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} className="font-mono" />
                </div>
                <div>
                  <FieldLabel htmlFor="sell-price">Sell {priceWord} (₹)</FieldLabel>
                  <Input id="sell-price" type="number" inputMode="decimal" min="0" step="0.05" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} className="font-mono" />
                </div>
              </div>

              {seg.byLot ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel htmlFor="lot-size">Lot size</FieldLabel>
                    <Input id="lot-size" type="number" inputMode="numeric" min="1" value={lotSize} onChange={(e) => setLotSize(e.target.value)} className="font-mono" />
                  </div>
                  <div>
                    <FieldLabel htmlFor="lots">Lots</FieldLabel>
                    <Input id="lots" type="number" inputMode="numeric" min="1" step="1" value={lots} onChange={(e) => setLots(e.target.value)} className="font-mono" />
                  </div>
                  <p className="col-span-2 -mt-1 text-xs text-muted-foreground">
                    Quantity: <span className="font-mono text-foreground">{quantity.toLocaleString("en-IN")}</span> units. Lot size is on the contract in your trading app.
                  </p>
                </div>
              ) : (
                <div>
                  <FieldLabel htmlFor="quantity">Quantity (shares)</FieldLabel>
                  <Input id="quantity" type="number" inputMode="numeric" min="1" step="1" value={qty} onChange={(e) => setQty(e.target.value)} className="font-mono" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-lg bg-muted/40 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Buy value</p>
                  <p className="font-mono text-sm font-semibold text-foreground">{fmt(charges.buyValue)}</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Sell value</p>
                  <p className="font-mono text-sm font-semibold text-foreground">{fmt(charges.sellValue)}</p>
                </div>
              </div>
            </Card>

            {/* Rate card */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowRateCard(!showRateCard)}
                aria-expanded={showRateCard}
                aria-controls="rate-card"
                className="w-full flex items-center justify-between gap-2 text-sm text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 rounded-lg px-4 py-3 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-primary" aria-hidden />
                  Parasram brokerage rate card
                </span>
                {showRateCard ? <ChevronUp className="w-4 h-4" aria-hidden /> : <ChevronDown className="w-4 h-4" aria-hidden />}
              </button>
              <AnimatePresence>
                {showRateCard && (
                  <motion.div
                    id="rate-card"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 rounded-lg border border-border/50 bg-card p-4 text-xs">
                      <dl className="space-y-1.5">
                        {RATE_CARD.map((r) => (
                          <div key={r.id} className="flex justify-between gap-3">
                            <dt className="text-muted-foreground">{r.label}</dt>
                            <dd className="font-mono font-medium text-foreground">{formatRule(r.rule)}</dd>
                          </div>
                        ))}
                      </dl>
                      <p className="text-muted-foreground/80 pt-2 mt-2 border-t border-border/30">
                        Per-lot rates apply to each side. Standard plan; ask your RM about a{" "}
                        <Link to="/pricing" className="underline underline-offset-2 hover:text-secondary">custom plan</Link>.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-3 space-y-6" aria-live="polite">
            <Card
              className={`relative overflow-hidden border-0 shadow-xl ${
                isProfit
                  ? "bg-gradient-to-br from-secondary/10 via-brand-green/5 to-transparent"
                  : "bg-gradient-to-br from-destructive/10 via-red-500/5 to-transparent"
              }`}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-muted-foreground">Net profit / loss after charges</span>
                  <span
                    className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      isProfit ? "bg-secondary/15 text-secondary" : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {isProfit ? <TrendingUp className="w-3.5 h-3.5" aria-hidden /> : <TrendingDown className="w-3.5 h-3.5" aria-hidden />}
                    {isProfit ? "Profit" : "Loss"}
                  </span>
                </div>
                <p className={`text-4xl md:text-5xl font-bold font-mono tracking-tight tabular-nums ${isProfit ? "text-secondary" : "text-destructive"}`}>
                  {isProfit ? "+" : "−"}{fmt(netPnL)}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 text-sm text-muted-foreground">
                  <span>
                    Gross: <span className={`font-mono font-medium ${grossPnL >= 0 ? "text-secondary" : "text-destructive"}`}>{grossPnL >= 0 ? "+" : "−"}{fmt(grossPnL)}</span>
                  </span>
                  <ArrowRight className="w-3 h-3 opacity-40" aria-hidden />
                  <span>
                    Charges: <span className="font-mono font-medium text-foreground">{fmt(charges.total)}</span>
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-border/60 bg-card shadow-lg">
              <h2 className="font-heading font-semibold text-lg text-foreground mb-4 flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-primary" aria-hidden />
                Charge breakdown
              </h2>
              <dl>
                {chargeRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4 py-3 border-b border-border/20 last:border-0">
                    <dt className="flex flex-col">
                      <span className="text-sm text-foreground">{row.label}</span>
                      <span className="text-[11px] text-muted-foreground">{row.hint}</span>
                    </dt>
                    <dd className="font-mono text-sm font-medium text-foreground tabular-nums">{fmt(row.value)}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex items-center justify-between bg-primary/5 rounded-xl px-4 py-3.5">
                <span className="font-heading font-bold text-foreground">Total charges</span>
                <span className="font-mono text-lg font-bold text-primary tabular-nums">{fmt(charges.total)}</span>
              </div>
              <dl className="mt-3 space-y-1 px-1 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <dt>Charges as % of turnover</dt>
                  <dd className="font-mono">{charges.turnover > 0 ? ((charges.total / charges.turnover) * 100).toFixed(4) : "0.0000"}%</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>{seg.isOption ? "Premium" : "Price"} move needed to break even</dt>
                  <dd className="font-mono">{quantity > 0 ? `₹${(charges.total / quantity).toFixed(4)} per unit` : "-"}</dd>
                </div>
              </dl>
            </Card>

            {/* Brokerage is a cost; margin is money blocked. Two calculators, on purpose. */}
            <Card className="p-5 border-secondary/30 bg-secondary/5">
              <p className="font-semibold text-foreground flex items-center gap-2">
                <Scale className="w-4 h-4 text-secondary" aria-hidden /> Brokerage and margin are different things
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Brokerage and the charges above are what a trade <strong className="text-foreground">costs</strong> you. Margin is the money a
                position <strong className="text-foreground">blocks</strong> in your account while it is open, and you get it back when you close.
                Work it out separately:
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Link
                  to="/margin-calculator"
                  className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-secondary"
                >
                  <span>
                    <span className="block text-sm font-semibold text-foreground">Margin Calculator</span>
                    <span className="block text-xs text-muted-foreground">NSE F&amp;O and MCX, SPAN + exposure</span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-secondary transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
                <a
                  href="https://webtrade.parasramindia.com/calculator#!/span"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-secondary"
                >
                  <span>
                    <span className="block text-sm font-semibold text-foreground">SPAN calculator on Parasram Trade</span>
                    <span className="block text-xs text-muted-foreground">webtrade.parasramindia.com</span>
                  </span>
                  <ExternalLink className="w-4 h-4 text-muted-foreground" aria-hidden />
                </a>
              </div>
            </Card>
          </div>
        </div>

        <motion.div {...revealFade} transition={{ delay: 0.3 }}>
          <Card className="mt-10 p-5 bg-muted/20 border-muted/50">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Disclaimer:</strong> An estimate on Parasram&apos;s standard plan and the statutory rates in force in {RATES_AS_OF}:
              STT as revised from 1 April 2026, NSE and MCX transaction charges as revised from 1 October 2024, stamp duty on the buy side
              only. Your contract note rounds each charge and may differ by a few paise; DP charges on delivery sales, NSE&apos;s IPFT levy and
              any negotiated brokerage are not included. Please check with your Relationship Manager for exact charges.
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
