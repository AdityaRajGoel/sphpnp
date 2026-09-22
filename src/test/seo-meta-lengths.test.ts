import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { stockPageTitle } from "@/lib/seo-title";

/*
 * Search results truncate a title past ~60 characters and a description past
 * ~160, and an answer engine quoting the page gets a clipped sentence. Audited
 * live on 2026-09-21: six titles ran to 74 and four descriptions to 228.
 *
 * The literals are read from the page sources, so a new page is covered the day
 * it is written rather than the day someone remembers to add it here.
 */
const TITLE_MAX = 60;
const DESC_MIN = 110;
const DESC_MAX = 160;

const unescape = (s: string) => s.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"');
const pages = readdirSync("src/pages").filter((f) => f.endsWith(".tsx"));

/** The <SEOHead .../> elements in a page, minus the ones marked noindex. */
const seoHeads = () =>
  pages.flatMap((file) => {
    const src = readFileSync(`src/pages/${file}`, "utf-8");
    return [...src.matchAll(/<SEOHead\b([\s\S]*?)\/>/g)]
      .map((m) => ({ file, block: m[1] }))
      .filter((h) => !/noindex/.test(h.block));
  });

const literals = (attr: string) =>
  seoHeads().flatMap(({ file, block }) => {
    const m = new RegExp(`(?:^|\\s)${attr}="([^"]+)"`).exec(block);
    return m ? [{ file, value: unescape(m[1]) }] : [];
  });

describe("SEO titles and descriptions", () => {
  it("keeps every static page title within what search results show", () => {
    const tooLong = literals("title").filter((t) => t.value.length > TITLE_MAX);
    expect(tooLong.map((t) => `${t.file}: ${t.value.length}`)).toEqual([]);
  });

  it("keeps every static meta description in range", () => {
    const off = literals("description").filter((d) => d.value.length > DESC_MAX || d.value.length < DESC_MIN);
    expect(off.map((d) => `${d.file}: ${d.value.length}`)).toEqual([]);
  });
});

describe("stockPageTitle", () => {
  it("fits a normal name with the brand", () => {
    const title = stockPageTitle("Reliance Industries", "RELIANCE");
    expect(title).toBe("Reliance Industries (RELIANCE) share price | Parasram");
    expect(title.length).toBeLessThanOrEqual(TITLE_MAX);
  });

  it("trims a long company name instead of overflowing", () => {
    const title = stockPageTitle("Housing Development Finance Corporation", "HDFC");
    expect(title.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(title).toContain("(HDFC)");
    expect(title).toMatch(/…|\.\.\./);
  });

  it("falls back to the symbol alone when the name is unknown", () => {
    expect(stockPageTitle(null, "TCS")).toBe("TCS share price and financials | Parasram");
  });
});

describe("pageTitle", () => {
  it("adds the brand only while the title stays within 60 characters", async () => {
    const { pageTitle } = await import("@/lib/seo-title");
    expect(pageTitle("Pricing")).toBe("Pricing | Parasram India");
    const long = "Nifty Financial Services Stocks List 2026: 20 Companies";
    expect(pageTitle(long)).toBe(long);
    expect(pageTitle("About Parasram")).toBe("About Parasram");
  });
});
