import { describe, it, expect } from "vitest";
import { prerenderedHeight, rememberPrerenderedHeight } from "@/lib/prerender";

describe("prerendered height", () => {
  it("remembers the static content's height for this path only", () => {
    window.history.replaceState({}, "", "/stock/TCS");
    document.body.innerHTML = '<div data-stock-state="ready"></div>';
    Object.defineProperty(document.querySelector("[data-stock-state]")!, "offsetHeight", { value: 4200 });

    rememberPrerenderedHeight("[data-stock-state]");

    expect(prerenderedHeight("/stock/TCS")).toBe(4200);
    expect(prerenderedHeight("/stock/INFY")).toBeUndefined();
  });

  it("records nothing when the page has no static content", () => {
    window.history.replaceState({}, "", "/stock/NEW");
    document.body.innerHTML = "";
    rememberPrerenderedHeight("[data-stock-state]");
    expect(prerenderedHeight("/stock/NEW")).toBeUndefined();
  });
});
