import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { Building2, TrendingUp, Award, Users, Globe, Landmark, Sparkles } from "lucide-react";

const milestones = [
  { year: "1970", title: "Foundation", desc: "Parasram begins serving investors, establishing a trusted name in financial services.", icon: Building2, color: "from-primary to-primary/80" },
  { year: "1994", title: "Incorporated", desc: "The business was incorporated as Shri Parasram Holdings Pvt. Ltd. (CIN: U67120DL1994PTC060726).", icon: Building2, color: "from-primary to-primary/80" },
  { year: "1995", title: "NSE & BSE Membership", desc: "Became a registered member of both the National and Bombay Stock Exchanges.", icon: Award, color: "from-secondary to-brand-green" },
  { year: "1997", title: "Panipat Branch Opens", desc: "Opened our Panipat branch at Shakuntala Complex, Palika Bazaar bringing institutional-grade services to Haryana.", icon: Landmark, color: "from-brand-gold to-brand-orange" },
  { year: "2005", title: "MCX Membership", desc: "Added commodity trading capabilities with MCX membership, expanding our service portfolio.", icon: Globe, color: "from-brand-copper to-brand-orange" },
  { year: "2012", title: "Digital Transformation", desc: "Launched online trading platforms and mobile app access for clients across India.", icon: TrendingUp, color: "from-primary to-secondary" },
  { year: "2019", title: "10 Lakh+ Clients", desc: "Crossed the milestone of serving over 10 lakh happy clients across the nation.", icon: Users, color: "from-brand-gold to-secondary" },
  { year: "2020", title: "Unlisted Space Launch", desc: "Introduced pre-IPO and unlisted shares trading - opening new investment avenues for our clients.", icon: Sparkles, color: "from-brand-orange to-brand-gold" },
];

const CompanyTimeline = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const lineHeight = useTransform(scrollYProgress, [0.1, 0.9], ["0%", "100%"]);

  return (
    <section ref={sectionRef} id="timeline" className="py-10 md:py-20 bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-40 right-10 w-80 h-80 bg-brand-gold/5 rounded-full blur-3xl"
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="inline-block text-brand-orange font-semibold text-sm uppercase tracking-wider mb-3">Our Journey</span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
            50+ Years of <span className="text-secondary">Trust & Excellence</span>
          </h2>
          <motion.div
            className="w-20 h-1 bg-gradient-to-r from-brand-orange to-brand-gold mx-auto rounded-full"
            initial={{ width: 0 }}
            whileInView={{ width: 80 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.6 }}
          />
        </motion.div>

        <div className="max-w-4xl mx-auto relative">
          {/* Animated vertical line */}
          <div className="absolute left-6 md:left-1/2 md:-translate-x-px top-0 w-0.5 h-full bg-border/40">
            <motion.div
              className="w-full bg-gradient-to-b from-secondary via-brand-gold to-brand-orange"
              style={{ height: lineHeight }}
            />
          </div>

          <div className="space-y-12">
            {milestones.map((m, i) => {
              const isLeft = i % 2 === 0;
              return (
                <motion.div
                  key={m.year}
                  className={`relative flex items-center gap-6 ${isLeft ? "md:flex-row" : "md:flex-row-reverse"} flex-row`}
                  initial={{ opacity: 0, x: isLeft ? -40 : 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                >
                  {/* Timeline dot */}
                  <motion.div
                    className={`absolute left-6 md:left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-gradient-to-br ${m.color} flex items-center justify-center shadow-lg z-10 border-4 border-background`}
                    whileInView={{ scale: [0, 1.2, 1] }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 + 0.2, type: "spring" }}
                  >
                    <m.icon className="w-5 h-5 text-white" />
                  </motion.div>

                  {/* Content card */}
                  <div className={`ml-16 md:ml-0 md:w-[calc(50%-40px)] ${isLeft ? "md:pr-4" : "md:pl-4"}`}>
                    <motion.div
                      className="bg-card border border-border/50 rounded-xl p-5 shadow-md hover:shadow-xl hover:border-secondary/30 transition-[box-shadow,color,background-color,border-color] group"
                      whileHover={{ y: -4 }}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full bg-gradient-to-r ${m.color} text-white`}>
                          {m.year}
                        </span>
                        <h3 className="font-heading text-lg font-bold text-foreground group-hover:text-secondary transition-colors">
                          {m.title}
                        </h3>
                      </div>
                      <p className="text-muted-foreground text-sm leading-relaxed">{m.desc}</p>
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CompanyTimeline;
