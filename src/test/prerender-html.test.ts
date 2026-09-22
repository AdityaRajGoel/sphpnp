import { describe, it, expect } from "vitest";
import { cleanCapturedHtml, dedupeJsonLd, dropHeroPreload, dropRuntimePreloads, stripCaptureOrigin } from "../../scripts/lib/prerender-html.mjs";

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
  const preload = '<link rel="preload" as="image" type="image/webp" imagesrcset="/hero-bg-640.webp 640w, /hero-bg-1280.webp 1280w, /hero-bg.webp 2940w" imagesizes="100vw" fetchpriority="high">';

  it("removes the hero image preload from pages that have no hero", () => {
    expect(dropHeroPreload(`<head>${preload}<link rel="icon" href="/favicon.ico"></head>`, "/about")).toBe('<head><link rel="icon" href="/favicon.ico"></head>');
  });

  it("keeps it on the homepage, where the hero is the LCP image", () => {
    expect(dropHeroPreload(preload, "/")).toBe(preload);
  });
});

describe("cleanCapturedHtml", () => {
  it("applies both fixes", () => {
    const html = '<link rel="modulepreload" href="http://localhost:9/assets/a.js"><link rel="preload" imagesrcset="/hero-bg-640.webp 640w" as="image">';
    expect(cleanCapturedHtml(html, 9, "/ipo")).toBe('<link rel="modulepreload" href="/assets/a.js">');
  });
});

describe("dedupeJsonLd", () => {
  const ld = (o: object) => `<script type="application/ld+json" data-rh="true">${JSON.stringify(o)}</script>`;

  it("keeps only the last block of each type", () => {
    const stale = ld({ "@type": "BreadcrumbList", n: "TCS share price and financials" });
    const org = ld({ "@type": ["FinancialService", "LocalBusiness"] });
    const fresh = ld({ "@type": "BreadcrumbList", n: "Tata Consultancy Services (TCS)" });
    const faq = ld({ "@type": "FAQPage" });
    expect(dedupeJsonLd(`<head>${org}${stale}${fresh}${faq}</head>`)).toBe(`<head>${org}${fresh}${faq}</head>`);
  });

  it("leaves unparsable blocks alone", () => {
    const html = '<script type="application/ld+json">{broken</script>';
    expect(dedupeJsonLd(html)).toBe(html);
  });
});

describe("dropRuntimePreloads", () => {
  it("drops the chunks the capture recorded and keeps the build's entry preloads", () => {
    const entry = '<link rel="modulepreload" crossorigin="" href="/assets/react-vendor.js">';
    const lazy = '<link rel="modulepreload" as="script" crossorigin="" href="/assets/AdvancedChartDialog.js">';
    expect(dropRuntimePreloads(`${entry}${lazy}`)).toBe(entry);
  });
});
