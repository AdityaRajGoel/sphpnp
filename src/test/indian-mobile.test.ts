import { describe, it, expect } from "vitest";
import { normaliseIndianMobile } from "../../supabase/functions/_shared/indian-mobile";
import { validatePhone } from "@/lib/form-validation";

/*
 * The forms and submit-lead used to disagree: the browser accepted
 * "098765 43210" or "(98765) 43210", the server only stripped spaces and
 * hyphens and answered 400 "Invalid phone" - after the form had looked valid.
 * One normaliser now serves both, so they cannot drift again.
 */
describe("normaliseIndianMobile", () => {
  it.each([
    ["9876543210", "9876543210"],
    ["98765 43210", "9876543210"],
    ["98765-43210", "9876543210"],
    ["+91 98765 43210", "9876543210"],
    ["+91-98765-43210", "9876543210"],
    ["919876543210", "9876543210"],
    ["0091 98765 43210", "9876543210"],
    ["098765 43210", "9876543210"],
    ["(98765) 43210", "9876543210"],
  ])("accepts %s", (input, out) => {
    expect(normaliseIndianMobile(input)).toBe(out);
  });

  it.each(["5876543210", "987654321", "98765432100", "abcdefghij", "", "+1 202 555 0143"])("rejects %s", (input) => {
    expect(normaliseIndianMobile(input)).toBeNull();
  });

  it("agrees with the form's phone check on every case", () => {
    for (const v of ["98765 43210", "098765 43210", "(98765) 43210", "5876543210", "+91 98765 43210"]) {
      expect(validatePhone(v) === null).toBe(normaliseIndianMobile(v) !== null);
    }
  });
});
