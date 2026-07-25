import { motion } from "motion/react";
import { ArrowRight, BookOpen, FileBarChart, Target, Lightbulb, LineChart, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const tools = [
  {
    icon: LineChart,
    title: "Advanced Charts",
    desc: "Interactive TradingView-style charts with 100+ technical indicators for deep market analysis.",
    tag: "Pro Tool",
    color: "from-secondary to-brand-green",
  },
  {
    icon: FileBarChart,
    title: "Research Reports",
    desc: "Daily market reports, stock picks, and sector analysis from our expert research team.",
    tag: "Daily",
    color: "from-brand-gold to-yellow-500",
  },
  {
    icon: Target,
    title: "Stock Screener",
    desc: "Filter stocks by fundamentals, technicals, and custom criteria to find your next winner.",
    tag: "Smart Filter",
    color: "from-primary to-blue-600",
  },
  {
    icon: BookOpen,
    title: "Investor Education",
    desc: "Free courses, webinars, and tutorials to sharpen your trading skills.",
    tag: "Free",
    color: "from-secondary to-emerald-500",
  },
  {
    icon: Lightbulb,
    title: "Trade Ideas",
    desc: "AI-powered trade recommendations based on market trends and technical analysis.",
    tag: "AI-Powered",
    color: "from-brand-gold to-orange-500",
  },
  {
    icon: Shield,
    title: "Risk Management",
    desc: "Portfolio risk analysis tools to optimize your position sizing and stop-losses.",
    tag: "Essential",
    color: "from-primary to-indigo-600",
  },
];

const InvestmentTools = () => {
  return (
    <section className="py-10 md:py-20 bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute -top-20 -right-20 w-[500px] h-[500px] bg-secondary/3 rounded-full blur-3xl"
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <motion.span
            className="inline-block text-secondary font-semibold text-sm uppercase tracking-wider mb-3"
            initial={{ letterSpacing: "0em" }}
            whileInView={{ letterSpacing: "0.15em" }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            Powerful Tools
          </motion.span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
            Investment & Research Tools
          </h2>
          <motion.div
            className="w-20 h-1 bg-gradient-to-r from-secondary to-brand-gold mx-auto rounded-full mb-4"
            initial={{ width: 0 }}
            whileInView={{ width: 80 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.6 }}
          />
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Everything you need to make informed investment decisions - like Kite & Groww, but with personal guidance
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool, index) => (
            <motion.div
              key={tool.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08, duration: 0.5 }}
              whileHover={{ y: -8 }}
            >
              <Card className="h-full bg-card border-border/50 hover:border-secondary/40 hover:shadow-2xl transition-[color,background-color,border-color,box-shadow] duration-base group overflow-hidden relative">
                {/* Top gradient accent */}
                <motion.div
                  className={`h-1 bg-gradient-to-r ${tool.color} opacity-0 group-hover:opacity-100 transition-opacity duration-base`}
                />
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <motion.div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center shadow-lg`}
                      whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                      transition={{ duration: 0.4 }}
                    >
                      <tool.icon className="w-6 h-6 text-white" />
                    </motion.div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-secondary bg-secondary/10 px-2.5 py-1 rounded-full">
                      {tool.tag}
                    </span>
                  </div>
                  <h3 className="font-heading text-lg font-bold text-foreground mb-2 group-hover:text-secondary transition-colors">
                    {tool.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-4">{tool.desc}</p>
                  <motion.div
                    className="flex items-center gap-1 text-secondary text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
                    animate={{ x: [0, 3, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    Explore {tool.title} <ArrowRight className="w-3.5 h-3.5" />
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default InvestmentTools;
