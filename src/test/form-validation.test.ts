import { describe, it, expect } from "vitest";
import {
  normaliseIndianMobile, passwordStrength, validateAll, validateEmail, validateMatch, validateName, validateNewPassword, validatePhone,
} from "@/lib/form-validation";

describe("validateName", () => {
  it("accepts Indian names with initials and apostrophes, rejects markup and digits", () => {
    expect(validateName("R. K. D'Souza")).toBeNull();
    expect(validateName("अदिति शर्मा")).toBeNull();
    expect(validateName("A")).toMatch(/at least 2/);
    expect(validateName("<script>")).toMatch(/letters/);
    expect(validateName("Agent 007")).toMatch(/letters/);
  });
});

describe("phone", () => {
  it("normalises the common ways people type a mobile number", () => {
    for (const v of ["9876543210", "+91 98765 43210", "098765-43210", "91 9876543210", "(+91) 98765 43210"]) {
      expect(normaliseIndianMobile(v)).toBe("9876543210");
    }
  });

  it("explains what is wrong", () => {
    expect(validatePhone("")).toMatch(/Enter your mobile/);
    expect(validatePhone("5876543210")).toMatch(/starting with 6, 7, 8 or 9/);
    expect(validatePhone("98765abc10")).toMatch(/digits only/);
    expect(validatePhone("+91 98765 43210")).toBeNull();
  });
});

describe("email", () => {
  it("is optional only when asked", () => {
    expect(validateEmail({ optional: true })("")).toBeNull();
    expect(validateEmail()("")).toMatch(/Enter your email/);
    expect(validateEmail()("name@site")).toMatch(/name@example.com/);
    expect(validateEmail()("name@site.in")).toBeNull();
  });
});

describe("passwords", () => {
  it("scores length and variety, and marks common passwords weak", () => {
    expect(passwordStrength("abc").label).toBe("Too short");
    expect(passwordStrength("password123!").score).toBe(1);
    expect(passwordStrength("lowercaseonly").score).toBe(1);
    expect(passwordStrength("Mixed1234").score).toBe(2);
    expect(passwordStrength("Longer-Pass-Phrase-9").label).toBe("Strong");
  });

  it("requires a guessable-proof password and a matching confirmation", () => {
    expect(validateNewPassword("short")).toMatch(/at least 8/);
    expect(validateNewPassword("aaaaaaaa")).toMatch(/Too easy/);
    expect(validateNewPassword("Panipat2026")).toBeNull();
    expect(validateMatch("Panipat2026")("Panipat2025")).toMatch(/do not match/);
  });

  it("collects only failing fields", () => {
    expect(validateAll({ name: "Ravi", phone: "12" }, { name: validateName, phone: validatePhone })).toEqual({
      phone: expect.stringMatching(/10-digit/),
    });
  });
});
