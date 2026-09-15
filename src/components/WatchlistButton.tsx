import type { MouseEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Star } from "lucide-react";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { useWatchlist } from "@/hooks/useWatchlist";

const TAP = { whileTap: { scale: 0.85 }, transition: { duration: DURATION.press, ease: EASE_OUT } } as const;
const BURST = {
  initial: { scale: 0.4, opacity: 0.7 },
  animate: { scale: 1.9, opacity: 0 },
  exit: { opacity: 0 },
  transition: { duration: DURATION.slow, ease: EASE_OUT },
} as const;

type Props = { symbol: string; name: string; withLabel?: boolean; className?: string };

/** Star toggle for the watchlist. Safe inside clickable rows: it never lets the click bubble. */
export default function WatchlistButton({ symbol, name, withLabel = false, className = "" }: Props) {
  const { isInWatchlist, addToWatchlist, removeFromWatchlist, isFull } = useWatchlist();
  const on = isInWatchlist(symbol);
  const blocked = !on && isFull;

  const toggle = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (on) removeFromWatchlist(symbol);
    else addToWatchlist(symbol, name);
  };

  return (
    <motion.button
      type="button"
      {...TAP}
      onClick={toggle}
      disabled={blocked}
      aria-pressed={on}
      aria-label={blocked ? "Watchlist is full (50 stocks)" : on ? `Remove ${name} from watchlist` : `Add ${name} to watchlist`}
      title={blocked ? "Watchlist is full" : on ? "Remove from watchlist" : "Add to watchlist"}
      className={`relative inline-flex items-center gap-1.5 rounded-md text-muted-foreground transition-colors hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${withLabel ? "h-8 border border-border px-2.5 text-xs font-medium hover:border-amber-500/50" : "p-1.5"} ${on ? "text-amber-600" : ""} ${className}`}
    >
      <span className="relative grid place-items-center">
        <AnimatePresence>
          {on && <motion.span key="burst" {...BURST} className="absolute h-4 w-4 rounded-full bg-amber-400/60" aria-hidden="true" />}
        </AnimatePresence>
        <Star className={`relative h-4 w-4 transition-transform ${on ? "fill-amber-400" : ""}`} aria-hidden="true" />
      </span>
      {withLabel && <span>{on ? "Watching" : "Watch"}</span>}
    </motion.button>
  );
}
