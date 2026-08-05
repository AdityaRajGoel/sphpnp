import { useCallback, useEffect, useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Link } from "react-router-dom";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DURATION, EASE_DRAWER, REVEAL_Y } from "@/lib/motion";
import { readConsent, writeConsent, type ConsentChoice } from "@/lib/consent";

/**
 * Cookie consent prompt.
 *
 * Two decisions here are not stylistic and should survive future tidying.
 *
 * The two choices carry equal visual weight. Making refusal harder than
 * acceptance - smaller, greyer, buried behind a link - is the consent dark
 * pattern regulators name explicitly, so "Essential Only" gets the same size,
 * the same row and the same prominence as "Accept All". Only the fill differs,
 * to mark which is the affirmative action rather than which is preferred.
 *
 * There is no separate close control. The previous version had one that mapped
 * to the refusal handler, which meant three affordances for two outcomes, and it
 * was positioned `absolute` with no positioned ancestor so it actually rendered
 * against the viewport strip and collided with the heading. Dismissal IS the
 * refusal, so it is spelled with the word rather than an ambiguous glyph -
 * and Escape does the same thing for the keyboard.
 */
const CookieConsent = () => {
  const [isVisible, setIsVisible] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    // readConsent swallows a throwing localStorage, so this cannot take the
    // banner - or anything mounted after it - down in Safari private mode.
    if (readConsent() === null) setIsVisible(true);
  }, []);

  const decide = useCallback((choice: ConsentChoice) => {
    writeConsent(choice);
    setIsVisible(false);
  }, []);

  // Escape resolves to the refusal, never to acceptance: dismissing a consent
  // prompt is legally not agreement, so the quiet exit must be the safe one.
  useEffect(() => {
    if (!isVisible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") decide("essential");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isVisible, decide]);

  // Reduced motion still animates - it just stops travelling. An element that
  // appears with no transition at all is more jarring than a short fade, and the
  // guidance is reduced motion, not removed feedback.
  const transition = prefersReducedMotion
    ? { duration: DURATION.fast, ease: EASE_DRAWER }
    : { duration: DURATION.base, ease: EASE_DRAWER };
  const hidden = prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, y: REVEAL_Y.section };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          role="dialog"
          // Not aria-modal: focus is deliberately not trapped. The page behind
          // stays usable and a half-built trap that fails to restore focus is
          // worse for keyboard users than none.
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          initial={hidden}
          animate={{ opacity: 1, y: 0 }}
          exit={hidden}
          transition={transition}
          // Only transform and opacity animate, so this stays on the compositor.
          className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none"
        >
          <div
            className="
              pointer-events-auto w-full max-w-3xl
              rounded-2xl border border-border/80 bg-card
              shadow-[0_8px_32px_-12px_hsl(var(--brand-navy)/0.28)]
              p-5 sm:p-6
              flex flex-col gap-5 md:flex-row md:items-center md:gap-8
            "
          >
            {/* Tight group: the icon belongs to the text, so it sits close. */}
            <div className="flex items-start gap-3.5 md:gap-4">
              <span
                aria-hidden="true"
                className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary/10 text-secondary"
              >
                <Cookie className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="text-[0.9375rem] font-semibold leading-snug tracking-[-0.01em] text-foreground"
                >
                  We value your privacy
                </h2>
                <p
                  id={descriptionId}
                  className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground"
                >
                  Essential cookies keep the site working. With your consent we also use
                  non-essential cookies to understand how the site is used and improve it.
                  Read our{" "}
                  <Link
                    to="/cookie-policy"
                    className="font-medium text-secondary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    Cookie Policy
                  </Link>
                  .
                </p>
              </div>
            </div>

            {/*
              Generous separation from the text, and equal-width actions so
              neither choice is easier to reach than the other. On a 320px screen
              they stack full-width rather than shrinking their labels.
            */}
            <div className="flex flex-col gap-2.5 sm:flex-row md:ml-auto md:shrink-0">
              <Button
                variant="outline"
                onClick={() => decide("essential")}
                className="w-full sm:w-auto sm:min-w-[8.5rem] font-medium transition-colors"
              >
                Essential Only
              </Button>
              <Button
                onClick={() => decide("all")}
                className="w-full sm:w-auto sm:min-w-[8.5rem] bg-brand-navy font-medium text-white shadow-sm transition-colors hover:bg-brand-navy/90"
              >
                Accept All
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CookieConsent;
