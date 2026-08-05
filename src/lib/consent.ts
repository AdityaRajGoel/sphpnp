/**
 * Cookie-consent persistence.
 *
 * Split out of the banner component for two reasons. It is the part with legal
 * weight - which value is written, and when - so it deserves tests that do not
 * depend on rendering. And every call has to survive a `localStorage` that
 * throws: Safari's private mode and several privacy extensions reject access
 * outright, and the previous implementation called it unguarded inside an
 * effect, so the whole banner (and anything mounted after it) broke for exactly
 * the users most likely to care about a cookie prompt.
 */

export const CONSENT_KEY = "panipat_cookie_consent";

/**
 * "all" is agreement to non-essential cookies. "essential" is a refusal of
 * them - the safe default, and where every path that is not an explicit accept
 * must land. There is deliberately no third "dismissed" state: under GDPR,
 * closing a banner is not consent, so a dismissal is recorded as the refusal it
 * legally is rather than as an absence that would re-prompt forever.
 */
export type ConsentChoice = "all" | "essential";

const CHOICES: readonly string[] = ["all", "essential"];

/**
 * The stored decision, or null when there is none.
 *
 * An unrecognised value is treated as no decision rather than as consent. A key
 * we did not write - stale from an older format, or hand-edited - must never be
 * able to opt somebody in by accident; re-asking is the recoverable direction.
 */
export function readConsent(): ConsentChoice | null {
  try {
    const stored = window.localStorage.getItem(CONSENT_KEY);
    return stored !== null && CHOICES.includes(stored) ? (stored as ConsentChoice) : null;
  } catch {
    // Storage unavailable. Returning null re-shows the banner, which is
    // harmless and honest; the alternative would be silently assuming consent.
    return null;
  }
}

/**
 * Persist a decision. Failure is swallowed on purpose: if storage is blocked we
 * cannot remember the answer, but we can still honour it for this page view, and
 * throwing here would take the banner's click handler down with it.
 */
export function writeConsent(choice: ConsentChoice): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    /* storage blocked - the choice still applies to this session */
  }
}
