import { describe, it, expect } from "vitest";
import { cleanCapturedHtml, restoreNonBlockingFonts, stripCaptureOrigin } from "../../scripts/lib/prerender-html.mjs";

describe("stripCaptureOrigin", () => {
  it("makes capture-server URLs root-relative and leaves real origins alone", () => {
    const html = '<link rel="modulepreload" href="http://localhost:43395/assets/card-CJ.js"><a href="https://www.sphpnp.com/about">';
    expect(stripCaptureOrigin(html, 43395)).toBe('<link rel="modulepreload" href="/assets/card-CJ.js"><a href="https://www.sphpnp.com/about">');
  });

  it("handles 127.0.0.1 and any port when none is given", () => {
    expect(stripCaptureOrigin('src="http://127.0.0.1:5173/x.js"')).toBe('src="/x.js"');
  });
});

describe("restoreNonBlockingFonts", () => {
  const flipped = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat&display=swap" as="style" onload="this.onload=null;this.rel=\'stylesheet\'">';

  it("turns the flipped fonts link back into a preload", () => {
    expect(restoreNonBlockingFonts(flipped)).toContain('rel="preload"');
    expect(restoreNonBlockingFonts(flipped)).not.toMatch(/rel="stylesheet"\s/);
  });

  it("leaves the noscript fallback and unrelated stylesheets untouched", () => {
    const noscript = '<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat"></noscript>';
    const appCss = '<link rel="stylesheet" href="/assets/index.css">';
    expect(restoreNonBlockingFonts(noscript)).toBe(noscript);
    expect(restoreNonBlockingFonts(appCss)).toBe(appCss);
  });
});

describe("cleanCapturedHtml", () => {
  it("applies both fixes", () => {
    const html = '<link rel="modulepreload" href="http://localhost:9/assets/a.js"><link rel="stylesheet" href="https://fonts.googleapis.com/css2" as="style" onload="x">';
    expect(cleanCapturedHtml(html, 9)).toBe('<link rel="modulepreload" href="/assets/a.js"><link rel="preload" href="https://fonts.googleapis.com/css2" as="style" onload="x">');
  });
});
