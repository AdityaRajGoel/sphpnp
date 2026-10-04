import { TrendingUp, BarChart3, Wallet, Globe, FileText, Smartphone, ArrowRight, ArrowUpRight, Vault, Building2, Gem, DollarSign, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { useT } from "@/i18n/LanguageContext";
import { revealSection } from "@/lib/motion";

type Service = { icon: LucideIcon; title: string; id: string; href: string; description: string; fact: string };

// Every card links to the page that actually explains or does the thing. The
// fact line is something checkable (an exchange, a registration, a count we
// publish), never a performance or allotment promise.
const GROUPS: { title: string; blurb: string; items: Service[] }[] = [
  {
    title: "Trade",
    blurb: "Buy and sell on the exchanges, from one account and one margin.",
    items: [
      { icon: TrendingUp, title: "Equity", id: "equity-trading", href: "/pricing", description: "Delivery and intraday in NSE and BSE stocks and ETFs, with brokerage published up front.", fact: "NSE · BSE" },
      { icon: BarChart3, title: "Futures & options", id: "derivatives", href: "/fno", description: "Index and stock F&O with live option chains, margins and the open-interest picture.", fact: "NSE F&O" },
      { icon: Gem, title: "Commodities", id: "commodities", href: "/commodities", description: "Gold, silver, crude oil, natural gas and base metals on MCX.", fact: "MCX" },
      { icon: DollarSign, title: "Currency", id: "currency-trading", href: "/pricing", description: "Rupee futures and options against the dollar, euro, pound and yen.", fact: "NSE · BSE currency derivatives" },
    ],
  },
  {
    title: "Invest",
    blurb: "Build wealth over years, with research you can check yourself.",
    items: [
      { icon: Wallet, title: "Mutual funds", id: "mutual-funds", href: "/mutual-funds", description: "Compare every scheme's returns by category, then start a SIP or a lump sum.", fact: "AMFI ARN-35616" },
      { icon: FileText, title: "IPOs", id: "ipo-services", href: "/ipo", description: "Open, upcoming and listed issues with subscription and premium, and apply by UPI.", fact: "UPI / ASBA" },
      { icon: Building2, title: "Unlisted shares", id: "unlisted-shares", href: "/unlisted-space", description: "Pre-IPO and unlisted company shares, transferred straight to your Demat.", fact: "Settled to your Demat" },
      { icon: Globe, title: "Global markets", id: "global-investing", href: "/global-markets#invest-abroad", description: "US stocks from India through GIFT City, plus world indices and currencies to follow.", fact: "India INX Global Access" },
    ],
  },
  {
    title: "Your account",
    blurb: "Where your holdings sit, and how you reach them.",
    items: [
      { icon: Vault, title: "Demat & depository", id: "depository-services", href: "/depository-services", description: "Holdings, transfers, pledges for margin, and nominee updates.", fact: "NSDL · CDSL" },
      { icon: Smartphone, title: "Trading apps", id: "mobile-trading", href: "/apps", description: "Parasram Money and Parasram Trade on Android and iOS, and desktop terminals.", fact: "Android · iOS · Desktop" },
    ],
  },
];

const CREDENTIALS = ["SEBI INZ000220838", "NSE", "BSE", "MCX", "MSEI", "NSDL", "CDSL", "AMFI ARN-35616"];

function ServiceCard({ s }: { s: Service }) {
  return (
    <Link
      to={s.href}
      id={s.id}
      className="group relative flex h-full scroll-mt-24 flex-col rounded-lg border border-border bg-card p-5 transition-[border-color,box-shadow,transform] duration-base hover:border-secondary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/[0.07] text-primary transition-colors duration-base group-hover:bg-secondary/10 group-hover:text-secondary">
          <s.icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <h3 className="font-heading text-lg font-semibold leading-snug text-foreground">{s.title}</h3>
      </div>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{s.description}</p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{s.fact}</span>
        <ArrowRight className="h-4 w-4 shrink-0 text-secondary transition-transform duration-base group-hover:translate-x-0.5" aria-hidden />
      </div>
    </Link>
  );
}

const Services = () => {
  const { t } = useT();

  return (
    <section id="services" className="bg-muted/40 py-12 md:py-20">
      <div className="container mx-auto px-4">
        <motion.header className="max-w-3xl" {...revealSection}>
          <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-secondary">{t("services.eyebrow")}</p>
          <h1 className="font-heading text-3xl font-bold leading-tight tracking-tight text-foreground [text-wrap:balance] md:text-4xl lg:text-5xl">
            {t("page.services")}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Equity, F&O, commodities, currency, mutual funds, IPOs and unlisted shares, with one Demat account and one branch in Panipat that knows you.
          </p>
        </motion.header>

        <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-medium text-muted-foreground" aria-label="Registrations and memberships">
          {CREDENTIALS.map((c) => <li key={c} className="tabular-nums">{c}</li>)}
        </ul>

        <div className="mt-10 space-y-10 md:mt-14 md:space-y-14">
          {GROUPS.map((g) => (
            <section key={g.title} aria-labelledby={`svc-${g.title}`} className="grid gap-5 lg:grid-cols-12 lg:gap-8">
              <div className="lg:col-span-3 lg:pt-1">
                <h2 id={`svc-${g.title}`} className="font-heading text-2xl font-semibold text-foreground">{g.title}</h2>
                <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">{g.blurb}</p>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2 lg:col-span-9">
                {g.items.map((s) => <li key={s.id}><ServiceCard s={s} /></li>)}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start gap-4 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/open-account"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-brand-green px-7 py-3 font-semibold text-white transition-opacity hover:opacity-90"
            >
              Open a Demat account
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-border px-6 py-3 font-semibold text-foreground transition-colors hover:border-secondary hover:text-secondary"
            >
              See brokerage charges
            </Link>
          </div>
          <a
            href="https://parasramindia.com/services"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-secondary"
          >
            All services on parasramindia.com
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      </div>
    </section>
  );
};

export default Services;
