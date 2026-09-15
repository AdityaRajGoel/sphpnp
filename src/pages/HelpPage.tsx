import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  BookOpen, Compass, Search, Gauge, Filter, Code2, LineChart, GitCompare, Activity, Landmark,
  Calculator, Star, Keyboard, Clock, HelpCircle, Phone, ArrowUpRight,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import PageTransition from "@/components/PageTransition";
import ScrollProgress from "@/components/ScrollProgress";
import WhatsAppButton from "@/components/WhatsAppButton";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DURATION, EASE_OUT, revealItem, revealSection } from "@/lib/motion";
import { useScrollSpy } from "@/hooks/useScrollSpy";

type Section = { id: string; label: string; icon: typeof BookOpen };

const SECTIONS: Section[] = [
  { id: "start", label: "Getting started", icon: Compass },
  { id: "navigate", label: "Finding your way", icon: Search },
  { id: "pulse", label: "Market Pulse", icon: Gauge },
  { id: "screener", label: "Screener & scans", icon: Filter },
  { id: "query", label: "Query language", icon: Code2 },
  { id: "stock", label: "Stock pages", icon: LineChart },
  { id: "compare", label: "Compare & 52-week", icon: GitCompare },
  { id: "fno", label: "F&O", icon: Activity },
  { id: "ipo", label: "IPOs", icon: Landmark },
  { id: "tools", label: "Calculators", icon: Calculator },
  { id: "watchlist", label: "Watchlist", icon: Star },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "freshness", label: "Data timing", icon: Clock },
  { id: "faq", label: "FAQ", icon: HelpCircle },
];
const SECTION_IDS = SECTIONS.map((s) => s.id);

const OPERATORS: [string, string, string][] = [
  [">  >=  <  <=", "Compare two values", "ROCE > 20"],
  ["=  !=", "Equal to, not equal to", "Piotroski = 9"],
  ["AND", "Both conditions must hold", "ROE > 15 AND D/E < 0.5"],
  ["OR", "Either condition may hold", "Sales YoY > 20 OR Profit YoY > 25"],
  ["NOT", "Reverse a condition", "NOT RSI > 70"],
  ["( )", "Group conditions or arithmetic", "(P/E < 15 OR PEG < 1) AND ROCE > 18"],
  ["+  -  *  /", "Arithmetic between metrics and numbers", "Earnings yield > 2 * Div. yield"],
];

const QUERY_METRICS: [string, string][] = [
  ["Valuation", "P/E, P/B, PEG, Earnings yield, Div. yield, FCF yield, EV/Sales, vs Graham"],
  ["Profitability", "ROE, ROCE, OPM, Piotroski, EPS (TTM)"],
  ["Growth", "Sales YoY, Profit YoY, Rev CAGR 3Y, Profit CAGR 3Y"],
  ["Balance sheet", "D/E, Net D/E, Cash conv., Accruals, Payout, Capex / sales"],
  ["Price & returns", "Price, M-cap, 1M, 3M, 6M, 1Y, From 52W high, 52W position, vs Nifty 3M"],
  ["Technicals", "RSI, ADX, MACD hist., Stoch %K, MFI, %B, vs 50DMA, vs 200DMA, Vol. σ, Delivery"],
  ["Risk", "Beta, Volatility, Max DD, ATR %, Return / vol"],
  ["Scores", "Composite, Value, Quality, Momentum, Low vol., Magic Formula"],
];

const SHORTCUTS: [string, string][] = [
  ["Ctrl + K  or  ⌘ + K", "Jump to stock search from anywhere"],
  ["/", "Focus search when you are not typing in a box"],
  ["Esc", "Close a dialog or the cookie banner"],
  ["Ctrl + Enter", "Run a typed screener query"],
  ["Tab / Shift + Tab", "Move between links, buttons and fields"],
];

const FAQ = [
  { question: "Is anything on the site investment advice?", answer: "No. The screens, checklists, scores and summaries describe figures as they stand. They are research aids, not recommendations. Speak to a registered adviser before investing." },
  { question: "Why does a stock show a dash instead of a number?", answer: "A dash means the figure is not available for that company yet, or does not apply - a loss-making company has no meaningful P/E, for example. The site never fills a gap with an estimate." },
  { question: "How do I share a screen I built?", answer: "Copy the page address. Scans, rules, typed queries, sector, sort order and view are all kept in the link, so whoever opens it sees the same screen." },
  { question: "Why did a stock drop out of a scan today?", answer: "Scans describe where figures sit now. Prices, technical readings and percentile ranks move every session, so membership changes with them." },
  { question: "Are percentile scores absolute?", answer: "No. Value, Quality, Momentum and Low-volatility scores rank a stock against the other tracked stocks from 0 to 100, so a score can change when other companies' figures change." },
  { question: "Do I need an account to use the research tools?", answer: "No. Market Pulse, the screener, stock pages, comparison, F&O, IPO and every calculator are free and open. An account is only needed to trade or invest with Shri Parasram Holdings." },
  { question: "Does the site store my watchlist?", answer: "Your watchlist stays in your own browser on this device. Clearing site data removes it, and it does not follow you to another device." },
];

