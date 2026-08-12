import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  extractEmbeddedArray,
  matchKey,
  parseStockify,
  parseUnlistedZone,
} from "../../supabase/functions/_shared/unlisted-sources";

const stockifyHtml = readFileSync(
  "src/test/fixtures/unlisted/stockify-price-list.html",
  "utf-8",
);

/**
 * These exist because of a scheduled run that failed with
 * `{"upserted":23,"failures":["Stockify: parsed 0 quotes (markup likely changed)"]}`.
 * The failure was reported correctly - the parser really had stopped working -
 * but nothing in the repository could have caught it before the cron did,
 * because the parsing was welded to a `fetch`. A fixture of the real page is
 * the only thing that turns a dealer's redesign into a test failure.
 */
describe("parseStockify", () => {
  const quotes = parseStockify(stockifyHtml);

  it("parses the price list the old text regex went blind to", () => {
    // The regression was zero. Any number here beats the old behaviour, but the
    // bar is the real page's content, not merely "not empty".
    expect(quotes.length).toBeGreaterThan(60);
  });

  it("reads a known company's published price", () => {
    const avt = quotes.find((q) => q.match_key === "a-v-thomas-co");
    expect(avt).toBeDefined();
    // Rendered on the page as "₹27,300.00".
    expect(avt!.price).toBe(27300);
    expect(avt!.company_name).toBe("A V Thomas & Co. Limited Unlisted Shares");
  });

  it("merges the ticker array so coverage is not halved", () => {
    // NSE India is in `stocks` but not on the first page of `data`. Reading
    // only the richer array would silently drop 40-odd companies.
    const nse = quotes.find((q) => q.match_key === "nse-india");
    expect(nse).toBeDefined();
    expect(nse!.price).toBeGreaterThan(0);
  });

  it("unescapes ampersands rather than leaking the JSON escape", () => {
    const avt = quotes.find((q) => q.match_key === "a-v-thomas-co")!;
    expect(avt.company_name).toContain("&");
    expect(avt.company_name).not.toContain("\\u0026");
  });

  it("drops companies published at zero", () => {
    // Cultfit is listed with price 0 - published, but not yet rated. Zero is
    // not a price and must never reach the comparison table.
    expect(quotes.some((q) => q.match_key.startsWith("cultfit"))).toBe(false);
    expect(quotes.every((q) => q.price > 0)).toBe(true);
  });

  it("emits one row per company", () => {
    const keys = quotes.map((q) => q.match_key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("links each quote to the company's own page", () => {
    const avt = quotes.find((q) => q.match_key === "a-v-thomas-co")!;
    expect(avt.quote_url).toBe(
      "https://stockify.net.in/companies/a-v-thomas-and-company-ltd-unlisted-shares",
    );
  });

  // Each of these drives something a reader sees. A guessed lot size or a
  // borrowed timestamp is worse than an absent one - see the field comments.
  it("leaves fields the list does not publish null rather than guessing", () => {
    for (const q of quotes) {
      expect(q.lot_size).toBeNull();
      expect(q.as_of).toBeNull();
      expect(q.sector).toBeNull();
    }
  });

  it("stamps every row with the source it came from", () => {
    expect(quotes.every((q) => q.source === "Stockify")).toBe(true);
    expect(
      quotes.every((q) => q.source_url.startsWith("https://stockify.net.in/")),
    ).toBe(true);
  });

  // The sync turns an empty result into a loud structural failure. That
  // contract only holds if the parser really does return empty when the page
  // is not the page it expects, rather than throwing.
  it("returns empty, without throwing, when the payload is gone", () => {
    expect(parseStockify("<html><body>nothing here</body></html>")).toEqual([]);
  });
});

describe("parseUnlistedZone", () => {
  // Built to the same flight-payload shape the live page uses, including the
  // escaping, so the shared extractor is exercised the way production hits it.
  const html = `<script>self.__next_f.push([1,"7:{\\"shares\\":[
    {\\"slug\\":\\"acme-ltd\\",\\"name\\":\\"Acme \\u0026 Sons Limited\\",\\"price\\":1234.5,\\"sector\\":\\"Manufacturing\\",\\"lot_size\\":100,\\"as_of\\":\\"2026-08-10T00:00:00Z\\"},
    {\\"slug\\":\\"zero-co\\",\\"name\\":\\"Zero Co\\",\\"price\\":0,\\"sector\\":\\"Finance\\",\\"lot_size\\":50,\\"as_of\\":\\"2026-08-10\\"},
    {\\"slug\\":\\"nodate-co\\",\\"name\\":\\"No Date Co\\",\\"price\\":10,\\"sector\\":null,\\"lot_size\\":0,\\"as_of\\":\\"whenever\\"}
  ]}"])</script>`;

  it("reads the published fields", () => {
    const [acme] = parseUnlistedZone(html);
    expect(acme.company_name).toBe("Acme & Sons Limited");
    expect(acme.price).toBe(1234.5);
    expect(acme.sector).toBe("Manufacturing");
    expect(acme.lot_size).toBe(100);
    expect(acme.as_of).toBe("2026-08-10");
    expect(acme.quote_url).toBe("https://www.unlistedzone.com/shares/acme-ltd");
  });

  it("drops a company published at zero", () => {
    expect(parseUnlistedZone(html).some((q) => q.company_name === "Zero Co")).toBe(false);
  });

  it("refuses a malformed date rather than showing it as the quote's age", () => {
    const q = parseUnlistedZone(html).find((x) => x.company_name === "No Date Co")!;
    expect(q.as_of).toBeNull();
    // A zero lot size is a placeholder too, not a dealable minimum.
    expect(q.lot_size).toBeNull();
  });
});

describe("extractEmbeddedArray", () => {
  it("returns empty for a key that is not present", () => {
    expect(extractEmbeddedArray(stockifyHtml, "nosuchkey")).toEqual([]);
  });

  // The bracket walk exists for this: a '[' inside a company name must not be
  // read as array structure and terminate the payload early.
  it("does not let a bracket inside a string terminate the array", () => {
    const html = `x\\"items\\":[{\\"name\\":\\"Weird ] Name [\\",\\"price\\":5},{\\"name\\":\\"Second\\",\\"price\\":6}]y`;
    const rows = extractEmbeddedArray(html, "items");
    expect(rows).toHaveLength(2);
    expect(rows[1].name).toBe("Second");
  });

  it("returns empty rather than throwing on an unterminated array", () => {
    expect(extractEmbeddedArray(`z\\"items\\":[{\\"a\\":1}`, "items")).toEqual([]);
  });
});

describe("matchKey", () => {
  it("collapses the ways dealers spell the same company", () => {
    expect(matchKey("NSE India Limited Unlisted Shares")).toBe("nse-india");
    expect(matchKey("NSE India Unlisted Shares")).toBe("nse-india");
    expect(matchKey("NSE India Ltd")).toBe("nse-india");
  });

  it("survives the ampersand escape both sources use", () => {
    expect(matchKey("A V Thomas &amp; Co. Limited Unlisted Shares")).toBe(
      matchKey("A V Thomas & Co. Limited Unlisted Shares"),
    );
  });
});
