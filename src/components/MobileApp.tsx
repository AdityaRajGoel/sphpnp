import { Smartphone, Download, Star, Shield, Zap, BarChart3, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

const features = [
  { icon: Zap, text: "Lightning Fast Trading" },
  { icon: Shield, text: "Bank-Level Security" },
  { icon: BarChart3, text: "Real-Time Charts" },
  { icon: Star, text: "Expert Research" },
];

const highlights = [
  "Instant order execution",
  "Advanced charting tools",
  "Live market notifications",
  "Portfolio analytics",
];

const MobileApp = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const phoneY = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const phoneRotate = useTransform(scrollYProgress, [0, 0.5, 1], [3, 0, -3]);
  const contentX = useTransform(scrollYProgress, [0, 0.5], [-20, 0]);

  return (
    <section ref={sectionRef} id="app" className="py-10 md:py-20 bg-hero overflow-hidden relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-20 left-20 w-64 h-64 bg-secondary/10 rounded-full blur-3xl"
        />
        <div
          className="absolute bottom-20 right-20 w-80 h-80 bg-brand-gold/10 rounded-full blur-3xl"
        />
        {/* Floating dots */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-secondary/20 rounded-full"
            style={{ top: `${20 + i * 12}%`, left: `${10 + i * 15}%` }}
            animate={{ y: [0, -15, 0], opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: 3 + i, repeat: Infinity, delay: i * 0.5 }}
          />
        ))}
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            style={{ x: contentX }}
          >
            <motion.div
              className="inline-flex items-center gap-2 bg-secondary/20 border border-secondary/30 rounded-full px-4 py-2 mb-6"
              animate={{ boxShadow: ["0 0 0 0 hsl(145 70% 40% / 0)", "0 0 0 6px hsl(145 70% 40% / 0.1)", "0 0 0 0 hsl(145 70% 40% / 0)"] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Smartphone className="w-4 h-4 text-secondary" />
              <span className="text-primary-foreground text-sm font-medium">Mobile App</span>
            </motion.div>

            <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary-foreground mb-6">
              Trade Anytime, Anywhere with
              <motion.span
                className="block text-secondary mt-2"
                animate={{ opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                Parasram Trade App
              </motion.span>
            </h2>

            <p className="text-primary-foreground/80 text-lg mb-8">
              Download our powerful mobile app to access markets on the go. 
              Experience seamless trading with real-time data, advanced charts, 
              and instant order execution.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-8">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.text}
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  whileHover={{ x: 5 }}
                >
                  <motion.div
                    className="w-10 h-10 bg-secondary/20 rounded-lg flex items-center justify-center"
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 4, repeat: Infinity, delay: index * 0.8 }}
                  >
                    <feature.icon className="w-5 h-5 text-secondary" />
                  </motion.div>
                  <span className="text-primary-foreground text-sm font-medium">{feature.text}</span>
                </motion.div>
              ))}
            </div>

            {/* Highlights list */}
            <div className="mb-8 space-y-2">
              {highlights.map((item, i) => (
                <motion.div
                  key={item}
                  className="flex items-center gap-2 text-primary-foreground/80 text-sm"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                >
                  <Check className="w-4 h-4 text-secondary flex-shrink-0" />
                  {item}
                </motion.div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                <Button
                  asChild
                  size="lg"
                  className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-semibold transition-colors duration-base"
                >
                  <a
                    href="https://play.google.com/store/apps/details?id=com.parasramindia.xts"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="mr-2 w-5 h-5" />
                    Google Play
                  </a>
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                <Button
                  asChild
                  size="lg"
                  className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-semibold transition-colors duration-base"
                >
                  <a
                    href="https://apps.apple.com/us/app/parasram-trade/id1564728869"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="mr-2 w-5 h-5" />
                    App Store
                  </a>
                </Button>
              </motion.div>
            </div>
          </motion.div>

          {/* Phone mockup */}
          <motion.div
            className="relative flex justify-center"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            style={{ y: phoneY, rotate: phoneRotate }}
          >
            <div className="relative">
              {/* Glow effect */}
              <div
                className="absolute inset-0 bg-secondary/30 blur-3xl rounded-full scale-75"
              />

              {/* Phone frame */}
              <div className="relative bg-foreground rounded-[3rem] p-3 shadow-2xl">
                <div className="bg-background rounded-[2.5rem] overflow-hidden w-64 h-[500px] flex flex-col">
                  {/* Dashboard Header */}
                  <div className="bg-muted px-3 py-2 flex items-center justify-between border-b border-border">
                    <span className="text-foreground text-xs font-bold">Dashboard</span>
                    <div className="flex gap-1">
                      <div className="w-4 h-4 bg-secondary/20 rounded-full" />
                      <div className="w-4 h-4 bg-muted-foreground/20 rounded-full" />
                    </div>
                  </div>

                  {/* Net Holdings */}
                  <div className="bg-muted/50 mx-2 mt-2 rounded-lg p-3 text-center">
                    <div className="text-[10px] text-muted-foreground">Net Holdings</div>
                    <div className="text-foreground text-sm font-bold">₹ 10,42,507.50</div>
                    <div className="text-secondary text-[10px] font-semibold mt-1">81,502.50 (39.11%)</div>
                  </div>

                  {/* Sector Allocation */}
                  <div className="mx-2 mt-2 bg-muted/50 rounded-lg p-2">
                    <div className="text-[9px] text-center text-muted-foreground font-semibold mb-1">Sector Allocation</div>
                    <div className="flex justify-center gap-3 text-[8px]">
                      <span className="text-secondary font-medium">Financial 69.89%</span>
                      <span className="text-brand-gold font-medium">Goods 18.22%</span>
                    </div>
                  </div>

                  {/* Position Summary */}
                  <div className="mx-2 mt-2 bg-muted/50 rounded-lg p-2 flex justify-between items-center">
                    <div className="text-[10px] text-muted-foreground font-semibold">Position Summary</div>
                    <div className="text-right">
                      <div className="text-secondary text-xs font-bold">₹ 642.80</div>
                      <div className="text-[8px] text-muted-foreground">4 Scrips</div>
                    </div>
                  </div>

                  {/* Orders */}
                  <div className="mx-2 mt-2 bg-muted/50 rounded-lg p-2">
                    <div className="text-[9px] text-center text-muted-foreground font-semibold mb-1">Total Orders: 4</div>
                    <div className="grid grid-cols-3 text-center text-[8px]">
                      <div><div className="font-bold text-foreground">1</div><div className="text-muted-foreground">Executed</div></div>
                      <div className="border-x border-border"><div className="font-bold text-foreground">0</div><div className="text-muted-foreground">Open</div></div>
                      <div><div className="font-bold text-foreground">3</div><div className="text-muted-foreground">Others</div></div>
                    </div>
                  </div>

                  {/* Bottom Nav */}
                  <div className="mt-auto border-t border-border flex justify-around py-2">
                    {["Markets", "Watch", "Dashboard", "Position"].map((tab, i) => (
                      <div key={tab} className={`text-[8px] text-center ${i === 2 ? "text-secondary font-bold" : "text-muted-foreground"}`}>
                        {tab}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating elements */}
              <motion.div
                className="absolute -top-4 -right-4 bg-secondary text-secondary-foreground rounded-full px-4 py-2 text-sm font-semibold shadow-lg"
                animate={{ y: [0, -10, 0], scale: [1, 1.05, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                4.5 ★ Rating
              </motion.div>

              <motion.div
                className="absolute -bottom-4 -left-4 bg-card text-foreground rounded-full px-4 py-2 text-sm font-semibold shadow-lg"
                animate={{ y: [0, 10, 0], scale: [1, 1.05, 1] }}
                transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
              >
                100K+ Downloads
              </motion.div>

              {/* New floating notification */}
              <motion.div
                className="absolute top-1/3 -left-16 bg-card/90 backdrop-blur-sm text-foreground rounded-xl px-3 py-2 text-xs shadow-lg border border-border/50"
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, delay: 1 }}
              >
                <span className="text-secondary font-bold">↗ NIFTY</span> +0.85%
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default MobileApp;
