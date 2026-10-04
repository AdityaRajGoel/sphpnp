/**
 * The one definition of an acceptable Indian mobile number, shared by the
 * site's forms (src/lib/form-validation.ts) and submit-lead, so the browser
 * never accepts a number the server then refuses. Returns the bare 10 digits.
 */
export function normaliseIndianMobile(v: string): string | null {
  const digits = v.replace(/[\s()-]/g, "").replace(/^(\+91|0091|91(?=\d{10}$)|0(?=\d{10}$))/, "");
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}
