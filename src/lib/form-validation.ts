/**
 * Field validation shared by every form, so the same input is judged the same
 * way on the account form, sign-in and password reset. Each check returns a
 * message written for the person filling the form, or null when the value is
 * fine. Messages say what to fix, not only that something is wrong.
 */

export type FieldCheck = (value: string) => string | null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const required = (label: string): FieldCheck => (v) => (v.trim() ? null : `Enter your ${label.toLowerCase()}`);

export const validateName: FieldCheck = (v) => {
  const s = v.trim();
  if (!s) return "Enter your name";
  if (s.length < 2) return "Name must be at least 2 letters";
  if (s.length > 100) return "Name must be 100 characters or fewer";
  if (!/^[\p{L}][\p{L}\p{M} .'-]*$/u.test(s)) return "Use letters, spaces, dots, hyphens or apostrophes only";
  return null;
};

/** Indian mobile: 10 digits starting 6-9, with or without +91 / 0 and spaces or dashes. */
export function normaliseIndianMobile(v: string): string | null {
  const digits = v.replace(/[\s()-]/g, "").replace(/^(\+91|0091|91(?=\d{10}$)|0(?=\d{10}$))/, "");
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export const validatePhone: FieldCheck = (v) => {
  if (!v.trim()) return "Enter your mobile number";
  if (/[^\d\s()+-]/.test(v)) return "Use digits only, for example 98765 43210";
  return normaliseIndianMobile(v) ? null : "Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9";
};

export const validateEmail = (opts: { optional?: boolean } = {}): FieldCheck => (v) => {
  const s = v.trim();
  if (!s) return opts.optional ? null : "Enter your email address";
  if (s.length > 255) return "Email must be 255 characters or fewer";
  return EMAIL.test(s) ? null : "Enter an email like name@example.com";
};

export const PASSWORD_MIN = 8;

export type PasswordStrength = { score: 0 | 1 | 2 | 3 | 4; label: "Too short" | "Weak" | "Fair" | "Good" | "Strong" };

export function passwordStrength(v: string): PasswordStrength {
  if (v.length < PASSWORD_MIN) return { score: 0, label: "Too short" };
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(v)).length;
  const lengthBonus = v.length >= 14 ? 1 : 0;
  const common = /^(password|12345678|qwerty|letmein|welcome|admin)/i.test(v);
  const score = common ? 1 : (Math.min(4, Math.max(1, variety - 1 + lengthBonus)) as 1 | 2 | 3 | 4);
  return { score, label: (["Too short", "Weak", "Fair", "Good", "Strong"] as const)[score] };
}

export const validateNewPassword: FieldCheck = (v) => {
  if (!v) return "Enter a password";
  if (v.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters`;
  if (passwordStrength(v).score < 2) return "Too easy to guess - mix upper and lower case, numbers or symbols";
  return null;
};

export const validateMatch = (other: string): FieldCheck => (v) => (v && v === other ? null : "Passwords do not match");

/** Run checks over a record of values; returns only the fields with errors. */
export function validateAll<K extends string>(values: Record<K, string>, checks: Partial<Record<K, FieldCheck>>): Partial<Record<K, string>> {
  const errors: Partial<Record<K, string>> = {};
  for (const key of Object.keys(checks) as K[]) {
    const message = checks[key]?.(values[key] ?? "");
    if (message) errors[key] = message;
  }
  return errors;
}
