import { ArrowRight, TrendingUp, TrendingDown, Sparkles, Award, Lock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring, useReducedMotion } from "motion/react";
import { useEffect, useState, useRef, useMemo, memo } from "react";
import { useLiveMarket } from "@/hooks/useLiveMarket";
import { Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useT } from "@/i18n/LanguageContext";
import platformImg from "@/assets/parasram-india.webp";
import { useCountUp } from "@/hooks/useCountUp";
import { EASE_OUT } from "@/lib/motion";

const TIP_INTERVAL_MS = 6000;

type MarketTile = { label: string; price?: string; change?: string; up: boolean };

const StatCounter = memo(({ target, label, suffix = "", delay = 0 }: { target: number; label: string; suffix?: string; delay?: number }) => {
  const [started, setStarted] = useState(delay === 0);
  useEffect(() => {
    if (delay === 0) return;
    const t = setTimeout(() => setStarted(true), delay * 1000);
    return () => clearTimeout(t);
  }, [delay]);
  const count = useCountUp(target, 2, started);
  return (
    <motion.div
      className="text-center"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: EASE_OUT }}
    >
      <div className="text-2xl md:text-4xl font-bold text-primary-foreground tabular-nums">
        {count.toLocaleString("en-IN")}{suffix}
      </div>
      <div className="text-[10px] md:text-xs text-primary-foreground/60 uppercase tracking-wide mt-1">{label}</div>
    </motion.div>
  );
});
StatCounter.displayName = "StatCounter";

/*
 * Every live number in the hero, in one panel.
 *
 * This used to be three separate widgets competing inside the same viewport:
 * an index card strip, a market-breadth bar, and a second floating set of
 * index cards on the right that repeated two of the same instruments. Merging
 * them loses no data - NIFTY, SENSEX, BANKNIFTY, GOLD, breadth and market
 * status are all still here - but it gives the fold one place to look for
 * market state instead of three.
 */
const LiveMarketPanel = memo(({ tiles, loading, tip, reduceMotion }: {
  tiles: MarketTile[];
  loading: boolean;
  tip: string;
  reduceMotion: boolean;
}) => {
  const { marketOverview, marketOpen, marketStatusText } = useLiveMarket();
  const advances = marketOverview?.advances ?? 0;
  const declines = marketOverview?.declines ?? 0;
  const unchanged = marketOverview?.unchanged ?? 0;
  const total = advances + declines + unchanged;
  const advPct = total ? (advances / total) * 100 : 0;
  const decPct = total ? (declines / total) * 100 : 0;

  return (
    <motion.div
      className="rounded-surface border border-white/15 bg-black/25 backdrop-blur-md p-3 md:p-4 shadow-xl"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45, duration: 0.6, ease: EASE_OUT }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[10px] md:text-xs font-semibold uppercase tracking-wide text-primary-foreground/70">
          Live Market
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-pill ${marketOpen ? "bg-secondary animate-pulse" : "bg-destructive/60"}`} />
          <span className="text-[9px] md:text-[10px] font-medium text-primary-foreground/50">{marketStatusText}</span>
        </span>
      </div>

      {/* Instruments. Scrolls horizontally where there isn't room to grid. */}
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="flex min-w-0 items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2"
          >
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${tile.up ? "bg-secondary/20" : "bg-destructive/20"}`}>
              {tile.up
                ? <TrendingUp className="h-3.5 w-3.5 text-secondary" />
                : <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[9px] md:text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/60">
                {tile.label}
              </div>
              {/* Skeleton boxes are sized to the exact line-heights of the
                  values they stand in for, so swapping in real numbers does
                  not resize the tile. */}
              {loading ? (
                <>
                  <div className="h-4 w-16 rounded bg-white/20 animate-pulse md:h-5" />
                  <div className="h-4 w-10 rounded bg-white/15 animate-pulse" />
                </>
              ) : (
                <>
                  <div className="truncate text-xs font-bold leading-4 tabular-nums text-primary-foreground md:text-sm md:leading-5">{tile.price}</div>
                  <div className={`text-[10px] font-bold leading-4 tabular-nums md:text-xs ${tile.up ? "text-secondary" : "text-destructive"}`}>
                    {tile.change}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Breadth. Rendered unconditionally, empty or not: gating this on
          `total > 0` meant the panel grew the moment market data arrived,
          which resized the hero section and shifted everything below it.
          Reserving the space costs nothing and keeps CLS flat. */}
      <div className="mt-3 flex flex-col gap-1.5">
        <div className="flex h-1.5 w-full overflow-hidden rounded-pill bg-white/10">
          <div className="bg-secondary transition-[width] duration-slow ease-out" style={{ width: `${advPct}%` }} />
          <div className="bg-primary-foreground/25 transition-[width] duration-slow ease-out" style={{ width: `${total ? 100 - advPct - decPct : 100}%` }} />
          <div className="bg-destructive transition-[width] duration-slow ease-out" style={{ width: `${decPct}%` }} />
        </div>
        <div className="flex items-center justify-between text-[10px] md:text-xs tabular-nums">
          <span className="font-bold text-secondary">{advances} Advances</span>
          <span className="font-medium text-primary-foreground/50">{unchanged} Unchanged</span>
          <span className="font-bold text-destructive">{declines} Declines</span>
        </div>
      </div>

      {/* Rotating tip. Crossfaded through a slight blur so the eye reads one
          line changing rather than two lines briefly overlapping. */}
      <div className="mt-3 flex items-start gap-2 border-t border-white/10 pt-2.5">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand-gold" />
        <div className="relative min-h-[2.4em] flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={tip}
              className="block text-[11px] md:text-xs leading-snug text-primary-foreground/85"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(3px)" }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(3px)" }}
              transition={{ duration: 0.28, ease: EASE_OUT }}
            >
              {tip}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
});
LiveMarketPanel.displayName = "LiveMarketPanel";

