import { TrendingUp, BarChart3, Wallet, Globe, FileText, Smartphone, ArrowUpRight, Vault, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { motion, Variants, useScroll, useTransform } from "motion/react";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useT } from "@/i18n/LanguageContext";
import { EASE_OUT, revealBar, revealFade, revealSection } from "@/lib/motion";

// Every service links to the page that actually explains it - the cards show a
// "go" arrow, so they must be real links.
const services = [
  {
    icon: TrendingUp,
    title: "Equity Trading",
    id: "equity-trading",
    href: "/pricing",
    description: "Trade in NSE & BSE with our advanced trading platforms and expert guidance.",
    stat: "50+ Years",
    statLabel: "Market Expertise",
  },
  {
    icon: BarChart3,
    title: "Derivatives",
    id: "derivatives",
    href: "/fno",
    description: "Futures & Options trading with comprehensive research and market analysis.",
    stat: "Real-Time",
    statLabel: "Market Data",
  },
  {
    icon: Globe,
    title: "Currency Trading",
    id: "currency-trading",
    href: "/pricing",
    description: "Trade in currency derivatives with competitive pricing and real-time quotes.",
    stat: "24/5",
    statLabel: "Market Access",
  },
  {
    icon: Wallet,
    title: "Mutual Funds",
    id: "mutual-funds",
    href: "/learn/mutual-funds-guide",
    description: "Invest in top-performing mutual funds with expert portfolio management.",
    stat: "500+",
    statLabel: "Fund Options",
  },
  {
    icon: FileText,
    title: "IPO Services",
    id: "ipo-services",
    href: "/learn/ipo-guide",
    description: "Get early access to IPOs and expert recommendations for your investments.",
    stat: "Priority",
    statLabel: "Allotment Access",
  },
  {
    icon: Building2,
    title: "Unlisted Shares",
    id: "unlisted-shares",
    href: "/unlisted-space",
    description: "Buy pre-IPO and unlisted company shares, transferred straight to your Demat.",
    stat: "50+",
    statLabel: "Verified Companies",
  },
  {
    icon: Vault,
    title: "Depository Services",
    id: "depository-services",
    href: "/depository-services",
    description: "NSDL & CDSL Demat account with seamless transfers and margin pledging.",
    stat: "NSDL · CDSL",
    statLabel: "Registered DP",
  },
  {
    icon: Smartphone,
    title: "Mobile Trading",
    id: "mobile-trading",
    href: "/open-account",
    description: "Trade on-the-go with our powerful Parasram Trade mobile app.",
    stat: "100K+",
    statLabel: "App Downloads",
  },
];

