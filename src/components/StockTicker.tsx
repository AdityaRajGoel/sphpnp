import { TrendingUp, TrendingDown, Clock } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { useLiveMarket, LiveStock } from "@/hooks/useLiveMarket";
import { useIsMobile } from "@/hooks/use-mobile";

interface TickerRowProps {
  items: LiveStock[];
  direction?: "left" | "right";
  bgClass?: string;
  textClass?: string;
}

import Marquee from "react-fast-marquee";

const PriceCell = ({ item }: { item: LiveStock }) => {
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prevPrice = useRef(item.price);

  useEffect(() => {
    if (prevPrice.current !== item.price) {
      const prevNum = parseFloat(prevPrice.current.replace(/[,₹]/g, ''));
      const newNum = parseFloat(item.price.replace(/[,₹]/g, ''));
      if (!isNaN(prevNum) && !isNaN(newNum) && prevNum !== newNum) {
        setFlash(newNum > prevNum ? "up" : "down");
        const timer = setTimeout(() => setFlash(null), 1200);
        prevPrice.current = item.price;
        return () => clearTimeout(timer);
      }
      prevPrice.current = item.price;
    }
  }, [item.price]);

  return (
    <span
      className={`font-tabular-nums ${
        flash === "up" ? "text-brand-gold font-bold" :
        flash === "down" ? "text-brand-orange font-bold" : "text-white/80 font-semibold"
      }`}
    >
      {item.price}
    </span>
  );
};

const TickerRow = ({ items, direction = "left", bgClass = "bg-brand-charcoal", textClass = "text-primary-foreground" }: TickerRowProps) => {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={`${bgClass} ${textClass} py-1 md:py-1.5 overflow-hidden whitespace-nowrap relative border-b border-black/5 dark:border-white/5`}>
      {/* Edge fade masks */}
      <div className="absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none bg-gradient-to-r from-[#1a1f2e] dark:from-[hsl(220,20%,10%)] to-transparent" />
      <div className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none bg-gradient-to-l from-[#1a1f2e] dark:from-[hsl(220,20%,10%)] to-transparent" />

      <Marquee
        speed={100}
        gradient={false}
        pauseOnHover={true}
        direction={direction}
        play={!prefersReducedMotion}
        className="flex items-center"
      >
        {items.map((item, i) => (
          <button
            key={i}
            type="button"
            aria-label={`${item.name} ${item.price}, view in stock screener`}
            className="relative inline-flex items-center gap-1 md:gap-1.5 text-xs md:text-sm cursor-pointer select-none px-1 md:px-1.5 py-2.5 -my-2 rounded-md hover:bg-white/10 transition-colors group"
            onClick={() => navigate("/screener")}
          >
            <span className={`font-bold tracking-wide transition-colors ${item.up ? "text-[#00c853] dark:text-[#00e676]" : "text-[#d50000] dark:text-[#ff1744]"}`}>{item.name}</span>
            {item.unit ? <span className="opacity-50 text-[10px] md:text-xs">{item.unit}</span> : null}
            <PriceCell item={item} />
            <span className={`flex items-center gap-0.5 font-bold text-[11px] md:text-xs px-1.5 py-0.5 rounded-full ${item.up ? "bg-brand-gold/15 text-brand-gold" : "bg-brand-orange/15 text-brand-orange"}`}>
              {item.up ? <TrendingUp className="w-2.5 h-2.5 md:w-3 md:h-3" /> : <TrendingDown className="w-2.5 h-2.5 md:w-3 md:h-3" />}
              {item.change}
            </span>
            <span className="text-white/20 text-sm mx-0.5">·</span>
          </button>
        ))}
      </Marquee>
    </div>
  );
};

const formatTradingDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const useCountdown = (targetISO: string | null) => {
  const [remaining, setRemaining] = useState("");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!targetISO) { setRemaining(""); return; }
    
    const update = () => {
      const diff = new Date(targetISO).getTime() - Date.now();
      if (diff <= 0) { setRemaining(""); return; }
      
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      
      if (hours > 0) {
        setRemaining(`${hours}h ${mins}m ${secs}s`);
      } else if (mins > 0) {
        setRemaining(`${mins}m ${secs}s`);
      } else {
        setRemaining(`${secs}s`);
      }
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [targetISO]);

  return isMounted ? remaining : "";
};

const CountdownTimer = ({ fetchedAt, marketOpen }: { fetchedAt: string | null, marketOpen: boolean }) => {
  const [countdown, setCountdown] = useState(60);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!fetchedAt) return;
    const fetchTime = new Date(fetchedAt).getTime();
    const interval = marketOpen ? 60 : 300;
    
    const timer = setInterval(() => {
      if (document.hidden) return; // Skip updates when tab is hidden
      const elapsed = Math.floor((Date.now() - fetchTime) / 1000);
      const remaining = Math.max(0, interval - elapsed);
      setCountdown(remaining);
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchedAt, marketOpen]);

  if (!isMounted || !marketOpen) return null;

  return (
    <span className="text-[9px] text-primary-foreground/40 font-medium">
      {countdown > 0 ? `↻ ${countdown}s` : "Updating..."}
    </span>
  );
};