function Kbd({ children }: { children: string }) {
  return <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.75rem] text-foreground shadow-[0_1px_0_hsl(var(--border))]">{children}</kbd>;
}

function DocSection({ id, title, lead, children }: { id: string; title: string; lead: string; children: React.ReactNode }) {
  const Icon = SECTIONS.find((s) => s.id === id)?.icon ?? BookOpen;
  return (
    <motion.section {...revealSection} id={id} aria-labelledby={`${id}-title`} className="scroll-mt-28">
      <div className="flex items-start gap-3">
        <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary/10 text-secondary" aria-hidden="true">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-2xl font-bold tracking-tight [text-wrap:balance]">{title}</h2>
          <p className="mt-1 max-w-[65ch] text-muted-foreground">{lead}</p>
        </div>
      </div>
      <div className="mt-5 space-y-4 text-[0.9375rem] leading-relaxed [&_p]:max-w-[70ch]">{children}</div>
    </motion.section>
  );
}

function Steps({ items }: { items: [string, string][] }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2">
      {items.map(([title, body], i) => (
        <motion.li key={title} {...revealItem(i)} className="relative rounded-xl border border-border bg-card p-4 pl-12">
          <span className="absolute left-4 top-4 grid h-6 w-6 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground tabular-nums" aria-hidden="true">{i + 1}</span>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        </motion.li>
      ))}
    </ol>
  );
}

function Features({ items }: { items: [string, string, string?][] }) {
  return (
    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {items.map(([term, body, to]) => (
        <div key={term} className="border-l-2 border-secondary/30 pl-3">
          <dt className="font-semibold">{to ? <Link to={to} className="link-arrow text-foreground hover:text-secondary">{term}</Link> : term}</dt>
          <dd className="text-sm text-muted-foreground">{body}</dd>
        </div>
      ))}
    </dl>
  );
}

