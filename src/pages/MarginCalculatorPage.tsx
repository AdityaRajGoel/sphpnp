import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import WhatsAppButton from "@/components/WhatsAppButton";
import ScrollProgress from "@/components/ScrollProgress";
import { useState, useMemo, useEffect, useRef } from "react";
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
import { useQuery } from "@tanstack/react-query";
import { getFoContracts, type FoContract } from "@/lib/fo-contracts";

/** Approximate SPAN and exposure percentages. Indices carry their own; stock futures use a typical rate. */
const MARGIN_RATES: Record<string, { span: number; exposure: number }> = {
  NIFTY: { span: 9, exposure: 3 },
  BANKNIFTY: { span: 10, exposure: 3.5 },
  FINNIFTY: { span: 9.5, exposure: 3 },
  MIDCPNIFTY: { span: 11, exposure: 3.5 },
};
const STOCK_RATE = { span: 15, exposure: 5 };
const rateFor = (symbol: string) => MARGIN_RATES[symbol] ?? STOCK_RATE;

/**
 * Used only if the lot-size table cannot be read. These were the calculator's
 * hardcoded sizes, and they had fallen far behind NSE's revisions (NIFTY is 65,
 * not 25), understating every index margin by more than half - so the live
 * table is the source and this list only keeps the page usable offline.
 */
const FALLBACK_CONTRACTS: FoContract[] = [
  { symbol: "NIFTY", underlying: "NIFTY 50", lot_size: 65, spot: null, spot_date: null, isIndex: true },
  { symbol: "BANKNIFTY", underlying: "NIFTY BANK", lot_size: 30, spot: null, spot_date: null, isIndex: true },
  { symbol: "FINNIFTY", underlying: "NIFTY FINANCIAL SERVICES", lot_size: 60, spot: null, spot_date: null, isIndex: true },
  { symbol: "MIDCPNIFTY", underlying: "NIFTY MID SELECT", lot_size: 120, spot: null, spot_date: null, isIndex: true },
];

/**
 * Shown on the page AND sent as FAQ schema - Google only honours FAQ markup for
 * questions that are visible. Written for the searches this page gets
 * impressions for (Search Console, Jun-Sep 2026): "what is exposure margin",
 * "span margin vs exposure margin", "option selling margin calculator".
 */
