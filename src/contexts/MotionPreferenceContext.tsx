import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useReducedMotion as useSystemReducedMotion } from "motion/react";
import {
  applyMotionPreference,
  readMotionPreference,
  writeMotionPreference,
  resolveReducedMotion,
  type MotionPreference,
} from "@/lib/motion-preference";

/**
 * Shares the motion preference so the control that changes it and the
 * `MotionConfig` that acts on it stay in step.
 *
 * Deliberately thin: it holds the choice, not the resolved boolean. Components
 * keep calling Motion's own `useReducedMotion()`, which reads `MotionConfig` —
 * so the override reaches all of them without eleven separate edits.
 */

type MotionPreferenceValue = {
  preference: MotionPreference;
  setPreference: (preference: MotionPreference) => void;
};

const MotionPreferenceContext = createContext<MotionPreferenceValue | null>(null);

export const MotionPreferenceProvider = ({ children }: { children: ReactNode }) => {
  // Read lazily: this runs during render, and `readMotionPreference` is guarded
  // for environments where storage throws.
  const [preference, setPreferenceState] = useState<MotionPreference>(() => {
    const stored = readMotionPreference();
    // Prerendered HTML ships without the attribute, so re-apply on hydration.
    applyMotionPreference(stored);
    return stored;
  });

  const setPreference = useCallback((next: MotionPreference) => {
    writeMotionPreference(next);
    setPreferenceState(next);
  }, []);

  const value = useMemo(() => ({ preference, setPreference }), [preference, setPreference]);

  return (
    <MotionPreferenceContext.Provider value={value}>{children}</MotionPreferenceContext.Provider>
  );
};

export const useMotionPreference = (): MotionPreferenceValue => {
  const context = useContext(MotionPreferenceContext);
  if (!context) {
    throw new Error("useMotionPreference must be used within a MotionPreferenceProvider");
  }
  return context;
};

/**
 * The resolved answer to "should this animate?" — use this everywhere instead
 * of Motion's `useReducedMotion()`.
 *
 * Motion's own hook reads the media query directly; it does *not* consult
 * `MotionConfig`. Setting `MotionConfig reducedMotion` still governs how Motion
 * applies its own animations, but a component that branches on the hook would
 * keep following the OS and ignore an explicit override — which is precisely
 * the bug this preference exists to fix.
 */
export const usePrefersReducedMotion = (): boolean => {
  // Falls back to the OS preference rather than throwing when no provider is
  // present. The override is an enhancement layered on a working default, so a
  // component rendered outside the provider — in isolation in a unit test, or
  // in some future partial tree — should still animate correctly rather than
  // crash. `useMotionPreference` below still throws, because writing a
  // preference genuinely requires somewhere to put it.
  const context = useContext(MotionPreferenceContext);
  const systemPrefersReduced = Boolean(useSystemReducedMotion());
  return resolveReducedMotion(context?.preference ?? "auto", systemPrefersReduced);
};
