import { motion, useScroll, useSpring } from "motion/react";
import { usePrefersReducedMotion } from "@/contexts/MotionPreferenceContext";

const ScrollProgress = () => {
  const shouldReduceMotion = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  if (shouldReduceMotion) return null;

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-secondary via-brand-gold to-secondary origin-left z-[100]"
      style={{ scaleX }}
    />
  );
};

export default ScrollProgress;