const Hero = () => {
  const isMobile = useIsMobile();
  const prefersReducedMotion = useReducedMotion();
  const { indices: liveIndices, commodities, marketOverview, loading: marketLoading } = useLiveMarket();
  const { t } = useT();

  const niftyData = liveIndices.find((idx) => idx.key === "NIFTY");
  const goldData = commodities.find((c) => c.name === "GOLD");

  // One ordered set of instruments for the panel: the three indices that were
  // in the left strip, plus the gold quote that only existed in the floating
  // cards. Nothing that was on screen before has been dropped.
  const marketTiles = useMemo<MarketTile[]>(() => {
    const wanted = ["NIFTY", "SENSEX", "BANKNIFTY"];
    const indexTiles = wanted
      .map((key) => liveIndices.find((idx) => idx.key === key))
      .filter((idx): idx is NonNullable<typeof idx> => Boolean(idx))
      .map((idx) => ({ label: idx.name, price: idx.price, change: idx.change, up: idx.up }));

    return goldData
      ? [...indexTiles, { label: "GOLD", price: goldData.price, change: goldData.change, up: goldData.up }]
      : indexTiles;
  }, [liveIndices, goldData]);

  const dynamicTips = useMemo(() => {
    const tips = [
      "Diversify your portfolio across sectors.",
      "Never invest money you can't afford to lose.",
      "Research before you invest.",
    ];
    if (niftyData?.up) tips.unshift(`NIFTY 50 is up ${niftyData.change} - markets looking bullish today.`);
    else if (niftyData) tips.unshift(`NIFTY 50 is down ${niftyData.change} - consider buying the dip wisely.`);
    if (goldData?.up) tips.push(`Gold is up ${goldData.change} - a safe haven in volatile markets.`);
    if (marketOverview) {
      const { advances = 0, declines = 0 } = marketOverview;
      if (advances > declines) tips.push(`${advances} advances vs ${declines} declines - broad market strength.`);
      else if (declines > advances) tips.push(`${declines} declines vs ${advances} advances - stay cautious.`);
    }
    return tips;
  }, [niftyData, goldData, marketOverview]);

  const trustBadges = useMemo(() => [
    { icon: Award, label: "SEBI Registered" },
    { icon: Lock, label: "Secure Trading" },
    { icon: Star, label: "5-Star Rated" },
  ], []);

  const [tipIndex, setTipIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTipIndex((i) => (i + 1) % dynamicTips.length), TIP_INTERVAL_MS);
    return () => clearInterval(id);
  }, [dynamicTips.length]);

  // Mouse-tracking parallax for the platform image. Motion values are written
  // outside the React render cycle, so this never re-renders the hero.
  const sectionRef = useRef<HTMLElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 60, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 60, damping: 20 });
  const imgX = useTransform(springX, [-1, 1], [-18, 18]);
  const imgY = useTransform(springY, [-1, 1], [-12, 12]);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (prefersReducedMotion) return;
    const rect = sectionRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(((e.clientX - rect.left) / rect.width - 0.5) * 2);
    mouseY.set(((e.clientY - rect.top) / rect.height - 0.5) * 2);
  };

  const marketPanel = (
    <LiveMarketPanel
      tiles={marketTiles}
      loading={marketLoading}
      tip={dynamicTips[tipIndex % dynamicTips.length]}
      reduceMotion={Boolean(prefersReducedMotion)}
    />
  );

  return (
    <section
      ref={sectionRef}
      onMouseMove={handleMouseMove}
      className="relative flex min-h-[calc(100svh-var(--site-chrome))] items-center overflow-hidden"
    >
      {/* Video background */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{ willChange: "transform", transform: "translate3d(0,0,0)", backfaceVisibility: "hidden" }}
      >
        {/* LCP: discoverable poster image with high fetch priority */}
        <picture>
          <source srcSet="/hero-bg.webp" type="image/webp" />
          <img
            src="/hero-bg.jpg"
            alt="Parasram India - Stock Trading Platform and Investment Background"
            aria-hidden="true"
            fetchPriority="high"
            loading="eager"
            width={2940}
            height={1678}
            className="absolute inset-0 w-full h-full object-cover object-center"
            style={{ transform: "translate3d(0,0,0)", backfaceVisibility: "hidden" }}
          />
        </picture>
        {!prefersReducedMotion && (
          <video
            src="/video.mp4"
            poster="/hero-bg.jpg"
            autoPlay
            loop
            muted
            playsInline
            preload="none"
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover object-center"
            style={{ transform: "translate3d(0,0,0)", backfaceVisibility: "hidden" }}
          />
        )}
        {/* Brand overlay - keeps text legible */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-navy/72 via-brand-navy/58 to-brand-green/40" />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, hsl(213 80% 12% / 0.72) 0%, hsl(213 80% 22% / 0.68) 50%, hsl(145 70% 25% / 0.65) 100%)`,
          }}
        />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />
        {/* Aurora mesh - slow drifting brand glows for depth */}
        {!prefersReducedMotion && (
          <div className="hero-aurora absolute inset-0 mix-blend-screen opacity-70" aria-hidden="true" />
        )}
      </div>

      <div className="container relative z-10 mx-auto flex w-full items-center px-4 py-6 md:py-10 lg:py-12">
        <div className="w-full md:w-[56%] lg:w-[54%]">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: EASE_OUT }}>
            {/* 1. Credentials */}
            <motion.div
              className="mb-4 flex flex-wrap gap-2 md:mb-5 md:gap-2.5"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.5, ease: EASE_OUT }}
            >
              {trustBadges.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-white/20 bg-white/10 px-2.5 py-1 backdrop-blur-sm md:px-3 md:py-1.5"
                >
                  <Icon className="h-3 w-3 text-secondary md:h-3.5 md:w-3.5" />
                  <span className="text-[11px] font-semibold text-primary-foreground md:text-xs">{label}</span>
                </span>
              ))}
            </motion.div>

            {/* 2. Headline. Two lines by construction; min-height reserves that
                   space so a language switch can't shift the fold.

                   The size ladder is derived from the column width, not chosen
                   for impact: each line is ~21 characters, so the type has to
                   stay under roughly columnWidth / 12.6 or the second line
                   wraps and the headline silently becomes three or four lines.
                   The dip at md is deliberate - that is where the column stops
                   being full-width and drops to 56%. */}
            <motion.h1
              className="mb-4 min-h-[2.3em] font-heading text-[1.625rem] font-bold leading-[1.12] text-primary-foreground [text-wrap:balance] sm:text-[2rem] md:mb-6 md:text-[1.875rem] lg:text-[2.5rem] xl:text-[3rem] 2xl:text-[3.5rem]"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.6, ease: EASE_OUT }}
            >
              {t("hero.title1")}
              <br />
              <span className="text-shimmer block bg-gradient-to-r from-secondary via-brand-gold to-secondary bg-clip-text pb-1 text-transparent">
                {t("hero.title2")}
              </span>
            </motion.h1>

            {/* 3. Value prop */}
            <motion.p
              className="mb-5 max-w-xl text-sm leading-relaxed text-primary-foreground/80 md:mb-8 md:text-lg"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6, ease: EASE_OUT }}
            >
              {t("hero.subtitle")}
            </motion.p>

            {/* 4. Action */}
            <motion.div
              className="mb-5 flex flex-col gap-3 sm:flex-row md:mb-8 md:gap-4"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.6, ease: EASE_OUT }}
            >
              <Button
                asChild
                size="lg"
                className="btn-shine w-full border-2 border-transparent bg-gradient-to-r from-secondary to-brand-green px-6 py-4 text-sm font-bold text-secondary-foreground shadow-xl shadow-secondary/30 hover:from-secondary/90 hover:to-brand-green/90 sm:w-auto md:px-10 md:py-6 md:text-lg"
              >
                <Link to="/open-account">
                  {t("hero.ctaInvest")}
                  <ArrowRight className="ml-2 h-4 w-4 md:h-5 md:w-5" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="w-full border-2 border-secondary/60 bg-secondary/20 px-6 py-4 text-sm font-bold text-primary-foreground backdrop-blur-sm hover:bg-secondary/40 hover:text-primary-foreground sm:w-auto md:px-10 md:py-6 md:text-lg"
              >
                <a href="https://webtrade.parasramindia.com/#!/app" target="_blank" rel="noopener noreferrer">
                  {t("hero.ctaTrade")}
                </a>
              </Button>
            </motion.div>

            {/* Market panel sits in the text column at every size: the right
                column is the product shot's, undivided. */}
            <div className="mb-5 max-w-xl md:mb-6">{marketPanel}</div>

            {/* 5. Proof */}
            <div className="grid grid-cols-3 gap-4 border-t border-primary-foreground/20 pt-5 md:gap-6 md:pt-8">
              <StatCounter target={50} suffix="+" label="Years Legacy" delay={0.55} />
              <StatCounter target={10} suffix="L+" label="Happy Clients" delay={0.65} />
              <motion.div
                className="text-center"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.75, duration: 0.5, ease: EASE_OUT }}
              >
                <div className="text-2xl font-bold text-primary-foreground md:text-4xl">SEBI</div>
                <div className="mt-1 text-[10px] uppercase tracking-wide text-primary-foreground/60 md:text-xs">Registered</div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right column: the product, at its original prominence. The live
          market panel lives in the left column instead, so the image gets the
          full half back rather than sharing it. */}
      {!isMobile && (
        <motion.div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-[45%] flex-col items-center justify-center md:flex lg:w-1/2 px-6 2xl:px-12"
          initial={{ opacity: 0, x: 48 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: EASE_OUT }}
        >
          {/* Glow halo */}
          <div
            className="pointer-events-none absolute h-[50%] w-[50%] rounded-pill blur-3xl"
            style={{
              background: "radial-gradient(circle, hsl(145 70% 40% / 0.3) 0%, hsl(213 80% 40% / 0.15) 60%, transparent 100%)",
              animation: prefersReducedMotion ? undefined : "pulse-glow 4s ease-in-out infinite",
            }}
          />

          <motion.img
            src={platformImg}
            alt="Parasram India Platform"
            width={896}
            height={560}
            fetchPriority="high"
            className="relative z-10 w-full object-contain drop-shadow-2xl 2xl:max-w-4xl"
            style={prefersReducedMotion ? { maxHeight: "75%" } : { maxHeight: "75%", x: imgX, y: imgY }}
          />
        </motion.div>
      )}
    </section>
  );
};

export default memo(Hero);
