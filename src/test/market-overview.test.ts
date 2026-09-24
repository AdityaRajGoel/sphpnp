import { describe, it, expect } from "vitest";
import { emptyTabMessage } from "@/lib/market-overview";

describe("emptyTabMessage", () => {
  it("reports an outage only when the feed never loaded", () => {
    expect(emptyTabMessage("gainers", false, 0)).toMatch(/temporarily unavailable/);
  });

  it("says an empty gainers list is a fact about the day, not an outage", () => {
    expect(emptyTabMessage("gainers", true, 20)).toBe("None of the 20 tracked stocks is up today.");
    expect(emptyTabMessage("losers", true, 20)).toBe("None of the 20 tracked stocks is down today.");
  });

  it("stays grammatical when the tracked count is unknown", () => {
    expect(emptyTabMessage("gainers", true, 0)).toBe("No tracked stock is up today.");
  });

  it("keeps the corporate-actions wording whatever the feed state", () => {
    expect(emptyTabMessage("calendar", false, 0)).toMatch(/corporate actions/);
  });
});
