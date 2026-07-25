import { motion } from "motion/react";
import { FileText, Download, TrendingUp, Newspaper, ArrowUpRight, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { revealBar, revealSection } from "@/lib/motion";

const researchCards = [
  {
    title: "SR Levels",
    subtitle: "Daily Support & Resistance",
    description: "Get today's key support & resistance levels for NIFTY, BANKNIFTY, and top stocks. Updated every morning before market open.",
    icon: BarChart2,
    color: "from-secondary to-brand-green",
    bgAccent: "bg-secondary/10",
    textColor: "text-secondary",
    href: "https://www.parasramindia.com/downloads/SR-LEVELS.pdf",
    cta: "View SR Levels",
  },
  {
    title: "Daily Newsletter",
    subtitle: "Market Insights & Picks",
    description: "Comprehensive daily newsletter with market outlook, stock picks, sectoral analysis, and trading ideas by our research team.",
    icon: Newspaper,
    color: "from-primary to-brand-navy",
    bgAccent: "bg-primary/10",
    textColor: "text-primary",
    href: "https://www.parasramindia.com/downloads/DAILY-NEWSLETTER.pdf",
    cta: "Read Newsletter",
  },
  {
    title: "Weekly Report",
    subtitle: "In-Depth Analysis",
    description: "Weekly market wrap, FII/DII analysis, top performers, upcoming events, and portfolio strategies for the week ahead.",
    icon: FileText,
    color: "from-brand-gold to-amber-600",
    bgAccent: "bg-brand-gold/10",
    textColor: "text-brand-gold",
    href: "https://parasram.stockants.com/",
    cta: "Download Report",
  },
];

const DailyResearch = () => {
  return (
    <section className="py-12 md:py-20 bg-muted/30 overflow-hidden relative">
      {/* Background accents */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-10 right-10 w-80 h-80 bg-secondary/5 rounded-full blur-3xl"
        />
        <div
          className="absolute bottom-10 left-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl"
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="text-center mb-12"
          {...revealSection}
        >
          <motion.span
            className="inline-block text-secondary font-semibold text-sm uppercase tracking-wider mb-3"
            initial={{ opacity: 0, letterSpacing: "0em" }}
            whileInView={{ opacity: 1, letterSpacing: "0.15em" }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            Research & Reports
          </motion.span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-3">
            Daily Market Research
          </h2>
          <motion.div
            className="w-20 h-1 bg-gradient-to-r from-secondary to-brand-gold mx-auto rounded-full mb-4"
            {...revealBar}
          />
          <p className="text-muted-foreground max-w-xl mx-auto">
            Access expert research reports, daily market insights, and trading ideas from our experienced analysts.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {researchCards.map((card, i) => (
            <motion.a
              key={card.title}
              href={card.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative overflow-hidden rounded-2xl bg-card border border-border/50 hover:border-transparent transition-[color,background-color,border-color,box-shadow] duration-base hover:shadow-2xl block"
              {...revealSection}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              whileHover={{ y: -8 }}
            >
              {/* Top gradient strip */}
              <div className={`h-1.5 bg-gradient-to-r ${card.color}`} />

              {/* Gradient background on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-0 group-hover:opacity-5 transition-opacity duration-slow`} />

              <div className="p-6 relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-14 h-14 rounded-xl ${card.bgAccent} flex items-center justify-center group-hover:scale-110 transition-transform duration-base`}>
                    <card.icon className={`w-7 h-7 ${card.textColor}`} />
                  </div>
                  <motion.div
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-base"
                    animate={{ x: [0, 3, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Download className={`w-5 h-5 ${card.textColor}`} />
                  </motion.div>
                </div>

                <h3 className={`font-heading text-xl font-bold mb-1 group-hover:${card.textColor} transition-colors`}>
                  {card.title}
                </h3>
                <p className={`text-sm font-medium ${card.textColor} mb-3`}>
                  {card.subtitle}
                </p>
                <p className="text-muted-foreground text-sm mb-5">
                  {card.description}
                </p>

                <div className={`inline-flex items-center gap-2 text-sm font-semibold ${card.textColor}`}>
                  {card.cta}
                  <ArrowUpRight className="w-4 h-4 transition-transform duration-base ease-out group-hover:translate-x-1 group-hover:-translate-y-0.5" />
                </div>
              </div>

              {/* Bottom accent line on hover */}
              <motion.div
                className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r ${card.color}`}
                initial={{ width: 0 }}
                whileHover={{ width: "100%" }}
                transition={{ duration: 0.3 }}
              />
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default DailyResearch;
