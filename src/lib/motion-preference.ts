/**
 * User-facing motion preference, layered on top of the OS one.
 *
 * `prefers-reduced-motion` is the right default, but it is not always the
 * user's choice. GNOME's "Reduce Animation" toggle and GTK's
 * `enable-animations=false` — the default in several distros and in most VMs
 * and remote desktops — make Chrome and Firefox report `reduce`, so a large
 * group of Linux visitors were being served a completely static site they never
 * asked for. The reverse case exists too: someone on a machine that reports no
 * preference may still want motion gone.
 *
 * So the OS decides by default, and an explicit choice always wins.
 */

export type MotionPreference = "auto" | "on" | "off";

const STORAGE_KEY = "motion-preference";
const ATTRIBUTE = "data-motion";

const isMotionPreference = (value: unknown): value is MotionPreference =>
  value === "auto" || value === "on" || value === "off";

/**
 * Storage access throws outright in some contexts (Safari private browsing,
 * browsers set to block site data), so every read and write is guarded and
 * falls back to following the OS.
 */
export const readMotionPreference = (): MotionPreference => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isMotionPreference(stored) ? stored : "auto";
  } catch {
    return "auto";
  }
};

/**
 * Mirrors the preference onto <html> so CSS can gate on it. `auto` removes the
 * attribute entirely rather than writing a value, which keeps the stylesheet's
 * default branch a plain media query.
 */
export const applyMotionPreference = (preference: MotionPreference): void => {
  const root = document.documentElement;
  if (preference === "auto") {
    root.removeAttribute(ATTRIBUTE);
    return;
  }
  root.setAttribute(ATTRIBUTE, preference);
};

export const writeMotionPreference = (preference: MotionPreference): void => {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Preference is still applied for this session; it just won't persist.
  }
  applyMotionPreference(preference);
};

/** Reads the OS preference directly, for the initial paint before React runs. */
export const systemPrefersReducedMotion = (): boolean => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

/** An explicit choice wins; `auto` defers to the OS. */
export const resolveReducedMotion = (
  preference: MotionPreference,
  systemPrefersReduced: boolean,
): boolean => {
  if (preference === "on") return false;
  if (preference === "off") return true;
  return systemPrefersReduced;
};

/**
 * Motion's own vocabulary, for `MotionConfig`. This covers Motion's declarative
 * animations only — its `useReducedMotion()` hook reads the media query and
 * ignores `MotionConfig`, so components branching on the preference must use
 * `usePrefersReducedMotion()` instead.
 */
export const toMotionConfigValue = (
  preference: MotionPreference,
): "user" | "always" | "never" => {
  if (preference === "on") return "never";
  if (preference === "off") return "always";
  return "user";
};