// Shimmer strip shown while live prices are being fetched (avoids flashing stale/fake numbers)
const TickerSkeleton = ({ rows = 2 }: { rows?: number }) => {
  const pills = Array.from({ length: 8 });
  return (
    <div aria-live="polite" aria-busy="true" className="flex h-full flex-col bg-[#1a1f2e] dark:bg-brand-charcoal text-white">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className={`flex flex-1 items-center gap-4 md:gap-6 px-4 overflow-hidden ${r > 0 ? "border-t border-white/5" : ""}`}>
          <span className="text-[10px] text-white/40 font-medium shrink-0 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse" /> Loading live prices…
          </span>
          {pills.map((_, i) => (
            <div key={i} className="inline-flex items-center gap-1.5 shrink-0">
              <div className="h-3 w-12 rounded bg-white/15 animate-pulse" />
              <div className="h-3 w-10 rounded bg-white/10 animate-pulse" />
              <div className="h-3 w-8 rounded-full bg-white/10 animate-pulse" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

const StockTicker = () => {
  const isMobile = useIsMobile();
  const { stocks, commodities, fetchedAt, marketOpen, marketStatusText, lastTradingDate, nextMarketOpen, marketClose, loading } = useLiveMarket();
  const nextOpenCountdown = useCountdown(nextMarketOpen);
  const closeCountdown = useCountdown(marketClose);

  // Fixed height: the skeleton used to be shorter than the loaded rows, so every
  // page on the site dropped by 13-23px the moment live prices arrived. Both
  // states now fill the same box.
  return (
    <div className="border-b border-[#1a1f2e]/20 dark:border-brand-orange/20 bg-[#1a1f2e] dark:bg-brand-charcoal relative h-9 md:h-[78px] overflow-hidden">
      {loading ? (
        <TickerSkeleton rows={isMobile ? 1 : 2} />
      ) : (
        <>
          <TickerRow items={stocks} direction="left" bgClass="bg-[#1a1f2e] dark:bg-brand-charcoal" textClass="text-white" />
          {!isMobile && (
            <>
              <div className="h-px bg-white/5 dark:bg-brand-orange/15" />
              <TickerRow items={commodities} direction="right" bgClass="bg-[#1a1f2e] dark:bg-brand-charcoal/95" textClass="text-white" />
            </>
          )}
        </>
      )}

      {/* Market status bar — solid fade background so scrolling prices don't show
          through. Full height on mobile because there is only one ticker row
          there and it is taller than this bar: at a fixed h-6 the prices scrolled
          out from under the badge and collided with it. Desktop keeps the short
          bar so it masks only the first of the two rows. The fade runway also
          has to be wide enough that the gradient is fully opaque before the
          badge starts, or text reads through underneath it. */}
      <div className="absolute top-0 right-0 h-full md:h-7 flex items-center gap-2 z-20 pl-14 pr-2 bg-gradient-to-l from-[#1a1f2e] from-60% via-[#1a1f2e] to-transparent dark:from-brand-charcoal dark:via-brand-charcoal">
        {/* Status badge */}
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${
          marketOpen 
            ? "bg-secondary/20 border border-secondary/30" 
            : marketStatusText === "Pre-Market"
              ? "bg-brand-orange/20 border border-brand-orange/30"
              : marketStatusText === "After Hours"
                ? "bg-purple-500/20 border border-purple-500/30"
                : "bg-destructive/15 border border-destructive/20"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            marketOpen ? "bg-secondary animate-pulse" 
            : marketStatusText === "Pre-Market" ? "bg-brand-orange animate-pulse"
            : marketStatusText === "After Hours" ? "bg-purple-400 animate-pulse"
            : "bg-destructive/60"
          }`} />
          <span className={`text-[9px] font-semibold ${
            marketOpen ? "text-secondary" 
            : marketStatusText === "Pre-Market" ? "text-brand-orange"
            : marketStatusText === "After Hours" ? "text-purple-300"
            : "text-[#ff8a8a]"
          }`}>
            {marketStatusText}
          </span>
        </div>

        {/* Countdown / date info */}
        {marketOpen && closeCountdown && (
          <span className="text-[8px] text-primary-foreground/50 font-medium flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            Closes in {closeCountdown}
          </span>
        )}
        {!marketOpen && nextOpenCountdown && (
          <span className="text-[8px] text-primary-foreground/50 font-medium flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            Opens in {nextOpenCountdown}
          </span>
        )}
        {!marketOpen && lastTradingDate && !nextOpenCountdown && (
          <span className="text-[8px] text-primary-foreground/40 font-medium">
            Closing: {formatTradingDate(lastTradingDate)}
          </span>
        )}
        {marketOpen && (
          <CountdownTimer fetchedAt={fetchedAt} marketOpen={marketOpen} />
        )}
      </div>
    </div>
  );
};

export default StockTicker;
