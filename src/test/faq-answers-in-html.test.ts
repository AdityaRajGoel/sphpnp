import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/*
 * FAQ answers have to be IN the HTML, not only after a click.
 *
 * Radix keeps a collapsed AccordionContent unmounted, so the prerendered page
 * carried every question and not one answer (checked live on /stock/RELIANCE,
 * 2026-09-21). Search engines may render JavaScript, but the answer engines
 * this markup is aimed at read the HTML they are served - and FAQPage markup
 * describing text that is not on the page is the kind of thing that gets
 * structured data ignored.
 *
 * forceMount keeps the answer mounted; Radix still hides it until expanded.
 */
describe("the FAQ accordion", () => {
  it("keeps its answers mounted while collapsed", () => {
    const src = readFileSync("src/components/ui/accordion.tsx", "utf-8");
    expect(src).toContain("forceMount");
    // Mounted but not shown: the closed state must still be hidden.
    expect(src).toMatch(/data-\[state=closed\]:hidden/);
  });
});
