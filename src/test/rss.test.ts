import { describe, it, expect } from "vitest";
import { hasFeedItems } from "../../supabase/functions/_shared/rss.ts";

describe("hasFeedItems", () => {
  it("accepts a normal RSS body with <item> elements", () => {
    const xml = `<?xml version="1.0"?><rss><channel><item><title>A</title></item></channel></rss>`;
    expect(hasFeedItems(xml)).toBe(true);
  });

  it("accepts an Atom body with <entry> elements", () => {
    const xml = `<?xml version="1.0"?><feed><entry><title>A</title></entry></feed>`;
    expect(hasFeedItems(xml)).toBe(true);
  });

  // The regression this function exists for: fetch() follows redirects, so a
  // feed URL that now 301s to an HTML page still comes back HTTP 200 - just
  // with a webpage instead of a feed. That body has no <item>/<entry> at all.
  it("rejects an HTML body with no <item>/<entry>", () => {
    const html = `<!DOCTYPE html><html><head><title>Markets</title></head><body><div class="item-card">Not a feed</div></body></html>`;
    expect(hasFeedItems(html)).toBe(false);
  });

  it("rejects an empty body", () => {
    expect(hasFeedItems("")).toBe(false);
  });

  it("does not false-positive on tags that merely start with item/entry", () => {
    const html = `<html><body><div itemprop="name">x</div><entryPoint>y</entryPoint></body></html>`;
    expect(hasFeedItems(html)).toBe(false);
  });
});
