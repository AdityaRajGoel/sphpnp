import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { EASE_OUT } from "@/lib/motion";

/*
 * Ripple press feedback, ported from Animate UI (MIT) and adapted to this
 * project. Five things had to change:
 *
 * 1. Animate UI targets Tailwind v4, where `var(--primary-foreground)` is a
 *    finished colour. Our v3 tokens hold raw HSL triplets, so the same
 *    expression yields "0 0% 100%" and paints nothing. Colours here go through
 *    hsl(var(--token) / alpha).
 * 2. Their primitive uses the React 19 ref-as-prop form. We are on React 18, so
 *    this forwards a ref the old way.
 * 3. Their version adds `whileHover: scale(1.05)`. Buttons are pressed dozens of
 *    times a session and hover-grow reads as noise (and fires on touch taps), so
 *    it is deliberately absent; the shared Button already owns press feedback
 *    via `active:scale-[0.97]`.
 * 4. Ripple ids came from `Date.now()`, which collides when two clicks land in
 *    the same millisecond and makes React drop one. A counter is used instead.
 * 5. Reduced motion suppresses the ripple entirely.
 *
 * Reach for this on high-intent, low-frequency actions - account opening, form
 * submits - not on every button on the page.
 */

const RIPPLE_MS = 600;

const rippleTint = cva("", {
  variants: {
    variant: {
      default: "[--ripple-tint:var(--primary-foreground)]",
      destructive: "[--ripple-tint:var(--destructive-foreground)]",
      outline: "[--ripple-tint:var(--foreground)]",
      secondary: "[--ripple-tint:var(--secondary-foreground)]",
      ghost: "[--ripple-tint:var(--foreground)]",
      link: "[--ripple-tint:var(--primary)]",
    },
  },
  defaultVariants: { variant: "default" },
});

type Ripple = { id: number; x: number; y: number };

/**
 * Note there is no `asChild`. The ripple needs to inject a sibling layer, and
 * Radix's Slot accepts exactly one child, so the two cannot coexist. Link-style
 * CTAs should keep the standard `<Button asChild>` and stay real anchors; this
 * is for genuine `<button>` actions such as form submits.
 */
export interface RippleButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const RippleButton = React.forwardRef<HTMLButtonElement, RippleButtonProps>(
  ({ className, variant, size, onClick, children, ...props }, forwardedRef) => {
    const [ripples, setRipples] = React.useState<Ripple[]>([]);
    const nextId = React.useRef(0);
    const innerRef = React.useRef<HTMLButtonElement>(null);
    const prefersReducedMotion = useReducedMotion();

    React.useImperativeHandle(forwardedRef, () => innerRef.current as HTMLButtonElement);

    // Timers are tracked so a component unmounted mid-ripple does not try to
    // set state afterwards.
    const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
    React.useEffect(() => () => timers.current.forEach(clearTimeout), []);

    const handleClick = React.useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        if (!prefersReducedMotion) {
          const rect = innerRef.current?.getBoundingClientRect();
          if (rect) {
            const id = nextId.current++;
            setRipples((prev) => [...prev, { id, x: event.clientX - rect.left, y: event.clientY - rect.top }]);
            timers.current.push(
              setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), RIPPLE_MS),
            );
          }
        }
        onClick?.(event);
      },
      [onClick, prefersReducedMotion],
    );

    return (
      <button
        ref={innerRef}
        onClick={handleClick}
        className={cn(
          buttonVariants({ variant, size }),
          rippleTint({ variant }),
          "relative overflow-hidden",
          className,
        )}
        {...props}
      >
        {children}
        {/* Absolutely positioned, so it sits outside the button's flex flow and
            the label/icon spacing is untouched. It washes over the label rather
            than under it, which is how Material-style ripples read anyway; the
            low alpha keeps text legible throughout. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <AnimatePresence>
            {ripples.map((r) => (
              <motion.span
                key={r.id}
                className="absolute block rounded-pill"
                style={{
                  left: r.x,
                  top: r.y,
                  // hsl(...) with an alpha channel, because v3 tokens are triplets.
                  background: "hsl(var(--ripple-tint) / 0.3)",
                }}
                initial={{ width: 0, height: 0, x: "-50%", y: "-50%", opacity: 0.6 }}
                animate={{ width: 420, height: 420, x: "-50%", y: "-50%", opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: RIPPLE_MS / 1000, ease: EASE_OUT }}
              />
            ))}
          </AnimatePresence>
        </span>
      </button>
    );
  },
);
RippleButton.displayName = "RippleButton";

export { RippleButton };
