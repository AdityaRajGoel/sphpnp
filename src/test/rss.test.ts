import { describe, it, expect } from "vitest";
import { hasFeedItems, parseFeedDate } from "../../supabase/functions/_shared/rss.ts";

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

describe("parseFeedDate", () => {
  const FALLBACK = new Date("2026-08-10T12:00:00.000Z");

  it("parses a normal RFC-822 pubDate", () => {
    const d = parseFeedDate("Sun, 10 Aug 2026 09:30:00 +0530", FALLBACK);
    expect(d.toISOString()).toBe("2026-08-10T04:00:00.000Z");
  });

  it("parses an ISO-8601 date", () => {
    const d = parseFeedDate("2026-08-10T09:30:00Z", FALLBACK);
    expect(d.toISOString()).toBe("2026-08-10T09:30:00.000Z");
  });

  // The regression. `new Date("not a date").toISOString()` throws RangeError,
  // and that throw used to escape the per-item map and discard the whole feed -
  // four of nine live sources were being lost to one bad date each.
  it("falls back instead of producing a date whose toISOString throws", () => {
    const d = parseFeedDate("not a date at all", FALLBACK);
    expect(d).toEqual(FALLBACK);
    expect(() => d.toISOString()).not.toThrow();
  });

  it("falls back on null, undefined and empty input", () => {
    expect(parseFeedDate(null, FALLBACK)).toEqual(FALLBACK);
    expect(parseFeedDate(undefined, FALLBACK)).toEqual(FALLBACK);
    expect(parseFeedDate("", FALLBACK)).toEqual(FALLBACK);
    expect(parseFeedDate("   ", FALLBACK)).toEqual(FALLBACK);
  });

  it("never returns an Invalid Date for any input", () => {
    for (const raw of ["", "x", "0000-00-00", "Mon, 99 Xxx 9999", "2026-13-45T99:99:99Z"]) {
      expect(Number.isNaN(parseFeedDate(raw, FALLBACK).getTime())).toBe(false);
    }
  });
});
