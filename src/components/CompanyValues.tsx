import { motion } from "motion/react";
import { Heart, Shield, Target, Lightbulb, Handshake, Scale } from "lucide-react";

const values = [
  { icon: Shield, title: "Trust & Integrity", desc: "Transparent dealings with every client. No hidden charges, no misleading advice.", color: "bg-primary/10 text-primary" },
  { icon: Heart, title: "Client First", desc: "Your financial goals drive every recommendation we make. We succeed when you succeed.", color: "bg-destructive/10 text-destructive" },
  { icon: Target, title: "Disciplined Investing", desc: "We believe in research-backed, long-term wealth creation - not speculation.", color: "bg-secondary/10 text-secondary" },
  { icon: Lightbulb, title: "Financial Literacy", desc: "We educate our clients to make informed decisions, not just dependent ones.", color: "bg-brand-gold/10 text-brand-gold" },
  { icon: Handshake, title: "Personal Relationships", desc: "Face-to-face guidance from advisors who know you and your family.", color: "bg-brand-orange/10 text-brand-orange" },
  { icon: Scale, title: "Regulatory Compliance", desc: "Fully SEBI-registered and compliant with all exchange regulations.", color: "bg-primary/10 text-primary" },
];

const CompanyValues = () => {
  return (
    <section className="py-8 md:py-16 bg-muted/20 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-20 left-20 w-72 h-72 bg-brand-gold/5 rounded-full blur-3xl"
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="inline-block text-brand-gold font-semibold text-sm uppercase tracking-wider mb-3">What We Stand For</span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
            Our <span className="text-secondary">Core Values</span>
          </h2>
          <motion.div
            className="w-20 h-1 bg-gradient-to-r from-brand-gold to-secondary mx-auto rounded-full"
            initial={{ width: 0 }}
            whileInView={{ width: 80 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.6 }}
          />
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {values.map((v, i) => (
            <motion.div
              key={v.title}
              className="bg-card border border-border/50 rounded-xl p-6 hover:shadow-xl hover:border-secondary/30 transition-[box-shadow,color,background-color,border-color] group"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -6 }}
            >
              <motion.div
                className={`w-12 h-12 rounded-xl ${v.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                whileHover={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.5 }}
              >
                <v.icon className="w-6 h-6" />
              </motion.div>
              <h3 className="font-heading text-lg font-bold text-foreground mb-2 group-hover:text-secondary transition-colors">{v.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{v.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CompanyValues;
