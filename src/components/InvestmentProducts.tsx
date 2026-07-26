import { motion, Variants } from "motion/react";
import { Link } from "react-router-dom";
import { RevealText } from "@/components/ui/RevealText";
import {
  LineChart, Activity, Sparkles, PiggyBank, Rocket,
  Gem, Landmark, Vault, ArrowRight, BadgeCheck,
} from "lucide-react";
import { EASE_IN_OUT, EASE_OUT, revealSection } from "@/lib/motion";

// Segmented product menu - the pattern both Motilal Oswal & Angel One lead
// with. Each card links to an existing route and maps to the parent
// company's product line (equity, F&O, MF, IPO, commodities, unlisted,
// bonds/FD, depository).
// Bento layout: "featured" spans 2x2 on desktop (full-width on mobile),
// "wide" spans 2 columns. Order matters for grid auto-placement.
type ProductLayout = "featured" | "wide" | undefined;
const products: { icon: typeof LineChart; title: string; desc: string; to: string; tag: string; layout?: ProductLayout }[] = [
  { icon: LineChart, title: "Stocks & Equity", desc: "Invest in NSE & BSE listed companies with a free Demat account, backed by daily research from SEBI-registered analysts.", to: "/screener", tag: "Live Screener", layout: "featured" },
  { icon: Activity, title: "Futures & Options", desc: "Trade NIFTY, BANKNIFTY & stock F&O with live option-chain tools.", to: "/fno", tag: "PCR & Max Pain" },
  { icon: PiggyBank, title: "Mutual Funds & SIP", desc: "Start a SIP from ₹500/month across direct & regular funds.", to: "/services", tag: "From ₹500" },
  { icon: Rocket, title: "IPO Investments", desc: "Apply for upcoming IPOs online via UPI/ASBA in a few taps.", to: "/services", tag: "UPI / ASBA" },
  { icon: Gem, title: "Commodities (MCX)", desc: "Trade gold, silver, crude oil & agri commodities on MCX & NCDEX.", to: "/services", tag: "MCX · NCDEX" },
  { icon: Sparkles, title: "Unlisted & Pre-IPO", desc: "Buy verified pre-IPO and unlisted shares before they list on the exchange.", to: "/unlisted-space", tag: "Exclusive", layout: "wide" },
  { icon: Landmark, title: "Bonds, FD & Insurance", desc: "Diversify beyond equity with FDs, corporate bonds & insurance.", to: "/products", tag: "Safer Yields" },
  { icon: Vault, title: "Demat & Depository", desc: "Secure CDSL/NSDL depository services, pledging & transfers.", to: "/depository-services", tag: "CDSL · NSDL" },
];

// Decorative market sparkline for the featured card - draws itself on scroll-in.
const FeaturedSparkline = () => (
  <svg viewBox="0 0 220 64" preserveAspectRatio="none" fill="none" className="w-full h-16 md:h-24 mt-auto pt-2" aria-hidden="true">
    <defs>
      <linearGradient id="spark-stroke" x1="0" y1="0" x2="220" y2="0" gradientUnits="userSpaceOnUse">
        <stop stopColor="hsl(var(--secondary))" />
        <stop offset="1" stopColor="hsl(var(--brand-gold))" />
      </linearGradient>
    </defs>
    <motion.path
      d="M2 52 L28 44 L52 48 L76 32 L100 38 L124 20 L148 27 L174 12 L202 18 L218 6"
      stroke="url(#spark-stroke)"
      strokeWidth="2.5"
      strokeLinecap="round"
      /* motion-exempt: SVG pathLength draw-on. No transform reproduces a stroke
         revealing along its own length, so there is no preset equivalent. */
      initial={{ pathLength: 0 }}
      whileInView={{ pathLength: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 1.6, ease: EASE_IN_OUT, delay: 0.3 }}
    />
    <motion.circle
      cx="218" cy="6" r="3.5"
      fill="hsl(var(--brand-gold))"
      /* motion-exempt: three-step keyframe overshoot on the path's end cap. The
         presets are all two-state by design; a keyframe array is a different shape. */
      initial={{ scale: 0, opacity: 0 }}
      whileInView={{ scale: [0, 1.4, 1], opacity: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: 1.9 }}
    />
  </svg>
);

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: EASE_OUT } },
};

// Track cursor position as CSS vars so the card glow follows the pointer.
const handleCardGlow = (e: React.MouseEvent<HTMLElement>) => {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
  el.style.setProperty("--my", `${e.clientY - rect.top}px`);
};

