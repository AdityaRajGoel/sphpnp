import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { Phone, Instagram, Facebook, MapPin } from "lucide-react";
import brandImage from "@/assets/parasram-brand.jpeg";
import { EASE_OUT, revealSection } from "@/lib/motion";

const BrandBanner = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.92, 1, 0.92]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.3, 1, 1, 0.3]);

  return (
    <section ref={ref} className="py-8 md:py-16 bg-gradient-to-b from-muted/30 to-background relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 left-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl"
        />
        <div
          className="absolute bottom-0 right-1/4 w-80 h-80 bg-brand-gold/5 rounded-full blur-3xl"
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          style={{ y, scale, opacity }}
          className="flex flex-col items-center"
        >
          {/* Brand card with image */}
          <motion.div
            className="bg-card rounded-3xl shadow-2xl border border-border/50 overflow-hidden max-w-2xl w-full"
            {...revealSection}
            transition={{ duration: 0.7, ease: EASE_OUT }}
            whileHover={{ boxShadow: "0 30px 60px -15px hsl(213 80% 25% / 0.25)" }}
          >
            <motion.img
              src={brandImage}
              alt="Parasram - Science of Investment"
              className="w-full h-auto"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.4 }}
            />
          </motion.div>

          {/* Quick contact strip below */}
          <motion.div
            className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 sm:gap-6 mt-6 sm:mt-8 text-xs sm:text-sm text-muted-foreground"
            {...revealSection}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <motion.a
              href="tel:+919416400314"
              className="flex items-center gap-2 hover:text-secondary transition-colors"
              whileHover={{ scale: 1.05 }}
            >
              <Phone className="w-4 h-4" />
              +91 9416400314
            </motion.a>
            <motion.a
              href="https://www.instagram.com/parasrampanipat/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-secondary transition-colors"
              whileHover={{ scale: 1.05 }}
            >
              <Instagram className="w-4 h-4" />
              @parasrampanipat
            </motion.a>
            <motion.a
              href="https://www.facebook.com/share/18B5W5rZaT/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-secondary transition-colors"
              whileHover={{ scale: 1.05 }}
            >
              <Facebook className="w-4 h-4" />
              Facebook
            </motion.a>
            <motion.span
              className="flex items-center gap-2"
              whileHover={{ scale: 1.05 }}
            >
              <MapPin className="w-4 h-4" />
              Panipat - 132103
            </motion.span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default BrandBanner;
