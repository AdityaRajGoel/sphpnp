import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { Shield, Award, Clock, Users, Building, Briefcase, Globe, Headphones } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";

const badges = [
  { icon: Shield, label: "SEBI Registered", desc: "INZ000220838", color: "text-secondary", bg: "bg-secondary/10" },
  // INZ000220838 is the SEBI registration covering NSE, BSE, MCX and MSEI — it
  // is not an exchange member code, which is how these badges used to label it.
  // Wording matches the official disclosure on parasramindia.com.
  { icon: Building, label: "NSE Member", desc: "SEBI Reg: INZ000220838", color: "text-primary", bg: "bg-primary/10" },
  { icon: Building, label: "BSE Member", desc: "SEBI Reg: INZ000220838", color: "text-brand-gold", bg: "bg-brand-gold/10" },
  { icon: Globe, label: "MCX & NCDEX", desc: "SEBI Reg: INZ000033839", color: "text-secondary", bg: "bg-secondary/10" },
  { icon: Building, label: "CDSL IN-DP-47-2015", desc: "DP ID: 12058200", color: "text-primary-blue", bg: "bg-primary/10" },
  { icon: Building, label: "NSDL IN-DP-NSDL-194-2001", desc: "DP ID: IN302365", color: "text-primary-blue", bg: "bg-primary/10" },
  { icon: Building, label: "AMFI Regn. No.", desc: "ARN-35616", color: "text-primary-green", bg: "bg-primary/10" },
  { icon: Award, label: "50+ Years", desc: "Since 1970", color: "text-brand-gold", bg: "bg-brand-gold/10", countTo: 50, suffix: "+ Years" },
  { icon: Users, label: "10 Lakh+", desc: "Happy Clients", color: "text-primary", bg: "bg-primary/10", countTo: 10, suffix: " Lakh+" },
];

// Renders a badge label, counting up when number-type badges scroll into view.
const BadgeLabel = ({ label, countTo, suffix, inView }: { label: string; countTo?: number; suffix?: string; inView: boolean }) => {
  const count = useCountUp(countTo ?? 0, 1.6, inView);
  if (countTo === undefined) return <>{label}</>;
  return <>{count}{suffix}</>;
};

const TrustBadges = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-80px" });

  return (
    <section className="py-8 md:py-12 bg-muted/30 border-y border-border/30 overflow-hidden">
      <div className="container mx-auto px-4" ref={sectionRef}>
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h3 className="font-heading text-lg font-bold text-muted-foreground uppercase tracking-wider">
            Trusted by Lakhs of Investors
          </h3>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-4 md:gap-6">
          {badges.map((badge, i) => (
            <motion.div
              key={badge.label}
              className="flex items-center gap-3 bg-card border border-border/50 rounded-xl px-5 py-3 shadow-sm group cursor-default"
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
              whileHover={{ y: -4, scale: 1.05, boxShadow: "0 10px 30px -10px hsl(145 70% 40% / 0.2)" }}
            >
              <motion.div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${badge.bg} group-hover:scale-110 transition-transform`}
                whileHover={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.4 }}
              >
                <badge.icon className={`w-5 h-5 ${badge.color}`} />
              </motion.div>
              <div>
                <div className="font-bold text-sm text-foreground">
                  <BadgeLabel label={badge.label} countTo={badge.countTo} suffix={badge.suffix} inView={inView} />
                </div>
                <div className="text-[10px] text-muted-foreground">{badge.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustBadges;
