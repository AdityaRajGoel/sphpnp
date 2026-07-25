import { motion, useReducedMotion } from "motion/react";
import { ReactNode } from "react";
import { EASE_OUT } from "@/lib/motion";

// Route transition: content fade/lift plus a brand-colored wipe that sweeps
// across the viewport between pages (App.tsx wraps routes in AnimatePresence
// mode="wait", so exit runs fully before the next page enters).

interface PageTransitionProps {
  children: ReactNode;
}

export const PageTransition = ({ children }: PageTransitionProps) => {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div initial="initial" animate="in" exit="out">
      {/* Page content */}
      <motion.div
        variants={{
          initial: { opacity: 0, y: 12 },
          in: { opacity: 1, y: 0, transition: { duration: 0.25, ease: EASE_OUT, delay: 0.08 } },
          out: { opacity: 0, y: -8, transition: { duration: 0.15, ease: EASE_OUT } },
        }}
      >
        {children}
      </motion.div>

      {/* Brand wipe - sweeps in on exit, sweeps away on enter */}
      <motion.div
        className="fixed inset-0 z-[70] pointer-events-none bg-gradient-to-r from-secondary via-brand-green to-brand-gold"
        variants={{
          initial: { scaleX: 1, transformOrigin: "right" },
          in: { scaleX: 0, transformOrigin: "right", transition: { duration: 0.3, ease: [0.76, 0, 0.24, 1] } },
          out: { scaleX: 1, transformOrigin: "left", transition: { duration: 0.22, ease: [0.76, 0, 0.24, 1] } },
        }}
        aria-hidden="true"
      />
    </motion.div>
  );
};

export default PageTransition;
