import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Calculator, FileBarChart, Lightbulb, LineChart, Target } from "lucide-react";
import { revealItem, revealSection } from "@/lib/motion";

/**
 * Every card is a link to the page that actually does the thing. The previous
 * cards showed an "Explore" arrow on hover but linked nowhere, and described
 * features ("100+ indicators", "AI-powered trade recommendations") the site
 * does not offer in those words.
 */
const tools = [
  {
    icon: LineChart,
    title: "Market Pulse",
    desc: "Market breadth, sector performance and FII and DII flows on one page.",
    href: "/market-pulse",
  },
  {
    icon: Target,
    title: "Stock screener",
    desc: "Filter NSE stocks on valuation, growth, returns and technical signals, then open any stock's page.",
    href: "/screener",
  },
  {
    icon: FileBarChart,
    title: "Research reports",
    desc: "Daily newsletter, support and resistance levels and the weekly market wrap from our research desk.",
    href: "/reports",
  },
  {
    icon: Lightbulb,
    title: "Stock recommendations",
    desc: "Calls from SEBI-registered research analysts, each with its target, period and analyst registration.",
    href: "/learn/recommendations",
  },
  {
    icon: Calculator,
    title: "Calculators",
    desc: "SIP, SPAN margin, brokerage, capital gains and more, with the assumptions shown next to every result.",
    href: "/calculators",
  },
  {
    icon: BookOpen,
    title: "Learning centre",
    desc: "Plain-language guides to demat accounts, IPOs, F&O, mutual funds and tax on market income.",
    href: "/learn",
  },
];

const InvestmentTools = () => (
  <section className="py-10 md:py-20 bg-background">
    <div className="container mx-auto px-4">
      <motion.div className="mb-10 max-w-2xl" {...revealSection}>
        <p className="text-sm font-semibold uppercase tracking-wider text-secondary mb-3">Tools</p>
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">Research and planning tools</h2>
        <p className="text-muted-foreground text-lg">
          Free to use, with or without an account.
        </p>
      </motion.div>

      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool, index) => (
          <motion.li key={tool.title} {...revealItem(index)}>
            <Link
              to={tool.href}
              className="group flex h-full flex-col rounded-surface border bg-card p-5 shadow-sm transition-[border-color,box-shadow] duration-fast ease-out hover:border-secondary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <tool.icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <h3 className="font-heading text-lg font-semibold text-foreground">{tool.title}</h3>
              </div>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{tool.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-secondary">
                Open
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-fast ease-out group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          </motion.li>
        ))}
      </ul>
    </div>
  </section>
);

export default InvestmentTools;
