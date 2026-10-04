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

  it("uses the fill's own ink on the strongest step and page text below it", () => {
    expect(heatTextColor(3.5)).toBe("hsl(var(--secondary-foreground))");
    expect(heatTextColor(-3.5)).toBe("hsl(var(--destructive-foreground))");
    // White on the light-theme 45-70% tints measured 2.0-3.8:1; page text clears 4:1.
    for (const p of [0.2, 1.5, -2.5]) expect(heatTextColor(p)).toBe("hsl(var(--foreground))");
  });
});
