import { motion, type Variants } from "motion/react";
import { ReactNode } from "react";
import { EASE_OUT } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/contexts/MotionPreferenceContext";

// Route transition: content fade/lift plus a brand-colored wipe that sweeps
// across the viewport between pages (App.tsx wraps routes in AnimatePresence
// mode="wait", so exit runs fully before the next page enters).

interface PageTransitionProps {
  children: ReactNode;
}

/*
 * The element tree is identical in both motion modes; only the variants differ.
 *
 * This used to return one shape when reduced motion was on and a deeper,
 * three-element shape when it was off. React matches children by position and
 * type, so flipping the preference changed the tree under `children` and
 * remounted the entire page: lazy sections re-suspended, state was lost and
 * every reveal replayed. Harmless while the value came only from the OS and was
 * fixed for the session; the in-app motion toggle made it something a user
 * does, and it read as the site hanging. Guarded by e2e/reduced-motion.spec.ts.
 *
 * So the structure is constant and reduced motion is expressed as a quieter set
 * of variants: content fades without travelling, and the wipe stays collapsed
 * rather than sweeping across the viewport.
 */
export const PageTransition = ({ children }: PageTransitionProps) => {
  const prefersReducedMotion = usePrefersReducedMotion();

  const contentVariants: Variants = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        in: { opacity: 1, transition: { duration: 0.15 } },
        out: { opacity: 0, transition: { duration: 0.1 } },
      }
    : {
        initial: { opacity: 0, y: 12 },
        in: { opacity: 1, y: 0, transition: { duration: 0.25, ease: EASE_OUT, delay: 0.08 } },
        out: { opacity: 0, y: -8, transition: { duration: 0.15, ease: EASE_OUT } },
      };

  // Collapsed in every state under reduced motion: a full-viewport colour sweep
  // between routes is exactly the large-scale motion the preference exists to
  // stop, so it is neutralised rather than merely shortened.
  const wipeVariants: Variants = prefersReducedMotion
    ? {
        initial: { scaleX: 0, transformOrigin: "right" },
        in: { scaleX: 0, transformOrigin: "right", transition: { duration: 0 } },
        out: { scaleX: 0, transformOrigin: "left", transition: { duration: 0 } },
      }
    : {
        initial: { scaleX: 1, transformOrigin: "right" },
        in: { scaleX: 0, transformOrigin: "right", transition: { duration: 0.3, ease: [0.76, 0, 0.24, 1] } },
        out: { scaleX: 1, transformOrigin: "left", transition: { duration: 0.22, ease: [0.76, 0, 0.24, 1] } },
      };

  return (
    <motion.div initial="initial" animate="in" exit="out">
      {/* Page content */}
      <motion.div variants={contentVariants}>{children}</motion.div>

      {/* Brand wipe - sweeps in on exit, sweeps away on enter */}
      <motion.div
        className="fixed inset-0 z-[70] pointer-events-none bg-gradient-to-r from-secondary via-brand-green to-brand-gold"
        variants={wipeVariants}
        aria-hidden="true"
      />
    </motion.div>
  );
};

export default PageTransition;
