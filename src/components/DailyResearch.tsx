import { motion } from "motion/react";
import { ArrowUpRight, BadgeCheck, BarChart2, Download, Newspaper } from "lucide-react";
import { revealItem, revealSection, revealTracking } from "@/lib/motion";

/**
 * Two daily PDFs from the research desk, and StockAnts Premium. The third card
 * used to read "Weekly Report - Download Report" while linking to StockAnts,
 * so it promised a PDF and opened a sign-up; it now says what the link is.
 */
const researchCards = [
  {
    title: "SR Levels",
    subtitle: "Daily support and resistance",
    description: "Key support and resistance levels for NIFTY, BANKNIFTY and leading stocks, updated every morning before the open.",
    icon: BarChart2,
    href: "https://www.parasramindia.com/downloads/SR-LEVELS.pdf",
    cta: "View SR levels",
    pdf: true,
  },
  {
    title: "Daily Newsletter",
    subtitle: "Market outlook and ideas",
    description: "The day's market outlook, stock ideas and sector notes from our research team.",
    icon: Newspaper,
    href: "https://www.parasramindia.com/downloads/DAILY-NEWSLETTER.pdf",
    cta: "Read the newsletter",
    pdf: true,
  },
  {
    title: "StockAnts Premium",
    subtitle: "Free for Parasram clients",
    description: "Research and stock calls from StockAnts, our research partner. Every registered Parasram client gets premium access at no charge.",
    icon: BadgeCheck,
    href: "https://parasram.stockants.com/",
    cta: "Get your free access",
    pdf: false,
  },
];

const DailyResearch = () => {
  return (
    <section id="research" className="py-12 md:py-20 bg-muted/30 overflow-hidden relative">

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="text-center mb-12"
          {...revealSection}
        >
          <motion.span
            className="inline-block text-secondary font-semibold text-sm uppercase tracking-wider mb-3"
            {...revealTracking}
          >
            Research & Reports
          </motion.span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-3">
            Daily Market Research
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Daily levels and a newsletter from our research desk, and StockAnts Premium free for every registered client.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {researchCards.map((card, i) => (
            <motion.a
              key={card.title}
              href={card.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col rounded-surface border bg-card p-6 shadow-sm transition-[border-color,box-shadow] duration-fast ease-out hover:border-secondary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...revealItem(i)}
            >
              <div className="mb-4 flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-foreground">
                  <card.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                {card.pdf && <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"><Download className="h-3.5 w-3.5" aria-hidden="true" /> PDF</span>}
              </div>
              <h3 className="font-heading text-xl font-bold text-foreground">{card.title}</h3>
              <p className="mb-3 mt-0.5 text-sm font-medium text-secondary">{card.subtitle}</p>
              <p className="mb-5 flex-1 text-sm text-muted-foreground">{card.description}</p>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary">
                {card.cta}
                <ArrowUpRight className="h-4 w-4 transition-transform duration-fast ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default DailyResearch;
