import { CheckCircle2, TrendingUp, Users, Award, BarChart2 } from "lucide-react";
import { motion, Variants, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { EASE_IN_OUT, EASE_OUT, revealItemX, revealPop, revealSection } from "@/lib/motion";

const features = [
  "SEBI Registered Stock Broker",
  "Member of NSE, BSE & MCX",
  "50+ Years of Market Experience",
  "Research-Backed Recommendations",
  "Dedicated Relationship Managers",
  "Real-Time Portfolio Tracking",
];

const About = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const parallaxY = useTransform(scrollYProgress, [0, 1], [50, -50]);
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.5, ease: EASE_OUT },
    },
  };

  const cardVariants: Variants = {
    hidden: { opacity: 0, x: 50, rotateY: -10 },
    visible: {
      opacity: 1,
      x: 0,
      rotateY: 0,
      transition: { duration: 0.7, ease: EASE_OUT },
    },
  };

  return (
    <section ref={sectionRef} id="about" className="py-12 md:py-24 bg-background overflow-hidden relative">
      {/* Ambient orbs with parallax */}
      <motion.div className="absolute inset-0 pointer-events-none" style={{ y: parallaxY }}>
        <div
          className="absolute top-20 right-10 w-64 h-64 bg-secondary/5 rounded-full blur-3xl"
        />
        <div
          className="absolute bottom-10 left-10 w-80 h-80 bg-brand-gold/5 rounded-full blur-3xl"
        />
      </motion.div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Stats strip */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20 bg-gradient-to-r from-primary/5 via-secondary/5 to-brand-gold/5 rounded-2xl p-8 border border-border/50"
          {...revealSection}
        >
          {[
            { icon: TrendingUp, value: "50+", label: "Years of Experience", color: "text-secondary" },
            { icon: Users, value: "10L+", label: "Happy Clients", color: "text-brand-gold" },
            { icon: Award, value: "SEBI", label: "Registered Broker", color: "text-primary" },
            { icon: BarChart2, value: "NSE·BSE·MCX", label: "Exchange Member", color: "text-secondary" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              className="flex flex-col items-center text-center gap-3 group"
              {...revealSection}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              whileHover={{ y: -4 }}
            >
              <motion.div
                className="w-12 h-12 rounded-xl bg-white border border-border/50 shadow-sm flex items-center justify-center group-hover:shadow-md transition-shadow"
                whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                transition={{ duration: 0.5 }}
              >
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </motion.div>
              <div>
                <div className={`font-bold text-xl md:text-2xl ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={containerVariants}
          >
            <motion.h1
              className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6"
              variants={itemVariants}
            >
              Welcome to Parasram India
              <motion.span
                className="block text-secondary mt-2"
                {...revealSection}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
               Panipat Branch Since 1997
              </motion.span>
            </motion.h1>

            <motion.p className="text-muted-foreground text-lg mb-6" variants={itemVariants}>
              Parasram India is one of India's most trusted stock broking firms with over
              five decades of experience in the financial markets. Our Panipat branch,
              established in 1997, brings investment services right to your doorstep.
            </motion.p>

            <motion.p className="text-muted-foreground mb-8" variants={itemVariants}>
              Whether you're a seasoned investor or just starting your investment journey,
              our team of experts is here to guide you every step of the way. We combine
              traditional values with modern technology for a strong trading
              experience.
            </motion.p>

            <motion.div className="grid sm:grid-cols-2 gap-4" variants={containerVariants}>
              {features.map((feature, index) => (
                <motion.div
                  key={feature}
                  className="flex items-center gap-3 group"
                  variants={itemVariants}
                  whileHover={{ x: 6, backgroundColor: "hsl(145 70% 40% / 0.05)", borderRadius: "8px", padding: "4px 8px" }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <motion.div
                    /* motion-exempt: bare scale with no opacity, on a decorative ring that has no
                       content to fade. revealPop would add an opacity channel that does nothing here. */
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 + index * 0.1, type: "spring" }}
                  >
                    <CheckCircle2 className="w-5 h-5 text-secondary flex-shrink-0 group-hover:scale-110 transition-transform" />
                  </motion.div>
                  <span className="text-foreground">{feature}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          <motion.div
            className="relative"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={cardVariants}
          >
            <motion.div
              className="bg-hero rounded-2xl p-8 lg:p-12 text-primary-foreground shadow-2xl"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <h3 className="font-heading text-2xl font-bold mb-6">Why Choose Our Panipat Branch?</h3>
              <ul className="space-y-4">
                {[
                  { num: 1, title: "Local Expertise", desc: "Team that understands local market dynamics" },
                  { num: 2, title: "Personalized Service", desc: "Face-to-face consultations with our advisors" },
                  { num: 3, title: "Quick Resolution", desc: "On-ground support for all your queries" },
                ].map((item, index) => (
                  <motion.li
                    key={item.num}
                    className="flex gap-4 group"
                    {...revealItemX("right")}
                    whileHover={{ x: 4 }}
                  >
                    <motion.span
                      className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center flex-shrink-0 text-secondary-foreground font-bold"
                      whileHover={{ scale: 1.2, rotate: 360 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      {item.num}
                    </motion.span>
                    <div>
                      <div className="font-semibold group-hover:text-secondary transition-colors duration-fast">{item.title}</div>
                      <div className="text-primary-foreground/70 text-sm">{item.desc}</div>
                    </div>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            {/* Decorative elements */}
            <motion.div
              className="absolute -bottom-4 -right-4 w-24 h-24 bg-secondary/20 rounded-2xl -z-10"
              {...revealPop()}
              animate={{ rotate: [0, 5, -5, 0] }}
            />
            <motion.div
              className="absolute -top-4 -left-4 w-16 h-16 bg-brand-gold/20 rounded-xl -z-10"
              {...revealPop()}
              animate={{ rotate: [0, -8, 8, 0] }}
            />
            {/* Extra floating dot */}
            <motion.div
              className="absolute top-1/2 -right-8 w-6 h-6 bg-secondary/40 rounded-full -z-10"
              animate={{ y: [-10, 10, -10], opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 3, repeat: Infinity, ease: EASE_IN_OUT }}
            />
          </motion.div>
        </div>

        {/* Pan-India network strip - borrows the parent group's scale for branch trust */}
        <motion.div
          className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-center bg-muted/40 border border-border/40 rounded-2xl px-6 py-4"
          {...revealSection}
        >
          <span className="text-sm font-semibold text-foreground">
            Part of the Shri Parasram Holdings network
          </span>
          <span className="hidden sm:block w-px h-5 bg-border" />
          <span className="text-sm text-muted-foreground">
            <b className="text-secondary">350+</b> locations · <b className="text-secondary">160+</b> cities · <b className="text-secondary">1.3 Lakh+</b> network clients across India
          </span>
        </motion.div>

        {/* Vision & Mission */}
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <motion.div
            className="bg-card border border-border/50 rounded-2xl p-6 md:p-8 hover:border-secondary/40 hover:shadow-lg transition-[color,background-color,border-color,box-shadow]"
            {...revealSection}
          >
            <span className="inline-block text-secondary font-semibold text-xs uppercase tracking-[0.15em] mb-2">Our Vision</span>
            <p className="text-foreground/90 leading-relaxed">
              To be the most trusted investment partner in Haryana - bringing
              institutional-grade trading technology and research to every
              investor, from first SIP to seasoned portfolio.
            </p>
          </motion.div>
          <motion.div
            className="bg-card border border-border/50 rounded-2xl p-6 md:p-8 hover:border-brand-gold/40 hover:shadow-lg transition-[color,background-color,border-color,box-shadow]"
            {...revealSection}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <span className="inline-block text-brand-gold font-semibold text-xs uppercase tracking-[0.15em] mb-2">Our Mission</span>
            <p className="text-foreground/90 leading-relaxed">
              Foster investor confidence through fair practice, transparent
              pricing and personal guidance - so every client in Panipat invests
              with the same edge as those in the metros.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default About;