const InvestmentProducts = () => {
  return (
    <section className="py-12 md:py-20 bg-background overflow-hidden relative">
      {/* Background ornaments - consistent with WhyChooseUs */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-16 right-0 w-80 h-80 bg-secondary/5 rounded-full blur-3xl"
        />
        <div
          className="absolute bottom-0 left-0 w-96 h-96 bg-brand-gold/5 rounded-full blur-3xl"
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Heading */}
        <motion.div
          className="text-center mb-10"
          {...revealSection}
        >
          <span className="inline-block text-secondary font-semibold text-sm uppercase tracking-[0.15em] mb-3">
            One Platform · Every Investment
          </span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-3">
            <RevealText text="Explore What You Can Invest In" />
          </h2>
          <div className="w-20 h-1 bg-gradient-to-r from-secondary to-brand-gold mx-auto rounded-full mb-4" />
          <p className="text-muted-foreground max-w-xl mx-auto">
            From equities to unlisted shares - a full-service brokerage experience, all under one roof.
          </p>
        </motion.div>

        {/* Product grid */}
        <motion.div
          className="grid grid-cols-2 lg:grid-cols-4 lg:auto-rows-fr gap-4 md:gap-5"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          {products.map((p) => {
            const Icon = p.icon;
            const isFeatured = p.layout === "featured";
            const isWide = p.layout === "wide";
            const spanClass = isFeatured
              ? "col-span-2 lg:row-span-2 border-beam rounded-2xl"
              : isWide
              ? "col-span-2"
              : "";
            return (
              <motion.div key={p.title} variants={itemVariants} whileHover={{ y: -6 }} className={spanClass}>
                <Link
                  to={p.to}
                  aria-label={`${p.title} - learn more`}
                  onMouseMove={handleCardGlow}
                  className={`card-glow group relative flex flex-col h-full bg-card border border-border/50 rounded-2xl hover:border-secondary/40 hover:shadow-xl transition-[color,background-color,border-color,box-shadow] duration-base overflow-hidden ${
                    isFeatured ? "p-5 md:p-7 bg-gradient-to-br from-card to-secondary/[0.04]" : "p-4 md:p-5"
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-brand-gold/5 opacity-0 group-hover:opacity-100 transition-opacity duration-slow" />

                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`bg-secondary/10 rounded-xl flex items-center justify-center group-hover:bg-secondary/20 group-hover:scale-110 transition-[color,background-color,border-color,transform] ease-out duration-base ${isFeatured ? "w-14 h-14" : "w-11 h-11"}`}>
                        <Icon className={`text-secondary ${isFeatured ? "w-7 h-7" : "w-5 h-5"}`} />
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-wide text-brand-orange bg-brand-orange/10 border border-brand-orange/20 rounded-full px-2 py-0.5">
                        {p.tag}
                      </span>
                    </div>

                    <h3 className={`font-heading font-bold text-foreground mb-1.5 group-hover:text-secondary transition-colors duration-base ${isFeatured ? "text-lg md:text-2xl" : "text-sm md:text-base"}`}>
                      {p.title}
                    </h3>
                    <p className={`text-muted-foreground leading-relaxed flex-1 ${isFeatured ? "text-sm md:text-base max-w-md" : "text-xs md:text-sm"}`}>
                      {p.desc}
                    </p>

                    {isFeatured && <FeaturedSparkline />}

                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-secondary opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-[opacity,transform] ease-out duration-base">
                      Explore <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>

                  <motion.div
                    className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-secondary to-brand-gold"
                    initial={{ width: 0 }}
                    whileHover={{ width: "100%" }}
                    transition={{ duration: 0.3 }}
                  />
                </Link>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Trust strip + primary CTA - competitor pattern: funnel to account opening */}
        <motion.div
          className="mt-10 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 text-center"
          {...revealSection}
        >
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
              <BadgeCheck className="w-4 h-4 text-secondary" /> ₹0 Account Opening
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
              <BadgeCheck className="w-4 h-4 text-secondary" /> SEBI Registered
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
              <BadgeCheck className="w-4 h-4 text-secondary" /> NSE · BSE · MCX
            </span>
          </div>
          <Link
            to="/open-account"
            className="inline-flex items-center gap-2 btn-shine bg-gradient-to-r from-secondary to-brand-green text-secondary-foreground font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.03] transition-[box-shadow,transform] ease-out duration-base"
          >
            Open Free Demat Account <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default InvestmentProducts;
