import { motion } from "motion/react";
import { useState } from "react";
import { Trophy, Award, Star, ShieldCheck, HeartHandshake, Maximize2 } from "lucide-react";

import { revealSection } from "@/lib/motion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const awards = [
  { icon: Trophy, title: "Top Volume Broker", org: "", year: "2023-24", desc: "Recognized for driving massive trading volumes across multiple segments." },
  { icon: Star, title: "Star Performer", org: "", year: "2022-23", desc: "Awarded for exceptional depository growth and unyielding service quality." },
  { icon: ShieldCheck, title: "Excellence in Compliance", org: "", year: "2021-22", desc: "Commended for maintaining strictly transparent and secure trading operations." },
  { icon: Award, title: "Best Brokerage Firm", org: "", year: "2020-21", desc: "Voted as one of the most trusted retail brokers by industry peers." },
  { icon: HeartHandshake, title: "Top Distributor", org: "", year: "Regional", desc: "Honored for driving significant financial literacy and SIP adoption." },
];

/**
 * The certificates are the section's evidence: each one is a dated, named
 * artifact from a depository that a reader can look at. The awards list below is
 * supporting context. The layout follows that hierarchy rather than the reverse.
 *
 * `issuer` and `year` are split out of the title so they can be shown on the
 * card itself. Previously the grid rendered three unlabelled images, so the
 * reader had to open a lightbox to find out what any of them were.
 */
const certificates = [
  {
    thumb: "/cert-thumb.webp",
    full: "/cert.webp",
    width: 500,
    height: 434,
    issuer: "NSDL",
    year: "",
    title: "₹100 Lakh Crore Assets Milestone",
  },
  {
    thumb: "/cert2-thumb.webp",
    full: "/cert2.webp",
    width: 500,
    height: 419,
    issuer: "CDSL",
    year: "2015",
    title: "1 Crore Demat Accounts Milestone",
  },
  {
    thumb: "/cert3-thumb.webp",
    full: "/cert3.webp",
    width: 500,
    height: 412,
    issuer: "NSDL",
    year: "2015",
    title: "Star Performer Award, Top Performer in New Accounts Opened (Non-Bank, 3rd Position)",
  },
];

const AwardsSection = () => {
  const [openCert, setOpenCert] = useState<number | null>(null);

  // The scroll-linked scale that used to breathe this whole block from 0.95 to
  // 1 and back is gone. It resampled text every frame while scrolling, which
  // softened the very words the section exists to be read, and it dragged a
  // large subtree onto the compositor for no informational gain.
  return (
    <section className="py-12 md:py-20 relative overflow-hidden bg-background">
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

        {/*
          Certificates lead. They are the part a reader can actually verify: a
          named depository, a dated milestone, a document to open. Each card now
          carries its issuer and title, so the grid reads without opening
          anything - previously it was three unlabelled images.
        */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {certificates.map((cert, index) => (
            <motion.div key={cert.full} {...revealSection} transition={{ delay: index * 0.08, duration: 0.5 }}>
              <button
                type="button"
                onClick={() => setOpenCert(index)}
                className="
                  group block w-full text-left rounded-2xl overflow-hidden
                  border border-border/60 bg-card
                  shadow-[0_2px_10px_-6px_hsl(var(--brand-navy)/0.25)]
                  hover:shadow-[0_14px_36px_-14px_hsl(var(--brand-navy)/0.35)]
                  hover:border-brand-gold/60
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background
                  transition-[border-color,box-shadow,transform] duration-base ease-out
                  motion-safe:hover:-translate-y-1
                "
                aria-label={`View certificate: ${cert.issuer} ${cert.title}`}
              >
                {/* Fixed aspect box so three portrait scans of slightly different
                    ratios line up, and so the row cannot shift as they load. */}
                <span className="relative block aspect-[5/6] overflow-hidden bg-muted/40">
                  <img
                    src={cert.thumb}
                    alt={`${cert.issuer} certificate: ${cert.title}`}
                    width={cert.width}
                    height={cert.height}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-slow ease-out motion-safe:group-hover:scale-[1.04]"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-brand-navy/55 to-transparent opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-base"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-background/95 px-2.5 py-1 text-[11px] font-medium text-foreground opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 group-focus-visible:opacity-100 group-focus-visible:translate-y-0 transition-[opacity,transform] duration-base"
                  >
                    <Maximize2 className="h-3 w-3" />
                    View
                  </span>
                </span>

                <span className="block p-4">
                  <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-brand-gold">
                    {cert.issuer}
                    {cert.year && (
                      <>
                        <span aria-hidden="true" className="h-1 w-1 rounded-full bg-brand-gold/50" />
                        <span className="text-muted-foreground">{cert.year}</span>
                      </>
                    )}
                  </span>
                  <span className="mt-1.5 block font-heading text-[0.9375rem] font-semibold leading-snug text-foreground">
                    {cert.title}
                  </span>
                </span>
              </button>
            </motion.div>
          ))}
        </div>

        {/*
          Awards as a chronological list rather than five identical icon cards.
          The years run 2023-24 back to 2020-21, so sequence is real information
          and the eye should be able to follow it down a single column. Five
          equal-weight cards flattened that into a wall and made the section read
          as decoration.
        */}
        <motion.div className="mt-14 md:mt-20" {...revealSection}>
          <h3 className="font-heading text-xl md:text-2xl font-bold text-foreground mb-6">
            Industry recognition
          </h3>
          <ul className="divide-y divide-border/70 border-y border-border/70">
            {awards.map((award, index) => (
              <motion.li
                key={award.title}
                {...revealSection}
                transition={{ delay: Math.min(index, 4) * 0.05, duration: 0.45 }}
                className="group flex flex-col gap-2 py-4 sm:flex-row sm:items-baseline sm:gap-6"
              >
                <span className="flex items-center gap-2.5 sm:w-32 sm:shrink-0">
                  <award.icon className="h-4 w-4 shrink-0 text-brand-gold" aria-hidden="true" />
                  {/* tabular-nums so the year column stays optically aligned */}
                  <span className="text-sm font-semibold tabular-nums text-foreground">{award.year}</span>
                </span>
                <span className="min-w-0">
                  <span className="block font-heading text-base font-semibold text-foreground">
                    {award.title}
                    {/* Rendered only when an issuer exists. Every entry currently
                        has an empty org, which the previous markup still printed
                        as a stray bullet before the year on all five cards. */}
                    {award.org && (
                      <span className="ml-2 text-xs font-medium uppercase tracking-wider text-primary/80">
                        {award.org}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">
                    {award.desc}
                  </span>
                </span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </div>

      <Dialog open={openCert !== null} onOpenChange={(open) => !open && setOpenCert(null)}>
        <DialogContent className="sm:max-w-2xl p-3 bg-background">
          {openCert !== null && (
            <>
              {/* max-h keeps a tall portrait scan inside the viewport on a laptop
                  instead of running past the fold with no way to see the foot. */}
              <img
                src={certificates[openCert].full}
                alt={`${certificates[openCert].issuer} certificate: ${certificates[openCert].title}`}
                className="w-full h-auto max-h-[72vh] object-contain rounded-lg"
              />
              <DialogTitle className="pt-1 pb-2 text-center">
                <span className="block text-[11px] font-semibold uppercase tracking-widest text-brand-gold">
                  {certificates[openCert].issuer}
                  {certificates[openCert].year && (
                    <span className="text-muted-foreground"> · {certificates[openCert].year}</span>
                  )}
                </span>
                <span className="mt-1 block text-sm font-medium text-foreground">
                  {certificates[openCert].title}
                </span>
              </DialogTitle>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default AwardsSection;
