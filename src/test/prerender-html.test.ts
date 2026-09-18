import { describe, it, expect } from "vitest";
import { cleanCapturedHtml, dropHeroPreload, stripCaptureOrigin } from "../../scripts/lib/prerender-html.mjs";

describe("stripCaptureOrigin", () => {
  it("makes capture-server URLs root-relative and leaves real origins alone", () => {
    const html = '<link rel="modulepreload" href="http://localhost:43395/assets/card-CJ.js"><a href="https://www.sphpnp.com/about">';
    expect(stripCaptureOrigin(html, 43395)).toBe('<link rel="modulepreload" href="/assets/card-CJ.js"><a href="https://www.sphpnp.com/about">');
  });

  it("handles 127.0.0.1 and any port when none is given", () => {
    expect(stripCaptureOrigin('src="http://127.0.0.1:5173/x.js"')).toBe('src="/x.js"');
  });
});

describe("dropHeroPreload", () => {
  const preload = '<link rel="preload" href="/hero-bg.webp" as="image" type="image/webp" fetchpriority="high">';

  it("removes the hero image preload from pages that have no hero", () => {
    expect(dropHeroPreload(`<head>${preload}<link rel="icon" href="/favicon.ico"></head>`, "/about")).toBe('<head><link rel="icon" href="/favicon.ico"></head>');
  });

  it("keeps it on the homepage, where the hero is the LCP image", () => {
    expect(dropHeroPreload(preload, "/")).toBe(preload);
  });
});

describe("cleanCapturedHtml", () => {
  it("applies both fixes", () => {
    const html = '<link rel="modulepreload" href="http://localhost:9/assets/a.js"><link rel="preload" href="/hero-bg.webp" as="image">';
    expect(cleanCapturedHtml(html, 9, "/ipo")).toBe('<link rel="modulepreload" href="/assets/a.js">');
  });
});
