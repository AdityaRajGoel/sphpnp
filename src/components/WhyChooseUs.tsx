import { motion, Variants } from "motion/react";
import { RevealText } from "@/components/ui/RevealText";
import {
  Shield, Smartphone, Award, PhoneCall, Percent,
  Headphones, MapPin, TrendingUp, MessageCircle
} from "lucide-react";
import { EASE_OUT } from "@/lib/motion";

const usps = [
  {
    icon: Award,
    title: "50+ Years Legacy",
    description: "Trusted since 1970 with a proven track record in Indian financial markets",
  },
  {
    icon: Shield,
    title: "SEBI Registered",
    description: "Fully regulated and compliant with all SEBI, NSE, BSE, MCX guidelines",
  },
  {
    icon: MapPin,
    title: "Local Panipat Office",
    description: "Walk-in support at our Palika Bazaar branch - personal service, not a call center",
  },
  {
    icon: Smartphone,
    title: "Parasram Trade App",
    description: "Trade on-the-go with our powerful mobile app available on Android & iOS",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp Reports",
    description: "Get daily market reports, SR levels, and alerts directly on WhatsApp",
  },
  {
    icon: PhoneCall,
    title: "Free ₹0 Call-to-Trade",
    description: "Call your dealer, we place the order - the traditional desk busy businessmen rely on, at no charge",
  },
  {
    icon: TrendingUp,
    title: "Expert Research",
    description: "Daily research reports, stock picks, and market analysis from our SEBI-registered analysts",
  },
  {
    icon: Percent,
    title: "Custom Brokerage & MTF",
    description: "Brokerage plans and margin (MTF) relationships tailored to your trading volume and needs",
  },
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: EASE_OUT },
  },
};

const WhyChooseUs = () => {
  return (
    <section className="py-12 md:py-20 bg-background overflow-hidden relative">
      {/* Background ornaments */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-20 left-0 w-72 h-72 bg-secondary/5 rounded-full blur-3xl"
        />
        <div
          className="absolute bottom-10 right-0 w-96 h-96 bg-brand-gold/5 rounded-full blur-3xl"
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <motion.span
            className="inline-block text-secondary font-semibold text-sm uppercase tracking-wider mb-3"
            initial={{ opacity: 0, letterSpacing: "0em" }}
            whileInView={{ opacity: 1, letterSpacing: "0.15em" }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            Why Parasram Panipat
          </motion.span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-3">
            <RevealText text="Why Choose Us?" />
          </h2>
          <motion.div
            className="w-20 h-1 bg-gradient-to-r from-secondary to-brand-gold mx-auto rounded-full mb-4"
            initial={{ width: 0 }}
            whileInView={{ width: 80 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.6 }}
          />
          <p className="text-muted-foreground max-w-xl mx-auto">
            Panipat's most trusted investment partner - combining national-level expertise with personal, local service.
          </p>
        </motion.div>

        <motion.div
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          {usps.map((usp) => {
            const Icon = usp.icon;
            return (
              <motion.div
                key={usp.title}
                variants={itemVariants}
                whileHover={{ y: -6, scale: 1.02 }}
                className="group relative bg-card border border-border/50 rounded-2xl p-5 hover:border-secondary/40 hover:shadow-xl transition-[color,background-color,border-color,box-shadow] duration-base overflow-hidden"
              >
                {/* Hover gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-brand-gold/5 opacity-0 group-hover:opacity-100 transition-opacity duration-slow" />

                <div className="relative z-10">
                  <motion.div
                    className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-secondary/20 group-hover:scale-110 transition-[color,background-color,border-color,transform] ease-out duration-base"
                    whileHover={{ rotate: [0, -8, 8, 0] }}
                    transition={{ duration: 0.5 }}
                  >
                    <Icon className="w-6 h-6 text-secondary" />
                  </motion.div>

                  <h3 className="font-heading text-base font-bold text-foreground mb-1.5 group-hover:text-secondary transition-colors duration-base">
                    {usp.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {usp.description}
                  </p>
                </div>

                {/* Bottom accent */}
                <motion.div
                  className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-secondary to-brand-gold"
                  initial={{ width: 0 }}
                  whileHover={{ width: "100%" }}
                  transition={{ duration: 0.3 }}
                />
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};

export default WhyChooseUs;
