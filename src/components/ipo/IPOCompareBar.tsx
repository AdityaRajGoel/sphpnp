import { motion, AnimatePresence } from "motion/react";
import { Scale, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrefersReducedMotion } from "@/contexts/MotionPreferenceContext";
import { MAX_COMPARE } from "@/lib/ipo-filters";

type Props = {
  count: number;
  onCompare: () => void;
  onClear: () => void;
};

/** Sticky action bar that appears once a visitor has picked at least one IPO to compare. */
export default function IPOCompareBar({ count, onCompare, onClear }: Props) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4"
        >
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-xl">
            <Scale className="w-4 h-4 text-secondary shrink-0" />
            <span className="text-sm font-semibold">{count} of {MAX_COMPARE} selected</span>
            <Button size="sm" onClick={onCompare} disabled={count < 2}>Compare</Button>
            <Button size="sm" variant="ghost" onClick={onClear} aria-label="Clear comparison selection"><X className="w-4 h-4" /></Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
