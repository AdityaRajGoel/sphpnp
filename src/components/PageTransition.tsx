import { motion, type Variants } from "motion/react";
import { ReactNode } from "react";
import { EASE_OUT } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/contexts/MotionPreferenceContext";

// Route transition: a short cross-fade and nothing else. App.tsx wraps routes in
// AnimatePresence mode="wait", so the exit runs fully before the next page
// enters - which is why both halves are kept brief: every millisecond here is
// a millisecond before the page someone asked for appears. There used to be a
// full-viewport green-to-gold wipe on top; it read as a landing-page trick and
// added ~0.5s to every navigation.

interface PageTransitionProps {
  children: ReactNode;
}

/*
 * The element tree is identical in both motion modes; only the variants differ.
 * Flipping between two different tree shapes remounted the whole page (lazy
 * sections re-suspended, state lost, reveals replayed) once the in-app motion
 * toggle made the preference something a user changes mid-session. Guarded by
 * e2e/reduced-motion.spec.ts.
 */
export const PageTransition = ({ children }: PageTransitionProps) => {
  const prefersReducedMotion = usePrefersReducedMotion();

  const contentVariants: Variants = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        in: { opacity: 1, transition: { duration: 0.12 } },
        out: { opacity: 0, transition: { duration: 0.08 } },
      }
    : {
        initial: { opacity: 0, y: 4 },
        in: { opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE_OUT } },
        out: { opacity: 0, transition: { duration: 0.1, ease: EASE_OUT } },
      };

  return (
    <motion.div initial="initial" animate="in" exit="out">
      <motion.div variants={contentVariants}>{children}</motion.div>
    </motion.div>
  );
};

export default PageTransition;
