import { describe, it, expect } from "vitest";
import {
  DURATION,
  REVEAL_Y,
  STAGGER,
  revealItem,
  revealItemX,
  revealFade,
  revealBar,
  revealPop,
} from "@/lib/motion";

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

  it("reveals horizontally from either side", () => {
    expect(revealItemX("left").initial.x).toBeLessThan(0);
    expect(revealItemX("right").initial.x).toBeGreaterThan(0);
    expect(revealItemX("left").whileInView.x).toBe(0);
  });

  it("fades without movement when there is nothing to move", () => {
    expect(revealFade.initial).toEqual({ opacity: 0 });
    expect(revealFade.whileInView).toEqual({ opacity: 1 });
  });

  /**
   * The decorative rules under section headings used to animate `width` from 0,
   * which forces layout on every frame while scrolling. scaleX is visually the
   * same on a solid bar and stays on the compositor.
   */
  it("grows decorative rules on scaleX, never width", () => {
    expect(revealBar.initial).not.toHaveProperty("width");
    expect(revealBar.whileInView).not.toHaveProperty("width");
    expect(revealBar.initial.scaleX).toBe(0);
    expect(revealBar.whileInView.scaleX).toBe(1);
    // Centre, not left: these rules are all mx-auto, and the width animation
    // they replace opened symmetrically from the middle.
    expect(revealBar.style.transformOrigin).toBe("center");
  });

  /**
   * Cards and badges that arrive by growing slightly rather than lifting.
   * Scale never starts below 0.9: a smaller start reads as a bounce, which
   * is a different and much louder gesture than a reveal.
   */
  it("pops in from a restrained scale, never from zero", () => {
    expect(revealPop(0).initial.scale).toBeGreaterThanOrEqual(0.9);
    expect(revealPop(0).initial.scale).toBeLessThan(1);
    expect(revealPop(0).whileInView.scale).toBe(1);
    expect(revealPop(0).initial.opacity).toBe(0);
  });

  it("staggers pops on the same cadence as other item reveals", () => {
    expect(revealPop(3).transition.delay).toBeCloseTo(3 * STAGGER);
  });
});
