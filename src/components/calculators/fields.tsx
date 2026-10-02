import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldMessage, fieldStateClass } from "@/components/ui/form-field";
import { segmentItem, segmentTrack } from "@/components/ui/segmented";

/** ₹ with Indian grouping, whole rupees. A negative sign is a real minus. */
export const inr = (n: number, digits = 0) =>
  `${n < 0 ? "−" : ""}₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
export const pct = (n: number, digits = 2) => `${n < 0 ? "−" : ""}${Math.abs(n).toFixed(digits)}%`;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * The typed value beside a slider, as on /sip-calculator: it keeps the raw
 * text while focused, so clearing it to type 25000 does not snap to the
 * minimum mid-word; any in-range value is used as it is typed, and leaving the
 * field clamps it to the slider's range.
 */
function ValueInput({ id, value, min, max, step, onChange }: { id: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={draft ?? value}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = parseFloat(e.target.value);
        if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
      }}
      onBlur={(e) => {
        const n = parseFloat(e.target.value);
        if (Number.isFinite(n)) onChange(clamp(n, min, max));
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className="w-full min-w-0 bg-transparent text-right font-semibold tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  );
}

type SliderFieldProps = {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
  /** What a screen reader hears for the slider, e.g. "₹5,000 a month". */
  valueText: (n: number) => string;
  prefix?: string;
  suffix?: string;
  minLabel: string;
  maxLabel: string;
  hint?: ReactNode;
};

/** A labelled slider with a typed value beside it. The label names the typed field; the slider has its own aria-label. */
export function SliderField({ id, label, value, min, max, step, onChange, valueText, prefix, suffix, minLabel, maxLabel, hint }: SliderFieldProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-foreground">{label}</label>
        <span className="flex w-36 shrink-0 items-center gap-1 rounded-md border bg-background px-2.5 py-1.5 text-sm focus-within:border-secondary focus-within:ring-1 focus-within:ring-secondary">
          {prefix && <span aria-hidden="true" className="text-muted-foreground">{prefix}</span>}
          <ValueInput id={id} value={value} min={min} max={max} step={step} onChange={onChange} />
          {suffix && <span aria-hidden="true" className="text-muted-foreground">{suffix}</span>}
        </span>
      </div>
      <input
        type="range"
        aria-label={label}
        aria-valuetext={valueText(value)}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer accent-secondary"
      />
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

type NumberFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  hint?: string;
  type?: "number" | "date";
  step?: string;
  min?: string;
};

/** A plain labelled input with the site's error line under it. Values stay strings so a half-typed field is never overwritten. */
export function NumberField({ id, label, value, onChange, error, hint, type = "number", step = "any", min = "0" }: NumberFieldProps) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1 block text-xs font-medium text-muted-foreground">{label}</Label>
      <Input
        id={id}
        type={type}
        inputMode={type === "number" ? "decimal" : undefined}
        step={type === "number" ? step : undefined}
        min={type === "number" ? min : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-message`}
        className={`tabular-nums ${type === "date" ? "dark:[color-scheme:dark]" : ""} ${fieldStateClass(error)}`}
      />
      <FieldMessage id={`${id}-message`} error={error} hint={hint} />
    </div>
  );
}

/** Parse a field; NaN when blank, so callers can tell "empty" from 0. */
export const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className={`${segmentTrack} max-w-full overflow-x-auto`}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)} className={segmentItem(value === o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** One labelled figure in a result panel. */
export function Figure({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-lg font-semibold tabular-nums text-foreground">{value}</dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

/** Label / value rows, for breakdowns. */
export function Rows({ rows }: { rows: { label: ReactNode; value: ReactNode; strong?: boolean }[] }) {
  return (
    <dl>
      {rows.map((r, i) => (
        <div key={i} className="flex items-baseline justify-between gap-4 border-b border-border/40 py-2.5 last:border-0">
          <dt className={`text-sm ${r.strong ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{r.label}</dt>
          <dd className={`text-right text-sm tabular-nums ${r.strong ? "font-semibold text-foreground" : "text-foreground"}`}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The main answer of a calculator: a label over one large figure, then any detail. */
export function Headline({ label, value, children }: { label: ReactNode; value: ReactNode; children?: ReactNode }) {
  return (
    <Card className="p-5 md:p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-3xl font-bold tabular-nums tracking-tight text-foreground md:text-4xl">{value}</p>
      {children && <div className="mt-4">{children}</div>}
    </Card>
  );
}

/** "2026-09-29" → "29 Sep 2026". */
export const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export const ASSUMED_RETURN_HINT ="Assumed return, not guaranteed. Markets can return less, or lose money.";
