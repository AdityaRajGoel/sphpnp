import { useState } from "react";
import { motion } from "motion/react";
import { Calculator, TrendingUp, IndianRupee, Calendar, Percent } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

import { revealSection } from "@/lib/motion";
/*
 * Rendered both as the entire /sip-calculator page and as one section inside
 * /services. On the dedicated page its title is the document's main heading; in
 * the services page it is a subsection under that page's own h1. The level is
 * therefore a prop rather than a fixed tag - /sip-calculator previously shipped
 * with no h1 at all.
 */
interface SIPCalculatorProps {
  /** Heading level for the section title. Use 1 only when this is the page. */
  headingLevel?: 1 | 2;
}

const SIPCalculator = ({ headingLevel = 2 }: SIPCalculatorProps) => {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const [monthlyInvestment, setMonthlyInvestment] = useState(5000);
  const [years, setYears] = useState(10);
  const [expectedReturn, setExpectedReturn] = useState(12);

  const monthlyRate = expectedReturn / 100 / 12;
  const months = years * 12;
  const totalInvested = monthlyInvestment * months;
  const futureValue = monthlyRate > 0
    ? monthlyInvestment * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate)
    : totalInvested;
  const totalReturns = futureValue - totalInvested;
  const investedPercent = (totalInvested / futureValue) * 100;

  return (
    <section className="py-10 md:py-20 bg-background relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-10 right-20 w-72 h-72 bg-secondary/5 rounded-full blur-3xl"
        />
        <div
          className="absolute bottom-10 left-10 w-96 h-96 bg-brand-gold/5 rounded-full blur-3xl"
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="text-center mb-12"
          {...revealSection}
        >
          <motion.div
            className="inline-flex items-center gap-2 bg-secondary/10 border border-secondary/30 rounded-full px-5 py-2 mb-5"
            animate={{ boxShadow: ["0 0 0 0 hsl(145 70% 40% / 0)", "0 0 0 6px hsl(145 70% 40% / 0.1)", "0 0 0 0 hsl(145 70% 40% / 0)"] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Calculator className="w-4 h-4 text-secondary" />
            <span className="text-secondary font-semibold text-sm">Investment Tool</span>
          </motion.div>
          <Heading className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
            SIP Calculator
          </Heading>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Plan your systematic investments and see your wealth grow over time
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-10">
          {/* Sliders */}
          <motion.div
            className="space-y-8"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            {/* Monthly Investment */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-secondary" />
                  Monthly Investment
                </label>
                <motion.span
                  className="text-lg font-bold text-secondary bg-secondary/10 px-3 py-1 rounded-lg"
                  key={monthlyInvestment}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                >
                  ₹{monthlyInvestment.toLocaleString('en-IN')}
                </motion.span>
              </div>
              <input
                type="range"
                min={500}
                max={100000}
                step={500}
                value={monthlyInvestment}
                onChange={(e) => setMonthlyInvestment(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-secondary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>₹500</span>
                <span>₹1,00,000</span>
              </div>
            </div>

            {/* Time Period */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-brand-gold" />
                  Time Period
                </label>
                <motion.span
                  className="text-lg font-bold text-brand-gold bg-brand-gold/10 px-3 py-1 rounded-lg"
                  key={years}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                >
                  {years} years
                </motion.span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-brand-gold"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1 yr</span>
                <span>30 yrs</span>
              </div>
            </div>

            {/* Expected Return */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Percent className="w-4 h-4 text-primary" />
                  Expected Return (p.a.)
                </label>
                <motion.span
                  className="text-lg font-bold text-primary bg-primary/10 px-3 py-1 rounded-lg"
                  key={expectedReturn}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                >
                  {expectedReturn}%
                </motion.span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                step={0.5}
                value={expectedReturn}
                onChange={(e) => setExpectedReturn(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1%</span>
                <span>30%</span>
              </div>
            </div>
          </motion.div>

          {/* Results */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Card className="border-secondary/20 overflow-hidden">
              <div className="bg-hero p-6 text-primary-foreground">
                <div className="text-center">
                  <div className="text-sm opacity-70 mb-1">Total Value</div>
                  <motion.div
                    className="text-4xl font-bold font-heading"
                    key={Math.round(futureValue)}
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                  >
                    ₹{Math.round(futureValue).toLocaleString('en-IN')}
                  </motion.div>
                </div>
              </div>
              <CardContent className="p-6">
                {/* Donut chart visual */}
                <div className="flex items-center justify-center mb-6">
                  <div className="relative w-40 h-40">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(210 30% 90%)" strokeWidth="12" />
                      <motion.circle
                        cx="50" cy="50" r="40" fill="none"
                        stroke="hsl(145 70% 40%)"
                        strokeWidth="12"
                        strokeDasharray={`${investedPercent * 2.51} ${251 - investedPercent * 2.51}`}
                        strokeLinecap="round"
                        initial={{ strokeDasharray: "0 251" }}
                        whileInView={{ strokeDasharray: `${investedPercent * 2.51} ${251 - investedPercent * 2.51}` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: 0.3 }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-secondary mb-1" />
                      <span className="text-xs font-bold text-foreground">{Math.round((futureValue / totalInvested - 1) * 100)}%</span>
                      <span className="text-[10px] text-muted-foreground">growth</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-secondary" />
                      <span className="text-sm text-foreground">Invested Amount</span>
                    </div>
                    <span className="font-bold text-foreground">₹{totalInvested.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-brand-gold" />
                      <span className="text-sm text-foreground">Est. Returns</span>
                    </div>
                    <span className="font-bold text-secondary">₹{Math.round(totalReturns).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <motion.div className="mt-6" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    asChild
                    className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold py-6"
                  >
                    <Link to="/contact">Start SIP with Parasram</Link>
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default SIPCalculator;
