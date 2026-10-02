import { describe, it, expect } from "vitest";
import { checkTradeField, pnlTone } from "@/pages/BrokerageCalculatorPage";

describe("checkTradeField", () => {
  it("rejects blank, zero and negative prices, accepts any positive price", () => {
    expect(checkTradeField("", "price")).toMatch(/above 0/);
    expect(checkTradeField("0", "price")).toMatch(/more than 0/);
    expect(checkTradeField("-5", "price")).toMatch(/more than 0/);
    expect(checkTradeField("0.05", "price")).toBeNull();
  });

  it("wants a whole count of 1 or more, within the upper bound", () => {
    expect(checkTradeField("", "count")).toMatch(/1 or more/);
    expect(checkTradeField("0", "count")).toMatch(/1 or more/);
    expect(checkTradeField("-10", "count")).toMatch(/1 or more/);
    expect(checkTradeField("2.5", "count")).toMatch(/Whole/);
    expect(checkTradeField("1e8", "count")).toMatch(/or less/);
    expect(checkTradeField("100", "count")).toBeNull();
  });
});

describe("pnlTone", () => {
  it("is neutral for invalid input whatever the arithmetic says", () => {
    expect(pnlTone(151920, false)).toBe("invalid");
    expect(pnlTone(0, false)).toBe("invalid");
  });

  it("calls zero, and anything that shows as ₹0.00, break-even", () => {
    expect(pnlTone(0, true)).toBe("flat");
    expect(pnlTone(0.004, true)).toBe("flat");
    expect(pnlTone(-0.004, true)).toBe("flat");
    expect(pnlTone(0.01, true)).toBe("profit");
    expect(pnlTone(-0.01, true)).toBe("loss");
  });
});
