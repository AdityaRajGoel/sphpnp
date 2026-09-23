import { describe, it, expect } from "vitest";
import { ipoDataset, ipoFaqItems, ipoMetaDescription } from "@/lib/ipo-structured-data";
import type { Ipo } from "@/lib/ipo";

const ipo = {
  id: "1", slug: "acme-ltd", name: "Acme Ltd", board: "mainboard", type: "Mainboard", status: "open",
  price_band_min: 100, price_band_max: 105, price: "₹100-105", lot_size: 140, issue_size_crore: 500, size: "₹500 Cr",
  open_date: "2026-09-18", close_date: "2026-09-22", date: "18-22 Sep", allotment_date: null, listing_date: "2026-09-25",
  registrar: null, rhp_url: null, drhp_url: null,
  subscription_qib: 3.2, subscription_nii: 5.1, subscription_retail: 2.4,
  listing_price: null, listing_gain_pct: null, source: "x", source_url: null, data_as_of: "2026-09-20T05:00:00Z",
} as unknown as Ipo;

describe("ipoFaqItems", () => {
  it("answers the questions people actually ask about an issue", () => {
    const items = ipoFaqItems(ipo);
    expect(items.map((i) => i.question.split(" ").slice(0, 4).join(" "))).toEqual([
      "What is the price", "When does the Acme", "What is the lot", "How much was the",
    ]);
    expect(items[2].answer).toContain("140 shares");
    expect(items[2].answer).toContain("₹14,700"); // one lot at the upper band
  });

  it("says nothing about a listing that has not happened", () => {
    expect(ipoFaqItems(ipo).some((i) => i.question.includes("listing price"))).toBe(false);
    const listed = ipoFaqItems({ ...ipo, listing_price: 126, listing_gain_pct: 20 } as Ipo);
    expect(listed.find((i) => i.question.includes("listing price"))!.answer).toContain("gain of 20.00%");
  });

  it("returns nothing without an issue", () => {
    expect(ipoFaqItems(null)).toEqual([]);
  });
});

describe("ipoDataset", () => {
  it("covers the issue window and the measures present", () => {
    const ds = ipoDataset(ipo)!;
    expect(ds["@type"]).toBe("Dataset");
    expect(ds.temporalCoverage).toBe("2026-09-18/2026-09-22");
    expect(ds.variableMeasured).toContain("Subscription by category");
    expect(ds.variableMeasured).not.toContain("Listing price and listing gain");
  });
});

describe("ipoMetaDescription", () => {
  it("states the band, lot and dates of an open issue", () => {
    const d = ipoMetaDescription(ipo);
    expect(d).toContain("Acme Ltd mainboard IPO: price band ₹100 to ₹105, lot of 140 shares, bidding 18 Sept to 22 Sept.".replace(/Sept/g, new Date("2026-09-18").toLocaleDateString("en-IN", { month: "short" })));
    expect(d.length).toBeGreaterThanOrEqual(110);
    expect(d.length).toBeLessThanOrEqual(160);
  });

  it("reports the listing gain once listed", () => {
    const d = ipoMetaDescription({ ...ipo, status: "listed", listing_gain_pct: 20 } as Ipo);
    expect(d).toMatch(/listed 25 \w+ at \+20\.0% vs issue/);
  });

  it("stays in range for a very long name and for an issue with no figures", () => {
    const long = ipoMetaDescription({ ...ipo, name: "Very Long Name Engineering And Infrastructure Projects (India) Private Limited" } as Ipo);
    expect(long.length).toBeLessThanOrEqual(160);
    const bare = ipoMetaDescription({ ...ipo, name: "XY", board: "sme", price_band_min: null, price_band_max: null, lot_size: null, open_date: null, close_date: null } as Ipo);
    expect(bare.length).toBeGreaterThanOrEqual(110);
    expect(bare.length).toBeLessThanOrEqual(160);
  });
});
