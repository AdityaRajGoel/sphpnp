import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseGoogleNewsRss, ipoNewsQuery, parseStockNewsRss, stockNewsQuery } from "../../supabase/functions/_shared/google-news";

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

/*
 * The same feed per listed stock, captured 2026-09-11 for "Tata Motors".
 * A stock's news must name the company in full or by ticker: the first word
 * alone ("Tata") heads a dozen listed companies.
 */
describe("parseStockNewsRss", () => {
  const stockXml = readFileSync("src/test/fixtures/news/google-news-tata-motors.xml", "utf-8");
  const items = parseStockNewsRss(stockXml, "Tata Motors Limited", "TATAMOTORS");

  it("keeps stories naming the company, newest first, up to the limit", () => {
    expect(items.length).toBeGreaterThan(3);
    expect(items.length).toBeLessThanOrEqual(10);
    expect(items.every((i) => /tata motors|tatamotors/i.test(i.title))).toBe(true);
    const times = items.map((i) => i.published_at);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it("refuses a headline that only shares the group name", () => {
    const xml = `<rss><channel>
      <item><title>Tata Steel shares rally - Mint</title><link>https://news.google.com/a</link><pubDate>Thu, 10 Sep 2026 10:00:00 GMT</pubDate><source url="x">Mint</source></item>
      <item><title>Tata Motors shares rally - Mint</title><link>https://news.google.com/b</link><pubDate>Thu, 10 Sep 2026 11:00:00 GMT</pubDate><source url="x">Mint</source></item>
      <item><title>Tata Motors shares rally - Mint</title><link>https://news.google.com/c</link><pubDate>Thu, 10 Sep 2026 09:00:00 GMT</pubDate><source url="x">Mint</source></item>
    </channel></rss>`;
    expect(parseStockNewsRss(xml, "Tata Motors", "TATAMOTORS").map((i) => i.url)).toEqual(["https://news.google.com/b"]);
  });

  it("matches a short ticker only as a whole word", () => {
    const xml = `<rss><channel>
      <item><title>ITC shares hit record - ET</title><link>https://news.google.com/a</link><pubDate>Thu, 10 Sep 2026 10:00:00 GMT</pubDate><source url="x">ET</source></item>
      <item><title>Switch to EV accelerates - ET</title><link>https://news.google.com/b</link><pubDate>Thu, 10 Sep 2026 10:00:00 GMT</pubDate><source url="x">ET</source></item>
    </channel></rss>`;
    expect(parseStockNewsRss(xml, "ITC Ltd", "ITC").map((i) => i.url)).toEqual(["https://news.google.com/a"]);
  });
});

describe("stockNewsQuery", () => {
  it("searches the name without its legal suffix, about its shares, in the last fortnight", () => {
    expect(stockNewsQuery("Tata Motors Limited")).toBe('"Tata Motors" (share OR shares OR stock OR results) when:14d');
  });
});

describe("rssItems - collection sources", () => {
  it("leaves out stories published by the sites IPO data is collected from", () => {
    const xml = `<rss><channel>
      <item><title>X IPO GMP today - IPO Watch</title><link>https://news.google.com/a</link><pubDate>Thu, 10 Sep 2026 10:00:00 GMT</pubDate><source url="x">IPO Watch</source></item>
      <item><title>X IPO opens - Mint</title><link>https://news.google.com/b</link><pubDate>Thu, 10 Sep 2026 10:00:00 GMT</pubDate><source url="x">Mint</source></item>
    </channel></rss>`;
    expect(parseGoogleNewsRss(xml, "X").map((i) => i.source)).toEqual(["Mint"]);
  });
});
