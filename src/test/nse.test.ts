import { describe, it, expect } from "vitest";
import { toIsoDate } from "../../supabase/functions/_shared/nse";

describe("toIsoDate", () => {
  it("converts an NSE date to ISO", () => {
    expect(toIsoDate("01-Oct-2024")).toBe("2024-10-01");
  });

  it("handles a date with a trailing time", () => {
    expect(toIsoDate("16-Jan-2025 20:20")).toBe("2025-01-16");
  });

  it("returns null for an unparseable value", () => {
    expect(toIsoDate("")).toBeNull();
    expect(toIsoDate("not a date")).toBeNull();
  });
});
