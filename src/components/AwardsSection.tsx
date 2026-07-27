import { motion, useScroll, useTransform } from "motion/react";
import { useRef, useState } from "react";
import { Trophy, Award, Star, ShieldCheck, HeartHandshake } from "lucide-react";

import { revealSection } from "@/lib/motion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const awards = [
  { icon: Trophy, title: "Top Volume Broker", org: "", year: "2023-24", desc: "Recognized for driving massive trading volumes across multiple segments." },
  { icon: Star, title: "Star Performer", org: "", year: "2022-23", desc: "Awarded for exceptional depository growth and unyielding service quality." },
  { icon: ShieldCheck, title: "Excellence in Compliance", org: "", year: "2021-22", desc: "Commended for maintaining strictly transparent and secure trading operations." },
  { icon: Award, title: "Best Brokerage Firm", org: "", year: "2020-21", desc: "Voted as one of the most trusted retail brokers by industry peers." },
  { icon: HeartHandshake, title: "Top Distributor", org: "", year: "Regional", desc: "Honored for driving significant financial literacy and SIP adoption." },
];

const certificates = [
  {
    thumb: "/cert-thumb.webp",
    full: "/cert.webp",
    width: 500,
    height: 434,
    title: "NSDL ₹100 Lakh Crore Assets Milestone",
  },
  {
    thumb: "/cert2-thumb.webp",
    full: "/cert2.webp",
    width: 500,
    height: 419,
    title: "CDSL 1 Crore Demat Accounts Milestone (2015)",
  },
  {
    thumb: "/cert3-thumb.webp",
    full: "/cert3.webp",
    width: 500,
    height: 412,
    title: "NSDL Star Performer Award 2015 — Top Performer, New Accounts Opened (Non-Bank, 3rd Position)",
  },
];

const AwardsSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.95, 1, 0.95]);
  const [openCert, setOpenCert] = useState<number | null>(null);

  return (
    <section ref={ref} className="py-12 md:py-20 relative overflow-hidden bg-background">
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-gold/10 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl opacity-50" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div 
          className="text-center mb-16"
          {...revealSection}
        >
          <span className="inline-block text-secondary font-semibold text-sm uppercase tracking-wider mb-3">
            Trust & Recognition
          </span>
          <h2 className="font-heading text-3xl md:text-5xl font-bold text-foreground mb-4">
            Our Legacy of <span className="text-secondary">Excellence</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Decades of trust, millions of clients, and recognition across the industry.
          </p>
        </motion.div>

        <motion.div style={{ scale }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {awards.map((award, index) => (
            <motion.div
              key={index}
              className="bg-card glass-card rounded-2xl p-6 text-center border-border/50 hover:border-brand-gold/50 shadow-sm hover:shadow-xl transition-[color,background-color,border-color,box-shadow] duration-base group"
              {...revealSection}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              whileHover={{ y: -5 }}
            >
              <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-brand-gold/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-brand-gold/20 transition-[transform,color,background-color,border-color] ease-out duration-base">
                <award.icon className="w-8 h-8 text-brand-gold" />
              </div>
              <h3 className="font-heading font-bold text-lg text-foreground mb-1">{award.title}</h3>
              <div className="text-xs font-semibold text-primary/80 uppercase tracking-widest mb-3 flex items-center justify-center gap-2">
                <span>{award.org}</span>
                <span className="w-1 h-1 rounded-full bg-secondary"></span>
                <span>{award.year}</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {award.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div className="mt-16 text-center" {...revealSection}>
          <h3 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-8">
            Our Certificates
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {certificates.map((cert, index) => (
              <button
                key={cert.full}
                type="button"
                onClick={() => setOpenCert(index)}
                className="group relative rounded-2xl overflow-hidden border border-border/50 bg-card shadow-sm hover:border-brand-gold/50 hover:shadow-xl transition-[color,background-color,border-color,box-shadow] duration-base"
                aria-label={`View certificate: ${cert.title}`}
              >
                <img
                  src={cert.thumb}
                  alt={cert.title}
                  width={cert.width}
                  height={cert.height}
                  loading="lazy"
                  className="w-full h-auto object-cover transition-transform duration-base group-hover:scale-105"
                />
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      <Dialog open={openCert !== null} onOpenChange={(open) => !open && setOpenCert(null)}>
        <DialogContent className="sm:max-w-2xl p-2 bg-background">
          {openCert !== null && (
            <>
              <img
                src={certificates[openCert].full}
                alt={certificates[openCert].title}
                className="w-full h-auto rounded-lg"
              />
              <DialogTitle className="text-center text-sm font-normal text-muted-foreground pb-2">
                {certificates[openCert].title}
              </DialogTitle>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default AwardsSection;
