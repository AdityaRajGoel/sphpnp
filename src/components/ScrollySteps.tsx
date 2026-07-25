import { motion, AnimatePresence, useScroll, useMotionValueEvent, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { EASE_OUT } from "@/lib/motion";

// Scrollytelling steps: on desktop a sticky visual panel morphs as the user
// scrolls through the steps beside it; on mobile it degrades to stacked cards.
// The scene accent picks the per-step flourish animation.
export type ScrollyStep = {
  num: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  accent?: "pulse" | "check" | "chart" | "sparkle";
};

// Per-step flourish drawn behind/around the icon
const SceneAccent = ({ accent }: { accent: ScrollyStep["accent"] }) => {
  if (accent === "check") {
    return (
      <svg viewBox="0 0 48 48" className="absolute -bottom-2 -right-2 w-12 h-12" aria-hidden="true">
        <motion.circle cx="24" cy="24" r="20" fill="hsl(var(--secondary))" opacity="0.15" />
        <motion.path
          d="M14 24 L21 31 L34 17"
          stroke="hsl(var(--secondary))"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6, delay: 0.35, ease: EASE_OUT }}
        />
      </svg>
    );
  }
  if (accent === "chart") {
    return (
      <svg viewBox="0 0 80 44" className="absolute -bottom-3 -right-4 w-20 h-11" aria-hidden="true">
        {[10, 24, 38, 52, 66].map((x, i) => (
          <motion.rect
            key={x}
            x={x}
            width="8"
            rx="2"
            fill={i % 2 ? "hsl(var(--brand-gold))" : "hsl(var(--secondary))"}
            initial={{ y: 44, height: 0 }}
            animate={{ y: 44 - (14 + i * 6), height: 14 + i * 6 }}
            transition={{ duration: 0.45, delay: 0.3 + i * 0.08, ease: EASE_OUT }}
          />
        ))}
      </svg>
    );
  }
  if (accent === "sparkle") {
    return (
      <>
        {[
          { top: "-6%", right: "8%", size: 10, delay: 0.3 },
          { top: "18%", right: "-8%", size: 7, delay: 0.5 },
          { bottom: "4%", left: "-6%", size: 8, delay: 0.7 },
        ].map((s, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full bg-brand-gold"
            style={{ ...s, width: s.size, height: s.size }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.3, 1], opacity: [0, 1, 0.7] }}
            transition={{ duration: 0.6, delay: s.delay }}
            aria-hidden="true"
          />
        ))}
      </>
    );
  }
  // default: sonar pulse rings
  return (
    <>
      {[0, 1].map((i) => (
        <motion.span
          key={i}
          className="absolute inset-0 rounded-3xl border-2 border-secondary/40"
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.45, opacity: 0 }}
          transition={{ duration: 1.8, delay: i * 0.9, repeat: Infinity, ease: EASE_OUT }}
          aria-hidden="true"
        />
      ))}
    </>
  );
};

const StepScene = ({ step, index, total }: { step: ScrollyStep; index: number; total: number }) => {
  const Icon = step.icon;
  return (
    <motion.div
      key={step.num}
      className="relative flex flex-col items-center text-center"
      initial={{ opacity: 0, y: 24, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -24, scale: 0.94 }}
      transition={{ type: "spring", stiffness: 210, damping: 24 }}
    >
      <div className="relative mb-6">
        <div className="relative w-32 h-32 rounded-3xl bg-gradient-to-br from-secondary/15 to-brand-gold/10 border border-secondary/25 flex items-center justify-center shadow-xl shadow-secondary/10">
          <Icon className="w-14 h-14 text-secondary" />
          <SceneAccent accent={step.accent} />
        </div>
      </div>
      <span className="text-xs font-bold text-secondary bg-secondary/10 px-3 py-1 rounded-full mb-3">
        Step {step.num} of {String(total).padStart(2, "0")}
      </span>
      <h3 className="font-heading text-xl font-bold text-foreground mb-2 max-w-xs">{step.title}</h3>
      <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">{step.desc}</p>
      {/* progress dots */}
      <div className="flex gap-2 mt-6" aria-hidden="true">
        {Array.from({ length: total }).map((_, i) => (
          <motion.span
            key={i}
            className="h-1.5 rounded-full bg-secondary"
            animate={{ width: i === index ? 24 : 6, opacity: i === index ? 1 : 0.25 }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>
    </motion.div>
  );
};

const ScrollySteps = ({ steps }: { steps: ScrollyStep[] }) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: listRef,
    offset: ["start 0.55", "end 0.55"],
  });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const idx = Math.min(steps.length - 1, Math.max(0, Math.floor(v * steps.length)));
    setActive(idx);
  });

  return (
    <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 max-w-5xl mx-auto">
      {/* Sticky morphing scene - desktop only */}
      <div className="hidden lg:block">
        <div className="sticky top-32 min-h-[440px] flex items-center justify-center rounded-3xl bg-muted/30 border border-border/40 p-8 overflow-hidden">
          {/* faint grid backdrop */}
          <div
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--border) / 0.35) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.35) 1px, transparent 1px)",
              backgroundSize: "36px 36px",
              maskImage: "radial-gradient(70% 70% at 50% 50%, black, transparent)",
            }}
            aria-hidden="true"
          />
          <AnimatePresence mode="wait">
            <StepScene key={active} step={steps[active]} index={active} total={steps.length} />
          </AnimatePresence>
        </div>
      </div>

      {/* Steps column */}
      <div ref={listRef} className="space-y-6 lg:space-y-20 lg:py-10">
        {steps.map((step, i) => {
          const isActive = i === active;
          return (
            <motion.div
              key={step.num}
              className="flex items-start gap-5 group"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            >
              <motion.div
                className="w-14 h-14 rounded-2xl bg-card border-2 flex items-center justify-center flex-shrink-0 shadow-md relative z-10 transition-colors duration-base"
                animate={
                  prefersReducedMotion
                    ? undefined
                    : { scale: isActive ? 1.08 : 1, borderColor: isActive ? "hsl(var(--secondary))" : "hsl(var(--secondary) / 0.25)" }
                }
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
              >
                <step.icon className="w-6 h-6 text-secondary" />
              </motion.div>
              <motion.div
                className="bg-card border border-border/50 rounded-xl p-5 flex-1 shadow-sm transition-shadow duration-base"
                animate={prefersReducedMotion ? undefined : { opacity: active >= 0 && !isActive ? 0.55 : 1, y: isActive ? -2 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className="text-xs font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">
                    Step {step.num}
                  </span>
                  <h3 className="font-heading text-lg font-bold text-foreground">{step.title}</h3>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default ScrollySteps;
