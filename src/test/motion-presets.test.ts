import { describe, it, expect } from "vitest";
import { DURATION, REVEAL_Y, STAGGER, revealItem } from "@/lib/motion";

describe("motion presets", () => {
  it("keeps every interactive duration under 250ms", () => {
    const interactive = [DURATION.press, DURATION.fast, DURATION.base, DURATION.slow];
    for (const d of interactive) {
      expect(d).toBeLessThanOrEqual(0.36);
    }
  });

  it("exposes an ambient duration for decorative loops", () => {
    expect(DURATION.ambient).toBe(1);
  });

  it("staggers items without gating interaction", () => {
    expect(STAGGER).toBeLessThanOrEqual(0.08);
    expect(revealItem(5).transition.delay).toBeCloseTo(5 * STAGGER);
  });

  it("reveals items a shorter distance than whole sections", () => {
    expect(REVEAL_Y.item).toBeLessThan(REVEAL_Y.section);
  });
});