const Services = () => {
  const { t } = useT();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const bgY = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const rotateOrb = useTransform(scrollYProgress, [0, 1], [0, 360]);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 50, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.5, ease: EASE_OUT },
    },
  };

  return (
    <section ref={sectionRef} id="services" className="py-12 md:py-24 bg-muted/50 overflow-hidden relative">
      {/* Parallax background orbs */}
      <motion.div className="absolute inset-0 pointer-events-none" style={{ y: bgY }}>
        <div
          className="absolute top-10 left-10 w-72 h-72 bg-secondary/5 rounded-full blur-3xl"
        />
        <div
          className="absolute bottom-10 right-10 w-96 h-96 bg-brand-gold/5 rounded-full blur-3xl"
        />
        {/* Orbiting element */}
        <motion.div
          className="absolute top-1/2 left-1/2 w-4 h-4 bg-secondary/20 rounded-full"
          style={{ rotate: rotateOrb, x: 200, y: -100 }}
        />
      </motion.div>

      {/* Animated grid lines */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-secondary/10 to-transparent"
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{ duration: 4, repeat: Infinity, delay: 0 }}
        />
        <motion.div
          className="absolute top-0 left-2/4 w-px h-full bg-gradient-to-b from-transparent via-brand-gold/10 to-transparent"
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{ duration: 4, repeat: Infinity, delay: 1.5 }}
        />
        <motion.div
          className="absolute top-0 left-3/4 w-px h-full bg-gradient-to-b from-transparent via-secondary/10 to-transparent"
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{ duration: 4, repeat: Infinity, delay: 3 }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="text-center mb-16"
          {...revealSection}
        >
          <motion.span
            className="inline-block text-secondary font-semibold text-sm uppercase tracking-wider mb-4"
            initial={{ opacity: 0, letterSpacing: "0em" }}
            whileInView={{ opacity: 1, letterSpacing: "0.15em" }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            {t("services.eyebrow")}
          </motion.span>
          <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            {t("page.services")}
          </h1>
          <motion.div
            className="w-20 h-1 bg-gradient-to-r from-secondary to-brand-gold mx-auto rounded-full mb-4"
            {...revealBar}
          />
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Your one-stop financial supermarket - equity, F&O, commodities,
            mutual funds, IPOs, insurance, bonds and FDs, all under one
            SEBI-registered roof in Panipat.
          </p>
        </motion.div>

        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          {services.map((service, index) => (
            <motion.div
              key={service.title}
              id={service.id}
              variants={cardVariants}
              whileHover={{ y: -10, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300 }}
              onHoverStart={() => setHoveredIndex(index)}
              onHoverEnd={() => setHoveredIndex(null)}
            >
              <Link
                to={service.href}
                aria-label={`${service.title} - learn more`}
                className="block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
              >
              <Card className="group bg-card hover:shadow-2xl transition-[box-shadow,color,background-color,border-color] duration-base border-border/50 hover:border-secondary/50 overflow-hidden h-full relative">
                {/* Gradient overlay on hover */}
                <motion.div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-brand-gold/5 opacity-0 group-hover:opacity-100 transition-opacity duration-slow" />

                <CardContent className="p-6 relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <motion.div
                      className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-secondary/20 transition-colors duration-base"
                      animate={hoveredIndex === index ? { rotate: [0, -10, 10, 0] } : {}}
                      transition={{ duration: 0.5 }}
                    >
                      <service.icon className="w-7 h-7 text-primary group-hover:text-secondary transition-colors duration-base" />
                    </motion.div>
                    <motion.div
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-base"
                      animate={hoveredIndex === index ? { x: [0, 4, 0] } : {}}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      <ArrowUpRight className="w-5 h-5 text-secondary" />
                    </motion.div>
                  </div>
                  <h3 className="font-heading text-xl font-semibold text-foreground mb-2 group-hover:text-secondary transition-colors duration-base">
                    {service.title}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {service.description}
                  </p>
                  {/* Stat badge */}
                  <motion.div
                    className="inline-flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5"
                    {...revealFade}
                    transition={{ delay: 0.3 + index * 0.05 }}
                  >
                    <span className="text-secondary font-bold text-sm">{service.stat}</span>
                    <span className="text-muted-foreground text-xs">{service.statLabel}</span>
                  </motion.div>
                </CardContent>

                {/* Bottom accent line */}
                <motion.div
                  className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-secondary to-brand-gold"
                  initial={{ width: 0 }}
                  whileHover={{ width: "100%" }}
                  transition={{ duration: 0.3 }}
                />
              </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="text-center mt-12"
          {...revealSection}
          transition={{ delay: 0.5 }}
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/open-account"
              className="btn-shine inline-flex items-center justify-center gap-2 min-h-[44px] px-7 py-3 rounded-full bg-brand-green text-white font-semibold hover:opacity-90 transition-opacity"
            >
              Open a Free Demat Account
              <ArrowUpRight className="w-4 h-4" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-3 rounded-full border border-border text-foreground font-semibold hover:border-secondary hover:text-secondary transition-colors"
            >
              See Brokerage Charges
            </Link>
          </div>
          <a
            href="https://parasramindia.com/services"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-secondary transition-colors"
          >
            View all services on our main website
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default Services;
