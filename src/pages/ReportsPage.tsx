import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import PageTransition from "@/components/PageTransition";
import ScrollProgress from "@/components/ScrollProgress";
import WhatsAppButton from "@/components/WhatsAppButton";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import {
  FileDown, ExternalLink, BarChart3, LineChart, Table2, TrendingUp,
  CalendarDays, Building2, Info, ArrowRight,
} from "lucide-react";
import { useBhavcopy } from "@/hooks/useBhavcopy";
import { downloadCsv } from "@/lib/exportData";

type LinkItem = {
  label: string;
  desc: string;
  href: string;
  external?: boolean;
};

type Section = {
  title: string;
  subtitle: string;
  icon: typeof FileDown;
  items: LinkItem[];
};

// Official EOD/bhavcopy sources are linked (not mirrored) so we stay within the
// exchanges' data terms. Internal tools serve delayed/derived data we already hold.
const sections: Section[] = [
  {
    title: "End-of-Day Reports & Bhavcopy",
    subtitle: "Official daily price, volume & open-interest files, straight from the exchanges.",
    icon: FileDown,
    items: [
      { label: "NSE Equity Bhavcopy & Reports", desc: "Daily equities price-volume, indices, MF, SLB and SME reports.", href: "https://www.nseindia.com/all-reports", external: true },
      { label: "NSE Derivatives (F&O) Reports", desc: "Daily F&O bhavcopy, participant-wise OI and derivatives statistics.", href: "https://www.nseindia.com/all-reports-derivatives", external: true },
      { label: "BSE Bhavcopy", desc: "Security-wise price, volume and deliverables plus full bhavcopy downloads.", href: "https://www.bseindia.com/markets/MarketInfo/BhavCopy.aspx", external: true },
      { label: "MCX Bhavcopy", desc: "Contract-wise OHLC, volume, value and open interest for commodities.", href: "https://www.mcxindia.com/market-data/bhavcopy", external: true },
    ],
  },
  {
    title: "Our Market Tools",
    subtitle: "Screen, analyse and export data on our own dashboards — no login needed.",
    icon: BarChart3,
    items: [
      { label: "Stock Screener", desc: "Filter NSE/BSE stocks by fundamentals and technicals. CSV export built in.", href: "/screener" },
      { label: "F&O Options Chain", desc: "NIFTY, BANKNIFTY & FINNIFTY option chain, PCR and Max Pain. Export to CSV.", href: "/fno" },
      { label: "52-Week High/Low Tracker", desc: "Stocks near their 52-week highs and lows across sectors.", href: "/52-week-tracker" },
      { label: "Stock Comparison", desc: "Compare two stocks side-by-side on key ratios and performance.", href: "/compare" },
    ],
  },
  {
    title: "Reference Data & Filings",
    subtitle: "FII/DII activity, corporate actions and the trading calendar.",
    icon: Info,
    items: [
      { label: "FII / DII Activity (NSE)", desc: "Daily foreign and domestic institutional cash-market flows.", href: "https://www.nseindia.com/reports/fii-dii", external: true },
      { label: "Corporate Actions (NSE)", desc: "Dividends, bonuses, splits and record dates for listed companies.", href: "https://www.nseindia.com/companies-listing/corporate-filings-actions", external: true },
      { label: "MCX Historical Reports", desc: "Historical commodity market data and periodic reports archive.", href: "https://www.mcxindia.com/market-data/reports-on-historical-data", external: true },
      { label: "Trading Holiday Calendar", desc: "NSE, BSE & MCX holidays for the current year, at a glance.", href: "/holidays" },
    ],
  },
];

const iconFor = (label: string) => {
  if (label.includes("Screener")) return Table2;
  if (label.includes("Option") || label.includes("F&O")) return LineChart;
  if (label.includes("52-Week")) return TrendingUp;
  if (label.includes("Comparison")) return BarChart3;
  if (label.includes("Holiday")) return CalendarDays;
  if (label.includes("Corporate")) return Building2;
  return FileDown;
};

