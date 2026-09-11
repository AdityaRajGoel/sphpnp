import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseGoogleNewsRss, ipoNewsQuery } from "../../supabase/functions/_shared/google-news";

/*
 * Per-IPO news from Google News' RSS search, captured 2026-09-11 for
 * "Rentomojo" IPO. Free and keyless; the IPO detail page used to filter the
 * general market-news feed for words from the company's name instead, which
 * found nothing for most issues.
 */

const xml = readFileSync("src/test/fixtures/news/google-news-rentomojo.xml", "utf-8");

describe("parseGoogleNewsRss", () => {
  const items = parseGoogleNewsRss(xml, "Rentomojo");

  it("reads each story's headline, publisher, link and time", () => {
    expect(items.find((i) => i.source === "Reuters")).toEqual({
      title: "Furniture rental firm Rentomojo's $133 million India IPO fully subscribed on first day",
      source: "Reuters",
      url: expect.stringMatching(/^https:\/\/news\.google\.com\/rss\/articles\//),
      published_at: "2026-09-09T13:08:08.000Z",
    });
  });

  it("drops the ' - Publisher' suffix Google appends to headlines", () => {
    expect(items.every((i) => !i.title.endsWith(` - ${i.source}`))).toBe(true);
  });

  it("keeps only stories that name the company", () => {
    expect(parseGoogleNewsRss(xml, "Jindal Supreme")).toEqual([]);
  });

  it("newest first, capped", () => {
    const capped = parseGoogleNewsRss(xml, "Rentomojo", 5);
    expect(capped).toHaveLength(5);
    const times = capped.map((i) => i.published_at);
    expect([...times].sort().reverse()).toEqual(times);
  });
});

describe("ipoNewsQuery", () => {
  it("searches the company's name as a phrase with IPO, recent stories only", () => {
    expect(ipoNewsQuery("Rentomojo")).toBe('"Rentomojo" IPO when:60d');
  });

  it("drops the parenthetical a catalogue name carries", () => {
    expect(ipoNewsQuery("National Stock Exchange of India (NSE )")).toBe('"National Stock Exchange of India" IPO when:60d');
  });
});
