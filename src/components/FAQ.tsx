import { motion } from "motion/react";
import { HelpCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { revealBar, revealSection } from "@/lib/motion";
type FAQItem = { q: string; a: string };

type FAQProps = {
  title?: string;
  subtitle?: string;
  items: FAQItem[];
};

const FAQ = ({ title = "Frequently Asked Questions", subtitle, items }: FAQProps) => {
  return (
    <section className="py-8 md:py-16 bg-muted/20 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute bottom-20 left-20 w-72 h-72 bg-secondary/5 rounded-full blur-3xl"
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="text-center mb-12"
          {...revealSection}
        >
          <motion.span className="inline-flex items-center gap-1.5 bg-brand-orange/10 text-brand-orange text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full mb-3">
            <HelpCircle className="w-3.5 h-3.5" />
            FAQ
          </motion.span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-2">{title}</h2>
          {subtitle && <p className="text-muted-foreground max-w-xl mx-auto">{subtitle}</p>}
          <motion.div
            className="w-20 h-1 bg-gradient-to-r from-brand-orange to-brand-gold mx-auto rounded-full mt-4"
            {...revealBar}
          />
        </motion.div>

        <motion.div
          className="max-w-3xl mx-auto"
          {...revealSection}
          transition={{ delay: 0.1 }}
        >
          <Accordion type="single" collapsible className="space-y-3">
            {items.map((item, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="bg-card border border-border/50 rounded-xl px-5 shadow-sm hover:shadow-md hover:border-secondary/30 transition-[box-shadow,color,background-color,border-color] data-[state=open]:border-secondary/40 data-[state=open]:shadow-lg"
              >
                <AccordionTrigger className="text-left font-heading font-semibold text-foreground text-sm md:text-base hover:text-secondary transition-colors py-4 [&[data-state=open]]:text-secondary">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm leading-relaxed pb-4">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
};

export default FAQ;
