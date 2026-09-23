import type { KeyboardEvent } from "react";

/**
 * Keyboard access for an element that is clickable but is not a button or link
 * (a card, a table row): focusable, and Enter or Space activate it, as a button
 * would. Rows pass { role: null } to keep their table semantics. Keys pressed on
 * a real control inside (a link in the row) are left to that control.
 */
export function pressable(onActivate: () => void, opts: { role?: "button" | null; label?: string } = {}) {
  return {
    tabIndex: 0,
    role: opts.role === null ? undefined : (opts.role ?? "button"),
    "aria-label": opts.label,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate();
      }
    },
  };
}
