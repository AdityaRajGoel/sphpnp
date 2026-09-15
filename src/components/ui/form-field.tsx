import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { passwordStrength } from "@/lib/form-validation";

// The outgoing line leaves instantly, so an error is never held back behind a
// fading hint - feedback has to arrive the moment the field is judged.
const MESSAGE = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, transition: { duration: 0 } },
  transition: { duration: DURATION.fast, ease: EASE_OUT },
} as const;

/**
 * The line under a field: an error when there is one, otherwise an optional
 * hint. Always rendered, so `aria-describedby` never points at nothing, and
 * polite so a screen reader hears the error once the field is left.
 */
export function FieldMessage({ id, error, hint }: { id: string; error?: string | null; hint?: string }) {
  return (
    <div id={id} aria-live="polite" className="min-h-[1.25rem] pt-1 text-xs">
      <AnimatePresence mode="wait" initial={false}>
        {error ? (
          <motion.p key="error" {...MESSAGE} className="flex items-center gap-1.5 font-medium text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {error}
          </motion.p>
        ) : hint ? (
          <motion.p key="hint" {...MESSAGE} className="text-muted-foreground">{hint}</motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

const BAR_TONE = ["bg-destructive", "bg-destructive", "bg-brand-orange", "bg-secondary", "bg-secondary"];

/** Four-segment strength meter; segments fill as the password gets harder to guess. */
export function PasswordMeter({ value }: { value: string }) {
  if (!value) return null;
  const { score, label } = passwordStrength(value);
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <motion.span
              className={`block h-full w-full origin-left ${BAR_TONE[score]}`}
              initial={false}
              animate={{ scaleX: score >= i ? 1 : 0 }}
              transition={{ duration: DURATION.base, ease: EASE_OUT }}
            />
          </span>
        ))}
      </div>
      <p className={`mt-1 flex items-center gap-1 text-xs ${score >= 3 ? "text-secondary" : "text-muted-foreground"}`}>
        {score >= 3 && <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
        Password strength: <span className="font-medium">{label}</span>
      </p>
    </div>
  );
}

/** Classes that tint an input by its state. */
export const fieldStateClass = (error?: string | null, valid?: boolean) =>
  error ? "border-destructive/70 focus-visible:ring-destructive/40" : valid ? "border-secondary/50" : "";