const SectionNav = ({ filter }: { filter: string }) => {
  const activeId = useScrollSpy(SECTION_IDS);
  const visible = SECTIONS.filter((s) => !filter || s.label.toLowerCase().includes(filter.toLowerCase()));
  return (
    <nav aria-label="Help topics">
      <ul className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        {visible.map(({ id, label, icon: Icon }) => {
          const active = activeId === id;
          return (
            <li key={id} className="shrink-0">
              <a
                href={`#${id}`}
                aria-current={active ? "true" : undefined}
                className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {active && (
                  <motion.span layoutId="help-nav-active" className="absolute inset-0 rounded-lg border border-secondary/30 bg-secondary/10" transition={{ duration: DURATION.base, ease: [...EASE_OUT] }} />
                )}
                <Icon className="relative h-4 w-4" aria-hidden="true" />
                <span className="relative whitespace-nowrap">{label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default function HelpPage() {
  const [filter, setFilter] = useState("");
  const faqItems = useMemo(() => FAQ, []);

  return (
    <PageTransition>
      <ScrollProgress />
      <SEOHead
        title="Help & Docs - How to Use the Research Tools | Shri Parasram Holdings"
        description="Guide to the Parasram research terminal: Market Pulse, the stock screener and query language, stock pages, comparison, F&O, IPO tracker, calculators, watchlist and keyboard shortcuts."
        canonical="https://www.sphpnp.com/help"
        faqItems={faqItems}
        breadcrumbs={[{ name: "Home", url: "https://www.sphpnp.com/" }, { name: "Help & Docs", url: "https://www.sphpnp.com/help" }]}
      />
      <Header />
      <main className="container mx-auto max-w-6xl px-4 py-8">
        <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Help & Docs" }]} />

        <motion.header {...revealSection} className="relative mt-4 overflow-hidden rounded-2xl border border-border bg-card px-6 py-8 md:px-10 md:py-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_100%_0%,hsl(var(--secondary)/0.14),transparent_60%)]" aria-hidden="true" />
          <p className="relative text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-secondary">Help &amp; Docs</p>
          <h1 className="relative mt-2 max-w-3xl text-3xl font-bold tracking-tight md:text-4xl [text-wrap:balance]">Everything the research terminal can do, and how to use it</h1>
          <p className="relative mt-3 max-w-2xl text-muted-foreground">
            Start with the market, narrow it down with scans or a typed query, then open a company for its full picture. Each section below covers one part of the site.
          </p>
          <div className="relative mt-5 max-w-sm">
            <label htmlFor="help-filter" className="sr-only">Filter help topics</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="help-filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter topics, e.g. query" className="pl-9" autoComplete="off" />
          </div>
        </motion.header>

        <div className="mt-8 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <SectionNav filter={filter} />
          </aside>

          <div className="min-w-0 space-y-16">
            <DocSection id="start" title="Getting started" lead="A research session usually runs from the whole market down to one company.">
              <Steps
                items={[
                  ["Read the market", "Open Market Pulse for the day's breadth, sectors, index valuations, institutional flows and world markets."],
                  ["Narrow the field", "In the Screener, switch on ready-made scans or build your own screen with rules or a typed query."],
                  ["Open a company", "Click any stock for price charts, financial statements, peers, a checklist, filings and risk readings."],
                  ["Check and act", "Compare shortlisted stocks side by side, size positions with the calculators, and open an account to trade."],
                ]}
              />
            </DocSection>

            <DocSection id="navigate" title="Finding your way" lead="Three ways to get anywhere: the menu, search, and links inside every panel.">
              <Features
                items={[
                  ["Top menu", "Markets holds the research tools; Tools holds calculators and the holiday calendar; Learn holds articles, news and this guide. On a phone, open the menu button at the top right."],
                  ["Stock search", "Type a company name or symbol in the search box in the header. Press Ctrl + K (⌘ + K on a Mac) from any page to jump to it."],
                  ["Switch stock", "On a stock page, the Switch stock button opens search without leaving the page."],
                  ["Linked figures", "Scan chips, sector names and peer rows are links: a scan chip opens the screener with that scan on, a peer opens that company."],
                  ["Breadcrumbs", "The trail above each page title shows where you are; click any step to go back up."],
                  ["Theme and motion", "Switch light or dark from the header. If your device asks for reduced motion, animations shorten to simple fades."],
                ]}
              />
            </DocSection>

            <DocSection id="pulse" title="Market Pulse" lead="The day's market on one page, from breadth to world markets.">
              <Features
                items={[
                  ["Breadth", "How many tracked stocks rose or fell, how many sit near 52-week highs or lows, and how far the market is above its moving averages.", "/market-pulse"],
                  ["Macro regime", "A plain reading of growth, inflation and liquidity signals, with the figures behind it."],
                  ["Institutional flows", "Foreign and domestic institutional buying and selling in cash, and foreign flows by sector."],
                  ["Index valuations", "P/E, P/B and dividend yield of the major indices against their own history."],
                  ["World markets", "Global indices, currencies, commodities and bond yields as a heat strip."],
                  ["Deals and derivatives", "Bulk and block deals, and how each participant group is positioned in futures and options."],
                ]}
              />
            </DocSection>

            <DocSection id="screener" title="Screener & scans" lead="Filter every tracked stock by more than sixty metrics, with dozens of ready-made scans.">
              <Features
                items={[
                  ["Scan library", "Scans are grouped as Today, Trend, Oscillators, Volume, Risk, Fundamental and Scores. Each chip shows how many stocks match. Turning on several shows stocks that match all of them.", "/screener"],
                  ["Pick rules", "Choose a metric, a comparison and a number - for example ROCE > 20 - and add as many rules as you need. Every rule must hold."],
                  ["Type a query", "Switch the Custom screen box to Type a query for AND, OR, brackets and arithmetic. See the next section."],
                  ["Views", "List, Fundamentals, Technicals, Risk, Scores and Custom change the table's columns. A custom screen shows the metrics it uses."],
                  ["Filters and sorting", "Sector, P/E band and market-cap band sit above the table. Click a column heading to sort; click again to reverse."],
                  ["Chart view", "Add stocks to the chart to compare their price paths on one scale."],
                ]}
              />
              <p className="text-sm text-muted-foreground">Everything you set is kept in the page address, so a screen can be bookmarked or shared.</p>
            </DocSection>

            <DocSection id="query" title="Query language" lead="Write a screen the way you would say it. Metric names are not case-sensitive.">
              <Card className="overflow-hidden p-0">
                <div className="relative overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <caption className="sr-only">Query operators</caption>
                    <thead>
                      <tr className="border-b bg-muted/40 text-left">
                        <th scope="col" className="p-3 font-medium">Operator</th>
                        <th scope="col" className="p-3 font-medium">Meaning</th>
                        <th scope="col" className="p-3 font-medium">Example</th>
                      </tr>
                    </thead>
                    <tbody>
                      {OPERATORS.map(([op, meaning, ex]) => (
                        <tr key={op} className="border-b last:border-0">
                          <td className="whitespace-pre p-3 font-mono font-semibold text-secondary">{op}</td>
                          <td className="p-3">{meaning}</td>
                          <td className="p-3 font-mono text-xs">{ex}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <p>
                AND binds tighter than OR, exactly as in arithmetic: <code className="rounded bg-muted px-1 font-mono text-sm">A OR B AND C</code> means A, or both B and C. Use brackets when in doubt.
                A condition on a figure a company does not have is false for that company, so an unknown ROCE never passes <code className="rounded bg-muted px-1 font-mono text-sm">ROCE &gt; 20</code>.
              </p>
              <p>Percentages are written as plain numbers (15 means 15%), market cap is in ₹ crore, and scores run from 0 to 100.</p>
              <h3 className="pt-2 font-semibold">Metric names you can use</h3>
              <dl className="grid gap-2 sm:grid-cols-2">
                {QUERY_METRICS.map(([group, names]) => (
                  <div key={group} className="rounded-lg border border-border p-3">
                    <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{group}</dt>
                    <dd className="mt-1 font-mono text-xs leading-relaxed">{names}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm text-muted-foreground">Longer names work too: “Return on equity”, “Debt to equity”, “Market capitalization”, “Dividend yield”. Queries can be up to 400 characters long, with up to six levels of brackets.</p>
              <Link to={`/screener?fx=${encodeURIComponent("ROCE > 20 AND D/E < 0.5 AND P/E < 30")}`} className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground shadow-sm transition-transform pressable btn-shine hover:bg-secondary/90">
                Try a query in the screener <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </DocSection>

            <DocSection id="stock" title="Stock pages" lead="One company, top to bottom. Panels only appear when there is something to show.">
              <Features
                items={[
                  ["Header and signals", "Price, day change, market cap, and warnings such as exchange surveillance, F&O ban or promoter pledges."],
                  ["Price chart", "Candles with indicators. Pick a range, add overlays and oscillators, and hover for exact values."],
                  ["Research profile", "Factor percentiles, derived metrics such as Graham number and earnings yield, and every scan the stock is in."],
                  ["Checklist", "Strengths, neutral readings and weaknesses, each with the line it was judged against."],
                  ["Peer comparison", "The sector's largest companies beside this one, with sector medians. Figures better than the median are tinted."],
                  ["Financial statements", "Quarterly results, profit & loss, balance sheet, cash flow and ratios. Use the CSV button to download the open tab."],
                  ["Working-capital cycle", "Debtor, inventory and working-capital days over recent years. Fewer days usually means cash comes back faster."],
                  ["Strengths, risks & growth", "Compounded sales and profit growth over 3, 5 and 10 years, with a short company summary."],
                  ["Legal & regulatory watch", "Tribunal hearings, tax demands, penalties, rating actions, auditor changes and disruptions the company has disclosed. Filter by topic; adverse items are marked."],
                  ["Regulator orders, deals and insider trades", "Orders naming the company, bulk and block deals, and trades by insiders, newest first."],
                  ["Risk, scores and forecast", "Volatility, beta and drawdowns; fundamental scores such as Piotroski; and forecast ranges where available."],
                  ["Ask AI", "A written analysis built only from the figures on the page. It says so when a figure is missing."],
                ]}
              />
            </DocSection>

            <DocSection id="compare" title="Compare & 52-week tracker" lead="Line companies up, or find the ones testing their yearly extremes.">
              <Features
                items={[
                  ["Stock comparison", "Pick two or three stocks to see valuation, returns, profitability and risk in one table, with the better figure highlighted.", "/compare"],
                  ["52-week tracker", "Stocks at or near their 52-week highs and lows, with how far each sits from that high or low.", "/52-week-tracker"],
                ]}
              />
            </DocSection>

            <DocSection id="fno" title="F&O dashboard" lead="Options chains, open interest and positioning for index and stock derivatives.">
              <Features
                items={[
                  ["Option chain", "Calls and puts by strike with open interest, change, volume and implied volatility. Max pain and put-call ratio sit above the chain.", "/fno"],
                  ["Build-up", "Which contracts are adding long or short positions, or unwinding them."],
                  ["Lot sizes and margin", "Current lot sizes for every contract are listed in the margin calculator, which pre-fills the spot price.", "/margin-calculator"],
                ]}
              />
              <p className="text-sm text-muted-foreground">Derivatives carry a high risk of loss. Read the risk disclosure in the <Link to="/investor-corner" className="link-arrow text-secondary">Investor Corner</Link>.</p>
            </DocSection>

            <DocSection id="ipo" title="IPOs" lead="Current, upcoming and listed issues, and the pipeline behind them.">
              <Features
                items={[
                  ["IPO tracker", "Dates, price band, lot size, subscription and grey-market premium history. Listed issues show their listing gain.", "/ipo"],
                  ["IPO detail", "Open any issue for its timeline, subscription by category and listing-day performance."],
                  ["IPO pipeline", "Companies that have filed offer documents, by stage, with monthly filing counts and typical time to launch.", "/ipo-pipeline"],
                ]}
              />
            </DocSection>

            <DocSection id="tools" title="Calculators" lead="Quick answers before you place a trade or start an investment.">
              <Features
                items={[
                  ["Margin calculator", "Margin needed for futures and options positions, using each contract's current lot size.", "/margin-calculator"],
                  ["Brokerage calculator", "Brokerage, taxes and charges for a trade, itemised, with your net profit or loss.", "/brokerage-calculator"],
                  ["SIP calculator", "Project a monthly SIP, or backtest one on a real fund's past NAVs.", "/sip-calculator"],
                  ["Holiday calendar", "Trading holidays, session timings and derivative expiry dates for the year.", "/holidays"],
                ]}
              />
            </DocSection>

            <DocSection id="watchlist" title="Watchlist" lead="Keep the stocks you follow one click away.">
              <Features
                items={[
                  ["Add a stock", "Tap the star beside any stock in the screener, or the Watch button at the top of a stock page. Tap it again to remove the stock."],
                  ["Open your watchlist", "Once you follow a stock, a star with a count appears in the header. It opens your watchlist: price, day move, returns, valuation, quality and a strengths tally for every stock you follow.", "/watchlist"],
                  ["Download it", "From the watchlist page, download every stock you follow and its figures as a CSV."],
                  ["Limits", "Up to 50 stocks. The list is saved in this browser on this device only."],
                ]}
              />
              <p className="text-sm text-muted-foreground">Your watchlist is saved in this browser only.</p>
            </DocSection>

            <DocSection id="shortcuts" title="Keyboard shortcuts" lead="Move faster without the mouse.">
              <Card className="divide-y p-0">
                {SHORTCUTS.map(([keys, action]) => (
                  <div key={keys} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <span className="flex flex-wrap items-center gap-1">
                      {keys.split("  ").map((k, i) => (k === "or" ? <span key={i} className="px-1 text-xs text-muted-foreground">or</span> : <Kbd key={i}>{k}</Kbd>))}
                    </span>
                    <span className="text-sm text-muted-foreground">{action}</span>
                  </div>
                ))}
              </Card>
            </DocSection>

            <DocSection id="freshness" title="Data timing" lead="What is live, what updates daily, and what updates when companies file.">
              <Features
                items={[
                  ["Live during market hours", "Index and stock prices on the home page, ticker and screener refresh through the session (09:15 to 15:30 IST on trading days). Prices older than a few minutes are never shown as current."],
                  ["End of day", "Technical readings, breadth, deals, derivatives positioning and 52-week levels update after the close."],
                  ["When companies file", "Quarterly results, statements, shareholding and announcements update as companies report them."],
                  ["Timestamps", "Panels show when their figures were last updated. Check them before relying on a number."],
                ]}
              />
            </DocSection>

            <DocSection id="faq" title="Frequently asked questions" lead="Short answers to what people ask most.">
              <div className="space-y-2">
                {FAQ.map((f) => (
                  <details key={f.question} className="group rounded-xl border border-border bg-card px-4 py-3 open:shadow-sm">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium marker:hidden">
                      {f.question}
                      <span className="text-secondary transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                    </summary>
                    <p className="mt-2 text-sm text-muted-foreground">{f.answer}</p>
                  </details>
                ))}
              </div>
            </DocSection>

            <motion.aside {...revealSection} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-secondary/30 bg-secondary/[0.06] p-6">
              <div>
                <h2 className="text-lg font-bold">Still stuck?</h2>
                <p className="text-sm text-muted-foreground">Our Panipat team answers questions about the site, accounts and trading.</p>
              </div>
              <Link to="/contact#contact-form" className="pressable inline-flex items-center gap-2 rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-navy/90">
                <Phone className="h-4 w-4" aria-hidden="true" /> Contact support
              </Link>
            </motion.aside>
          </div>
        </div>
      </main>
      <WhatsAppButton />
      <Footer />
    </PageTransition>
  );
}
