/**
 * Microsoft Clarity, loaded only with consent.
 *
 * It used to be an inline snippet in index.html, so it ran - and set its _clck /
 * _clsk cookies - for every visitor, including those who picked "Essential only" in
 * the cookie banner. Now it loads when the stored choice is "all", or the moment a
 * visitor accepts; withdrawing consent later tells Clarity to stop and clear its
 * cookies (clarity("consent", false)).
 */
import { CONSENT_CHANGE_EVENT, readConsent, type ConsentChoice } from "@/lib/consent";

const CLARITY_PROJECT_ID = "xf23f493om";

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[][] };
declare global {
  interface Window {
    clarity?: ClarityFn;
  }
}

const TAG_SELECTOR = 'script[src^="https://www.clarity.ms/tag/"]';
// The DOM, not a module flag, says whether it is loaded: installing twice (or a hot
// reload) must never add a second copy.
const isLoaded = () => document.querySelector(TAG_SELECTOR) !== null;

function loadClarity(): void {
  if (isLoaded()) return;
  const queue: ClarityFn = (...args: unknown[]) => {
    (queue.q = queue.q || []).push(args);
  };
  window.clarity = window.clarity || queue;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;
  document.head.appendChild(script);
}

function apply(choice: ConsentChoice | null): void {
  if (choice === "all") {
    loadClarity();
    window.clarity?.("consent");
  } else if (choice === "essential" && isLoaded()) {
    window.clarity?.("consent", false);
  }
}

export function installAnalyticsConsent(): void {
  apply(readConsent());
  window.addEventListener(CONSENT_CHANGE_EVENT, (event) => {
    apply((event as CustomEvent<ConsentChoice>).detail);
  });
}
