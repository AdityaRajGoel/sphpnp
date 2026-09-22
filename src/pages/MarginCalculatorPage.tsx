import { useSearchParams } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import SpanCalculator from "@/components/margin/SpanCalculator";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import WhatsAppButton from "@/components/WhatsAppButton";
import ScrollProgress from "@/components/ScrollProgress";
import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  const [equityPrice, setEquityPrice] = useState("1500");
  const [equityQty, setEquityQty] = useState("100");
  const [equitySegment, setEquitySegment] = useState("delivery");

  const contractsQuery = useQuery({ queryKey: ["fo-contracts"], queryFn: getFoContracts, staleTime: 60 * 60_000 });
  const contracts = contractsQuery.data?.length ? contractsQuery.data : FALLBACK_CONTRACTS;
  const [lotFilter, setLotFilter] = useState("");

  // Stock pages link here as /margin-calculator?symbol=TCS (the canonical drops the
  // query), and a click in the margin list below does the same: both seed the
  // SPAN calculator's contract search.
  const [params] = useSearchParams();
  const [seed, setSeed] = useState<string | undefined>(params.get("symbol")?.toUpperCase() || undefined);
  const openInCalculator = (symbol: string) => {
    setSeed(symbol);
    document.getElementById("span-add")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

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
        title="NSE F&O Margin Calculator: SPAN + Exposure | Parasram India"
        description="Free NSE F&O margin calculator with current lot sizes: SPAN and exposure margin, leverage and capital for NIFTY, BANKNIFTY and stock futures."
        faqItems={MARGIN_FAQ}
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "F&O Margin Calculator" },
        ]}
        jsonLd={{
          "@type": "WebApplication",
          "name": "F&O Margin Calculator - Parasram India",
          "description": "Free F&O margin calculator: exact SPAN and exposure margin for any mix of NSE futures and options positions, from the exchanges' SPAN files, plus the NSE F&O margin list and equity margin.",
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
            "Exact SPAN and exposure margin from the exchanges' SPAN files",
            "Multi-leg strategies: futures and options, buy and sell, with hedge and spread offsets",
            "Net option premium and total amount required",
            "NSE F&O margin list with lot sizes for every contract",
            "Equity delivery and intraday margin"
          ]
        }}
      />
      <ScrollProgress />
      <Header />
      <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "F&O Margin Calculator" }]} />
      <main>
        {/* Header in the style of the group's webtrade calculator (see SpanCalculator). */}
        <section className="bg-[#F4F7FB] px-4 pb-12 pt-10 text-center font-sans text-[#445A64]">
          <h1 className="text-3xl font-light md:text-[36px]">F&amp;O Margin Calculator</h1>
          <div className="mx-auto mt-5 h-[3px] w-[100px] bg-[#E9671D]" aria-hidden="true" />
          <div className="mx-auto mt-6 max-w-[830px] space-y-4 text-sm leading-6">
            <p>
              Calculate the SPAN margin and exposure margin the exchange requires for futures and option writing, with the
              premium for options you buy. Add every leg of your strategy: the margin is worked out for the whole portfolio,
              so hedges and spreads get their offset, as they do at the exchange.
            </p>
            <p>
              Margins come from the exchanges&apos; SPAN files, which Parasram&apos;s trading platform loads several times a day.
              Covers NSE F&amp;O, NSE currency and MCX commodity contracts; buying an option needs only its premium.
            </p>
          </div>
        </section>

        <SpanCalculator seed={seed} />

        <div className="container mx-auto max-w-4xl px-4 py-10">
        <section aria-labelledby="equity-margin">
          <h2 id="equity-margin" className="text-2xl font-heading font-bold">Equity delivery and intraday margin</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">Cash-market trades: delivery needs the full value; intraday needs a fraction set by the exchange&apos;s peak-margin rules.</p>
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="p-6 space-y-4">
                <h3 className="font-semibold text-lg text-foreground">Trade details</h3>
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
                <h3 className="font-semibold text-lg text-foreground">Margin summary</h3>
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
            </div>
        </section>

        <section aria-labelledby="lot-sizes" className="mt-10">
          <h2 id="lot-sizes" className="text-2xl font-heading font-bold">NSE F&amp;O margin list: lot sizes and margin per lot</h2>
          <p className="mt-1 mb-3 text-sm text-muted-foreground">
            Current lot size for every F&amp;O contract, with the last closing price, the value of one lot and the approximate margin to hold it (SPAN + exposure, at the rates this calculator uses). Click a row to find its contracts in the SPAN calculator above for the exact figure.
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
              <caption className="sr-only">NSE F&amp;O margin list</caption>
              <thead className="sticky top-0 bg-card/95 backdrop-blur text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2 text-left font-medium">Symbol</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Underlying</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Lot size</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Last close</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">1 lot value</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium" title="SPAN + exposure at the approximate rates above; your broker's figure will differ">Approx. margin / lot</th>
                </tr>
              </thead>
              <tbody>
                {contracts
                  .filter((c) => !lotFilter || `${c.symbol} ${c.underlying}`.toLowerCase().includes(lotFilter.toLowerCase()))
                  .map((c) => (
                    <tr key={c.symbol} className="border-t cursor-pointer hover:bg-muted/30" onClick={() => openInCalculator(c.symbol)}>
                      <td className="px-4 py-2 font-semibold">{c.symbol}{c.isIndex && <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">index</span>}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{c.underlying}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.lot_size.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.spot ? `₹${c.spot.toLocaleString("en-IN")}` : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.spot ? fmt(c.spot * c.lot_size) : "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{c.spot ? fmt((c.spot * c.lot_size * (rateFor(c.symbol).span + rateFor(c.symbol).exposure)) / 100) : "—"}</td>
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
            <strong>Disclaimer:</strong> The SPAN calculator above uses the exchanges' SPAN files through Parasram's trading platform; your broker may collect more than the exchange minimum. The margin list's per-lot figures are quick approximations at typical SPAN and exposure rates ({STOCK_RATE.span}% + {STOCK_RATE.exposure}% for stock futures, index-specific for indices); use the calculator for the exact figure. Lot sizes are NSE's current sizes. Not investment advice.
          </p>
        </Card>
        </div>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  </PageTransition>
  );
};

export default MarginCalculatorPage;