import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { RevealText } from "@/components/ui/RevealText";
import {
  LineChart, Activity, Sparkles, PiggyBank, Rocket,
  Gem, Landmark, Vault, ArrowRight, BadgeCheck,
} from "lucide-react";
import { revealSection } from "@/lib/motion";

// Segmented product menu - the pattern both Motilal Oswal & Angel One lead
// with. Each card links to an existing route and maps to the parent
// company's product line (equity, F&O, MF, IPO, commodities, unlisted,
// bonds/FD, depository).
const products: { icon: typeof LineChart; title: string; desc: string; to: string; tag: string }[] = [
  { icon: LineChart, title: "Stocks & Equity", desc: "Invest in NSE & BSE listed companies with a free Demat account, backed by daily research from SEBI-registered analysts.", to: "/screener", tag: "Live Screener" },
  { icon: Activity, title: "Futures & Options", desc: "Trade NIFTY, BANKNIFTY & stock F&O with live option-chain tools.", to: "/fno", tag: "PCR & Max Pain" },
  { icon: PiggyBank, title: "Mutual Funds & SIP", desc: "Start a SIP from ₹500/month across direct & regular funds.", to: "/sip-calculator", tag: "From ₹500" },
  { icon: Rocket, title: "IPO Investments", desc: "Apply for upcoming IPOs online via UPI/ASBA in a few taps.", to: "/ipo", tag: "UPI / ASBA" },
  { icon: Gem, title: "Commodities (MCX)", desc: "Trade gold, silver, crude oil & agri commodities on MCX & NCDEX.", to: "/services", tag: "MCX · NCDEX" },
  { icon: Sparkles, title: "Unlisted & Pre-IPO", desc: "Buy verified pre-IPO and unlisted shares before they list on the exchange.", to: "/unlisted-space", tag: "Exclusive" },
  { icon: Landmark, title: "Bonds, FD & Insurance", desc: "Diversify beyond equity with FDs, corporate bonds & insurance.", to: "/products", tag: "Safer Yields" },
  { icon: Vault, title: "Demat & Depository", desc: "Secure CDSL/NSDL depository services, pledging & transfers.", to: "/depository-services", tag: "CDSL · NSDL" },
];


/**
 * A product directory, not a gallery: the heading and the account call to
 * action on the left (sticky on desktop), the eight products as a compact
 * two-column menu on the right. Deliberately no illustrations - the "How our
 * Panipat branch helps you" rows below carry the illustrated storytelling, so
 * the two sections no longer read as the same block twice.
 */
const InvestmentProducts = () => {
  return (
    <section aria-labelledby="invest-in-heading" className="bg-background py-12 md:py-20">
      <div className="container mx-auto grid gap-8 px-4 lg:grid-cols-12 lg:gap-12">
        <motion.div {...revealSection} className="lg:col-span-4 lg:sticky lg:top-28 lg:self-start">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-secondary">One platform · Every investment</p>
          <h2 id="invest-in-heading" className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground [text-wrap:balance] md:text-4xl">
            <RevealText text="Explore What You Can Invest In" />
          </h2>
          <p className="mt-3 text-muted-foreground">
            From equities to unlisted shares, a full-service brokerage with one Demat account and one branch that knows you.
          </p>
          <ul className="mt-5 space-y-2 text-sm">
            {["₹0 account opening", "SEBI-registered stockbroker", "NSE · BSE · MCX · NSDL · CDSL"].map((t) => (
              <li key={t} className="flex items-center gap-2 font-medium text-foreground"><BadgeCheck className="h-4 w-4 shrink-0 text-secondary" aria-hidden /> {t}</li>
            ))}
          </ul>
          <Link
            to="/open-account"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-secondary px-6 py-3 font-bold text-secondary-foreground shadow-sm transition-[box-shadow,transform] duration-base ease-out hover:bg-secondary/90 hover:shadow-md"
          >
            Open Free Demat Account <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </motion.div>

        <ul className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:col-span-8">
          {products.map((p) => {
            const Icon = p.icon;
            return (
              <li key={p.title} className="bg-card">
                <Link to={p.to} className="group flex h-full gap-4 p-5 transition-colors duration-base hover:bg-secondary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/10 text-secondary transition-colors duration-base group-hover:bg-secondary/15">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-heading font-semibold text-foreground transition-colors group-hover:text-secondary">{p.title}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-[transform,color] duration-base group-hover:translate-x-0.5 group-hover:text-secondary" aria-hidden />
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{p.desc}</span>
                    <span className="mt-2 block text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground/90">{p.tag}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};

export default InvestmentProducts;