// Our own EOD delivery dataset (fed by sync-bhavcopy). Real, downloadable data -
// degrades to a "coming soon" note until the pipeline is deployed and first run.
const EODDeliveryPanel = () => {
  const { rows, asOf, loading } = useBhavcopy();

  // Reserve the panel's footprint while loading rather than returning null.
  // Returning null here was the single largest layout shift on this page.
  if (loading) {
    return (
      <div className="mb-10 rounded-2xl border border-border/60 bg-card p-5" aria-busy="true">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <Table2 className="w-5 h-5 text-secondary" /> EOD Delivery Data
        </div>
        <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="mt-1.5 h-4 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!asOf || rows.length === 0) {
    return (
      <div className="mb-10 rounded-2xl border border-border/60 bg-card p-5">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <Table2 className="w-5 h-5 text-secondary" /> EOD Delivery Data
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Our own daily NSE delivery dataset is being set up. Until then, use the official
          bhavcopy links below.
        </p>
      </div>
    );
  }

  const handleDownload = () => {
    const headers = ["Symbol", "Series", "Date", "Close", "Prev Close", "Traded Qty", "Delivery Qty", "Delivery %"];
    const body = rows.map((r) => [r.symbol, r.series, r.trade_date, r.close, r.prev_close, r.ttl_trd_qty, r.deliv_qty, r.deliv_per]);
    downloadCsv(`nse-eod-bhavcopy-${asOf}`, headers, body);
  };

  const leaders = rows.filter((r) => r.series === "EQ" && r.deliv_per != null).slice(0, 8);

  return (
    <div className="mb-10 rounded-2xl border border-secondary/30 bg-secondary/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 text-foreground font-bold">
            <Table2 className="w-5 h-5 text-secondary" /> NSE EOD Bhavcopy &amp; Delivery
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Security-wise price + delivery. As of {asOf} · {rows.length.toLocaleString("en-IN")} securities.
          </p>
        </div>
        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full bg-brand-green text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <FileDown className="w-4 h-4" /> Download CSV
        </button>
      </div>
      <div className="text-xs font-semibold text-muted-foreground mb-2">Highest delivery % today</div>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
        {leaders.map((r) => (
          <div key={r.symbol} className="flex items-center justify-between text-sm border-b border-border/30 py-1.5">
            <span className="font-medium text-foreground truncate">{r.symbol}</span>
            <span className="font-mono text-secondary font-semibold">{r.deliv_per?.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ReportsPage = () => {
  return (
    <PageTransition>
      <SEOHead
        title="Market Reports & Data Downloads | Parasram India Panipat"
        description="Download NSE, BSE & MCX bhavcopy and end-of-day reports, track FII/DII activity and corporate actions, and export option-chain and screener data - all from Parasram India Panipat."
        canonical="https://www.sphpnp.com/reports"
        breadcrumbs={[{ name: "Home", url: "/" }, { name: "Reports & Downloads" }]}
        jsonLd={{
          "@type": "CollectionPage",
          name: "Market Reports & Data Downloads",
          description: "Curated NSE, BSE and MCX end-of-day reports, bhavcopy downloads, FII/DII activity and market tools from Parasram India Panipat.",
          provider: { "@type": "FinancialService", name: "Shri Parasram Holdings Panipat", url: "https://www.sphpnp.com" },
        }}
      />
      <ScrollProgress />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Reports & Downloads" }]} />

        {/* Hero */}
        <section className="pt-16 pb-8 md:pt-24 md:pb-14 bg-hero text-primary-foreground text-center">
          <div className="container mx-auto px-4">
            <motion.span
              className="inline-flex items-center gap-1.5 text-brand-gold font-semibold text-sm uppercase tracking-[0.15em] mb-3"
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            >
              <FileDown className="w-4 h-4" /> Data &amp; Downloads
            </motion.span>
            <motion.h1
              className="text-3xl md:text-5xl font-heading font-bold mb-4 text-white"
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            >
              Market Reports &amp; Downloads
            </motion.h1>
            <motion.p
              className="text-lg text-primary-foreground/80 max-w-2xl mx-auto"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            >
              Official exchange bhavcopy and end-of-day reports, plus our own screeners
              and option-chain tools with one-click CSV export.
            </motion.p>
          </div>
        </section>

        <main className="container mx-auto px-4 py-10 md:py-14 max-w-5xl">
          <EODDeliveryPanel />
          {sections.map((section, si) => (
            <motion.section
              key={section.title}
              className="mb-12 last:mb-0"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: si * 0.05 }}
            >
              <div className="flex items-center gap-3 mb-1.5">
                <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
                  <section.icon className="w-5 h-5" />
                </div>
                <h2 className="font-heading text-xl md:text-2xl font-bold text-foreground">{section.title}</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-5 md:pl-12">{section.subtitle}</p>

              <div className="grid sm:grid-cols-2 gap-4">
                {section.items.map((item) => {
                  const ItemIcon = iconFor(item.label);
                  const inner = (
                    <>
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-secondary shrink-0 group-hover:bg-secondary/15 transition-colors">
                        <ItemIcon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground group-hover:text-secondary transition-colors">
                          <span className="truncate">{item.label}</span>
                          {item.external
                            ? <ExternalLink className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                            : <ArrowRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.desc}</p>
                      </div>
                    </>
                  );
                  const cls = "group flex items-start gap-3 p-4 min-h-[44px] rounded-2xl bg-card border border-border/60 hover:border-secondary/50 hover:shadow-md transition-[color,background-color,border-color,box-shadow]";
                  return item.external ? (
                    <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" className={cls}>
                      {inner}
                    </a>
                  ) : (
                    <Link key={item.label} to={item.href} className={cls}>
                      {inner}
                    </Link>
                  );
                })}
              </div>
            </motion.section>
          ))}

          {/* Data disclaimer */}
          <div className="mt-4 rounded-xl border border-brand-orange/20 bg-brand-orange/5 p-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <Info className="inline w-3.5 h-3.5 -mt-0.5 mr-1 text-brand-orange" />
              Data on our own tools is delayed and provided for information only, not for trading or
              settlement. Official files are hosted by NSE, BSE and MCX and open on their websites.
              Read all related documents carefully before investing - see our{" "}
              <Link to="/disclaimer" className="text-secondary hover:underline">Disclaimer</Link>.
            </p>
          </div>
        </main>

        <Footer />
        <WhatsAppButton />
      </div>
    </PageTransition>
  );
};

export default ReportsPage;