const MARGIN_FAQ = [
  { question: "What is SPAN margin?", answer: "SPAN (Standard Portfolio Analysis of Risk) margin is the minimum margin NSE requires to hold a futures or short options position. The exchange computes it from the worst likely one-day loss on the position across a range of price and volatility scenarios." },
  { question: "What is exposure margin?", answer: "Exposure margin is collected on top of SPAN margin as a buffer against moves larger than the SPAN scenarios. For index derivatives it is typically about 2-3% of the contract value; for stock derivatives it is higher." },
  { question: "What is the difference between SPAN margin and exposure margin?", answer: "SPAN margin covers the modelled worst-case one-day loss; exposure margin is an extra cushion above it. The total margin blocked for a futures or option-selling position is SPAN plus exposure." },
  { question: "How much margin is needed to sell options?", answer: "Selling an option needs roughly the same SPAN plus exposure margin as a futures position on the same underlying, reduced when the position is hedged. Buying an option needs only the premium, with no SPAN or exposure margin." },
  { question: "What is the NIFTY lot size?", answer: "NSE revises lot sizes periodically. This calculator reads NSE's current lot size for every F&O contract rather than a fixed list, and shows it for the contract you choose." },
  { question: "How is intraday equity margin calculated?", answer: "Intraday (MIS) equity trades require a fraction of the trade value as margin, set by the exchange's peak-margin rules and the broker; delivery (CNC) trades require the full value. The calculator applies typical percentages for each." },
];

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

  const contractsQuery = useQuery({ queryKey: ["fo-contracts"], queryFn: getFoContracts, staleTime: 60 * 60_000 });
  const contracts = contractsQuery.data?.length ? contractsQuery.data : FALLBACK_CONTRACTS;
  const contract = contracts.find((c) => c.symbol === symbol) ?? contracts[0];
  const [contractSearch, setContractSearch] = useState("");
  const [lotFilter, setLotFilter] = useState("");
  const listed = contracts.filter((c) => !contractSearch || `${c.symbol} ${c.underlying}`.toLowerCase().includes(contractSearch.toLowerCase())).slice(0, 80);

  /** Choosing a contract also fills in its last end-of-day spot, when there is one. */
  const chooseContract = (next: string) => {
    setSymbol(next);
    const found = contracts.find((c) => c.symbol === next);
    if (found?.spot) setPrice(String(Math.round(found.spot * 100) / 100));
  };

  // The default NIFTY price is a placeholder until the snapshot arrives; replace it once.
  const spotApplied = useRef(false);
  useEffect(() => {
    if (spotApplied.current || !contractsQuery.data?.length) return;
    spotApplied.current = true;
    const initial = contractsQuery.data.find((c) => c.symbol === "NIFTY");
    if (initial?.spot) setPrice(String(Math.round(initial.spot * 100) / 100));
  }, [contractsQuery.data]);

  const futuresMargin = useMemo(() => {
    const p = parseFloat(price) || 0;
    const l = parseInt(lots) || 1;
    const rate = rateFor(symbol);
    const lotSize = contract.lot_size;
    const contractValue = p * lotSize * l;
    const spanMargin = (contractValue * rate.span) / 100;
    const exposureMargin = (contractValue * rate.exposure) / 100;
    const totalMargin = spanMargin + exposureMargin;
    return { contractValue, spanMargin, exposureMargin, totalMargin, lotSize, leverage: totalMargin > 0 ? contractValue / totalMargin : 0 };
  }, [price, lots, symbol, contract.lot_size]);

  const equityMargin = useMemo(() => {
    const p = parseFloat(equityPrice) || 0;
    const q = parseInt(equityQty) || 0;
    const seg = EQUITY_SEGMENTS.find(s => s.key === equitySegment)!;
    const totalValue = p * q;
    const required = (totalValue * seg.marginPct) / 100;
    return { totalValue, required, leverage: required > 0 ? totalValue / required : 0 };
  }, [equityPrice, equityQty, equitySegment]);

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  return (
    <PageTransition>
    <div className="min-h-screen bg-background">
      <SEOHead 
        title="NSE F&O Margin Calculator: SPAN + Exposure for NIFTY, BANKNIFTY & Stocks | Parasram India"
        description="Free NSE F&O margin calculator with current lot sizes for all 216 contracts. Estimate SPAN and exposure margin, leverage and capital for NIFTY, BANKNIFTY, FINNIFTY and stock futures, plus equity intraday and delivery."
        faqItems={MARGIN_FAQ}
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
                    <Label htmlFor="fo-contract">Contract</Label>
                    <Select value={symbol} onValueChange={chooseContract}>
                      <SelectTrigger id="fo-contract" aria-label="F&O contract"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-80">
                        <div className="p-2">
                          <Input
                            placeholder={`Search ${contracts.length} contracts`}
                            value={contractSearch}
                            onChange={(e) => setContractSearch(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="h-8 text-sm"
                            aria-label="Search contracts"
                          />
                        </div>
                        {(listed.some((c) => c.symbol === symbol) ? listed : [contract, ...listed]).map((c) => (
                          <SelectItem key={c.symbol} value={c.symbol}>
                            {c.symbol}{c.isIndex ? " · index" : ""} <span className="text-muted-foreground">({c.lot_size})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="fo-price">Price (₹)</Label>
                    <Input id="fo-price" type="number" inputMode="decimal" min="0" step="0.05" value={price} onChange={e => setPrice(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="fo-lots">Number of Lots</Label>
                    <Input id="fo-lots" type="number" inputMode="numeric" min="1" step="1" value={lots} onChange={e => setLots(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {contract.underlying}: lot size {contract.lot_size.toLocaleString("en-IN")} units
                      {contract.spot ? ` · last close ₹${contract.spot.toLocaleString("en-IN")} (${contract.spot_date})` : ""}
                      {contractsQuery.data?.length ? " · NSE lot sizes" : " · offline fallback sizes"}
                    </span>
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
                    <span className="text-sm text-muted-foreground">SPAN Margin (~{rateFor(symbol).span}%)</span>
                    <span className="font-mono font-semibold text-brand-orange">{fmt(futuresMargin.spanMargin)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Exposure Margin (~{rateFor(symbol).exposure}%)</span>
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
                    <Label htmlFor="eq-segment">Segment</Label>
                    <Select value={equitySegment} onValueChange={setEquitySegment}>
                      <SelectTrigger id="eq-segment"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EQUITY_SEGMENTS.map(s => (
                          <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="eq-price">Stock Price (₹)</Label>
                    <Input id="eq-price" type="number" inputMode="decimal" min="0" step="0.05" value={equityPrice} onChange={e => setEquityPrice(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="eq-qty">Quantity</Label>
                    <Input id="eq-qty" type="number" inputMode="numeric" min="1" step="1" value={equityQty} onChange={e => setEquityQty(e.target.value)} />
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

        <section aria-labelledby="lot-sizes" className="mt-10">
          <h2 id="lot-sizes" className="text-2xl font-heading font-bold">NSE F&amp;O lot sizes</h2>
          <p className="mt-1 mb-3 text-sm text-muted-foreground">
            Current lot size for every F&amp;O contract, with the last closing price and the value of one lot. Click a row to calculate its margin.
          </p>
          <Input
            aria-label="Filter lot sizes"
            placeholder="Filter by symbol or name"
            value={lotFilter}
            onChange={(e) => setLotFilter(e.target.value)}
            className="mb-3 max-w-xs"
          />
          <Card className="max-h-[28rem] overflow-auto p-0">
            <table className="w-full text-sm">
              <caption className="sr-only">NSE F&amp;O lot sizes</caption>
              <thead className="sticky top-0 bg-card/95 backdrop-blur text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2 text-left font-medium">Symbol</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Underlying</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Lot size</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Last close</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">1 lot value</th>
                </tr>
              </thead>
              <tbody>
                {contracts
                  .filter((c) => !lotFilter || `${c.symbol} ${c.underlying}`.toLowerCase().includes(lotFilter.toLowerCase()))
                  .map((c) => (
                    <tr key={c.symbol} className={`border-t cursor-pointer hover:bg-muted/30 ${c.symbol === symbol ? "bg-primary/5" : ""}`} onClick={() => { chooseContract(c.symbol); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                      <td className="px-4 py-2 font-semibold">{c.symbol}{c.isIndex && <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">index</span>}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{c.underlying}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.lot_size.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.spot ? `₹${c.spot.toLocaleString("en-IN")}` : "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{c.spot ? fmt(c.spot * c.lot_size) : "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Card>
        </section>

        <section aria-labelledby="margin-faq" className="mt-10">
          <h2 id="margin-faq" className="text-2xl font-heading font-bold mb-3">SPAN, exposure and option margin: common questions</h2>
          <div className="divide-y rounded-lg border">
            {MARGIN_FAQ.map((f) => (
              <details key={f.question} className="group px-4 py-3">
                <summary className="cursor-pointer list-none font-semibold marker:content-none flex items-center justify-between gap-3">
                  {f.question}
                  <span className="text-muted-foreground transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{f.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Disclaimer */}
        <Card className="mt-8 p-4 bg-muted/30 border-muted">
          <p className="text-xs text-muted-foreground">
            <strong>Disclaimer:</strong> Lot sizes are NSE's current sizes; SPAN and exposure percentages are approximations (index-specific for indices, a typical {STOCK_RATE.span}% + {STOCK_RATE.exposure}% for stock futures). Margin requirements are approximate and may vary based on exchange regulations, volatility, and broker policies. Actual margins may differ. Please check with your broker for exact margin requirements.
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