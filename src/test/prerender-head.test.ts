import { describe, it, expect } from "vitest";
import { assertHeadCaptured, expectedCanonical } from "../../scripts/lib/prerender-html.mjs";

const GENERIC = "Best Stock Broker in Panipat | Shri Parasram Holdings Panipat";

function page(title: string, canonical?: string) {
  const link = canonical ? `<link data-rh="true" rel="canonical" href="${canonical}">` : "";
  return `<html><head><title>${title}</title>${link}</head><body><h1>content</h1></body></html>`;
}

describe("expectedCanonical", () => {
  it("joins the site origin and the route, without a trailing slash", () => {
    expect(expectedCanonical("/")).toBe("https://www.sphpnp.com/");
    expect(expectedCanonical("/stock/RELIANCE")).toBe("https://www.sphpnp.com/stock/RELIANCE");
    expect(expectedCanonical("/learn/pe-ratio/")).toBe("https://www.sphpnp.com/learn/pe-ratio");
  });
});

describe("assertHeadCaptured", () => {
  it("accepts a page whose head names that page", () => {
    const html = page("Reliance Industries (RELIANCE) financials | Parasram India", "https://www.sphpnp.com/stock/RELIANCE");
    expect(() => assertHeadCaptured("/stock/RELIANCE", html, { genericTitle: GENERIC })).not.toThrow();
  });

  it("rejects a page captured before any head was written", () => {
    expect(() => assertHeadCaptured("/stock/RELIANCE", page(GENERIC), { genericTitle: GENERIC })).toThrow(/no canonical link/);
  });

  it("rejects a page still carrying the homepage's head (canonical pointing at /)", () => {
    const html = page(GENERIC, "https://www.sphpnp.com/");
    expect(() => assertHeadCaptured("/stock/RELIANCE", html, { genericTitle: GENERIC })).toThrow(/expected https:\/\/www\.sphpnp\.com\/stock\/RELIANCE/);
  });

  it("rejects the generic title even when the canonical is right", () => {
    const html = page(GENERIC, "https://www.sphpnp.com/learn/pe-ratio");
    expect(() => assertHeadCaptured("/learn/pe-ratio", html, { genericTitle: GENERIC })).toThrow(/generic homepage title/);
  });

  it("lets the homepage keep the generic title", () => {
    expect(() => assertHeadCaptured("/", page(GENERIC, "https://www.sphpnp.com/"), { genericTitle: GENERIC })).not.toThrow();
  });

  it("compares URL-encoded symbols by their decoded form", () => {
    const html = page("M&M financials | Parasram India", "https://www.sphpnp.com/stock/M%26M");
    expect(() => assertHeadCaptured("/stock/M&M", html, { genericTitle: GENERIC })).not.toThrow();
  });

  it("skips the canonical match for the 404 route when asked", () => {
    const html = page("Page not found | Parasram India", "https://www.sphpnp.com/");
    expect(() => assertHeadCaptured("/404", html, { genericTitle: GENERIC, checkCanonical: false })).not.toThrow();
  });

  it("only reads the canonical from the head, not body text", () => {
    const html = `<html><head><title>${GENERIC}</title></head><body><link rel="canonical" href="https://www.sphpnp.com/stock/X"></body></html>`;
    expect(() => assertHeadCaptured("/stock/X", html, { genericTitle: GENERIC })).toThrow(/no canonical link/);
  });
});
