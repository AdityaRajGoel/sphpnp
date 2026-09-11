import { describe, it, expect } from "vitest";
import { heatColor, heatTextColor } from "@/components/StockHeatmap";

describe("heatColor", () => {
  it("is grey for a flat stock, matching the legend", () => {
    expect(heatColor(0)).toBe("hsl(var(--muted))");
    expect(heatColor(-0.05)).toBe("hsl(var(--muted))");
  });

  it("colours the same move up and down with the same strength", () => {
    for (const p of [0.5, 1.5, 2.5, 5]) {
      expect(heatColor(p).replace("--secondary", "X")).toBe(heatColor(-p).replace("--destructive", "X"));
    }
    expect(heatColor(0.5)).toContain("--secondary");
    expect(heatColor(-0.5)).toContain("--destructive");
  });

  it("keeps white text on strong fills in both themes", () => {
    expect(heatTextColor(2)).toBe("#ffffff");
    expect(heatTextColor(-2)).toBe("#ffffff");
    expect(heatTextColor(0.2)).toBe("hsl(var(--foreground))");
  });
});
