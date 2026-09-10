import { describe, it, expect } from "vitest";
import {
  parseDateRange,
  parseGmp,
  toCatalogueRow,
} from "../../supabase/functions/_shared/ipo-parse";

/*
 * Guards for sync-ipos' parsing of the IPO Watch GMP table.
 *
 * Extracted from the edge function for the same reason screener-row.ts was:
 * the function calls Deno.serve() at module scope, so it cannot be imported
 * into a Node test runner. The parsing is where the bugs live, and it is pure.
 */

describe("parseDateRange", () => {
  it("reads a range inside one month", () => {
    expect(parseDateRange("10 - 14 Sep 2026")).toEqual(["2026-09-10", "2026-09-14"]);
  });

  it("reads a range that crosses a month boundary", () => {
    // IPO windows routinely straddle month ends. The original single-month
    // regex silently returned [null, null] for these, and because the upsert
    // wrote those nulls over stored values, a good open/close date collected
    // on an earlier run was destroyed by a later one.
    expect(parseDateRange("29 Sep - 3 Oct 2026")).toEqual(["2026-09-29", "2026-10-03"]);
  });

  it("reads a range that crosses a year boundary", () => {
    expect(parseDateRange("30 Dec 2026 - 2 Jan 2027")).toEqual(["2026-12-30", "2027-01-02"]);
  });

  it("returns nulls rather than guessing when there is no year", () => {
    expect(parseDateRange("10 - 14 Sep")).toEqual([null, null]);
  });

  it("returns nulls for an unparseable cell", () => {
    expect(parseDateRange("To be announced")).toEqual([null, null]);
    expect(parseDateRange("")).toEqual([null, null]);
  });
});

describe("parseGmp", () => {
  it("reads a plain premium", () => {
    expect(parseGmp("₹120")).toBe(120);
  });

  it("reads a discount as negative", () => {
    expect(parseGmp("-15")).toBe(-15);
  });

  it("does not invent a discount from a range separator", () => {
    // The original guard was `/-/.test(cell) && value > 0` which flipped the
    // sign of any cell merely containing a dash. A quoted range turned a ₹12
    // premium into a ₹12 discount.
    expect(parseGmp("12-15")).toBe(12);
  });

  it("returns null when there is no number", () => {
    expect(parseGmp("-")).toBeNull();
    expect(parseGmp("")).toBeNull();
  });
});

describe("toCatalogueRow", () => {
  const collected = {
    slug: "acme-industries",
    name: "Acme Industries",
    board: "mainboard" as const,
    status: "open" as const,
    price_band_min: null,
    price_band_max: null,
    open_date: null,
    close_date: null,
  };

  it("omits fields the source did not provide", () => {
    // The catalogue is upserted on slug, so a key present with a null value is
    // an UPDATE ... SET col = NULL: one run that fails to parse a price band
    // wipes the band a previous run collected correctly. Omitting the key
    // leaves the stored value alone. Same rule as buildStockRow in
    // screener-row.ts, for the same reason.
    const row = toCatalogueRow(collected, "ipowatch", "https://example.test", "2026-09-09T00:00:00.000Z");

    expect(row).not.toHaveProperty("price_band_min");
    expect(row).not.toHaveProperty("price_band_max");
    expect(row).not.toHaveProperty("open_date");
    expect(row).not.toHaveProperty("close_date");
  });

  it("keeps the identity and status fields that are always known", () => {
    const row = toCatalogueRow(collected, "ipowatch", "https://example.test", "2026-09-09T00:00:00.000Z");

    expect(row.slug).toBe("acme-industries");
    expect(row.name).toBe("Acme Industries");
    expect(row.board).toBe("mainboard");
    expect(row.status).toBe("open");
    expect(row.source).toBe("ipowatch");
  });

  it("writes values through when the source did provide them", () => {
    const row = toCatalogueRow(
      { ...collected, price_band_min: 100, price_band_max: 105, open_date: "2026-09-10" },
      "ipowatch",
      "https://example.test",
      "2026-09-09T00:00:00.000Z",
    );

    expect(row.price_band_min).toBe(100);
    expect(row.price_band_max).toBe(105);
    expect(row.open_date).toBe("2026-09-10");
    expect(row).not.toHaveProperty("close_date");
  });
});
