import { describe, it, expect } from "vitest";
import { cleanIpoName, ipoMatchKey, parseChittorgarh } from "../../supabase/functions/_shared/ipo-parse";
import { reconcileIpos } from "../../supabase/functions/_shared/ipo-reconcile";
import { planIpoMerges, preferFullName, resolveSlug, type StoredIpo } from "../../supabase/functions/_shared/ipo-identity";

/*
 * One IPO, one row.
 *
 * The three sources name the same issue differently, and every row was keyed
 * by a slug of whatever name its source printed. So one issue became two rows:
 * Chittorgarh's carried the dates and IPO Watch's carried the GMP and lot size,
 * and neither page was complete. Nine current issues were split this way in
 * production - the pairs below are those nine, verbatim.
 */

const PRODUCTION_PAIRS: [string, string][] = [
  ["Qualiance International P", "Qualiance International"],
  ["Apana Logistics P", "Apana Logistics"],
  ["Pranav Constructions P", "Pranav Constructions"],
  ["Kanohar Electricals CT", "Kanohar Electricals"],
  ["Glass Wall Systems (India) CT", "Glass Wall Systems"],
  ["Prasol Chemicals CT", "Prasol Chemicals"],
  ["Steamhouse India", "Steamhouse"],
  ["Maharaja & Speedex India", "Maharaja & Speedex"],
  ["Jindal Supreme (India)", "Jindal Supreme"],
  // Two rows on 2026-09-11: GMP on one, subscription on the other.
  ["Asset Reconstruction Co.(India)", "Asset Reconstruction"],
  ["Asset Reconstruction Company (India) Limited", "Asset Reconstruction"],
];

describe("ipoMatchKey", () => {
  it.each(PRODUCTION_PAIRS)("matches %s with %s", (a, b) => {
    expect(ipoMatchKey(a)).toBe(ipoMatchKey(b));
  });

  it("ignores legal suffixes, punctuation and & versus and", () => {
    expect(ipoMatchKey("Om Galaxy Ltd.")).toBe(ipoMatchKey("Om Galaxy Limited"));
    expect(ipoMatchKey("Q&T Foods")).toBe(ipoMatchKey("Q and T Foods"));
    expect(ipoMatchKey("G.V.Electricals (G.V. Electricals )")).toBe(ipoMatchKey("GV Electricals"));
  });

  it("keeps genuinely different companies apart", () => {
    expect(ipoMatchKey("Hero Motors")).not.toBe(ipoMatchKey("Hero MotoCorp"));
    expect(ipoMatchKey("India Glycols")).not.toBe(ipoMatchKey("Glycols"));
    expect(ipoMatchKey("Sham Foam")).not.toBe(ipoMatchKey("Shakti Polytarp"));
  });
});

describe("parseChittorgarh", () => {
  it("strips the CT and P status markers Chittorgarh glues to a name", () => {
    const cells = (name: string) =>
      `<tr><td>${name}</td><td>Book Built</td><td>Sep 8, 2026</td><td>Sep 10, 2026</td><td>Sep 15, 2026</td>` +
      `<td>100 to 105</td><td>50.00</td><td>50.00</td><td>0.00</td><td>50.00</td><td>NSE SME</td><td>X</td><td></td></tr>`;
    const html = `<table><tr><th>Company</th><th>Pricing Method</th><th>Opening Date</th><th>Closing Date</th>` +
      `<th>Listing Date</th><th>Issue Price (Rs.)</th><th>Total Issue Amount</th><th>Fresh</th><th>OFS</th>` +
      `<th>Issue Amount (Rs.cr.)</th><th>Listing at</th><th>Lead Manager</th><th>Compare</th></tr>` +
      cells("Kanohar Electricals Ltd. CT") + cells("Apana Logistics Ltd. P") + `</table>`;
    expect(parseChittorgarh(html, "sme").rows.map((r) => r.name)).toEqual(["Kanohar Electricals", "Apana Logistics"]);
  });
});

describe("reconcileIpos", () => {
  it("merges differently-named rows for the same issue into one", () => {
    const merged = reconcileIpos({
      ipowatch: [{
        slug: "glass-wall-systems", name: "Glass Wall Systems", board: "sme", status: "open",
        price_band_min: null, price_band_max: null, open_date: null, close_date: null, gmp: 66, est_listing_price: null,
      }],
      investorgain: [],
      chittorgarh: [{
        slug: "glass-wall-systems-india", name: "Glass Wall Systems (India)", board: "sme",
        price_band_min: 100, price_band_max: 105, open_date: "2026-09-08", close_date: "2026-09-10",
        listing_date: "2026-09-15", issue_size_crore: 50, detail_url: null,
      }],
    });
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ open_date: "2026-09-08", gmp: 66, issue_size_crore: 50 });
  });
});

const stored = (over: Partial<StoredIpo> & Pick<StoredIpo, "id" | "slug" | "name">): StoredIpo => ({
  created_at: "2026-09-01T00:00:00Z",
  status: "upcoming",
  open_date: null, close_date: null, listing_date: null, allotment_date: null,
  price_band_min: null, price_band_max: null, lot_size: null, issue_size_crore: null,
  registrar: null, rhp_url: null, drhp_url: null,
  subscription_qib: null, subscription_nii: null, subscription_retail: null,
  listing_price: null, listing_gain_pct: null, detail_url: null,
  ...over,
});

describe("planIpoMerges", () => {
  it("keeps the first-seen row and folds a later duplicate into it", () => {
    const plan = planIpoMerges([
      stored({ id: "b", slug: "pranav-constructions-p", name: "Pranav Constructions P", created_at: "2026-09-08T00:00:00Z", open_date: "2026-09-07", close_date: "2026-09-09" }),
      stored({ id: "a", slug: "pranav-constructions", name: "Pranav Constructions", created_at: "2026-09-05T00:00:00Z", lot_size: 120 }),
    ]);
    expect(plan.merges).toEqual([{
      fromId: "b", fromSlug: "pranav-constructions-p", intoId: "a", intoSlug: "pranav-constructions",
      // The duplicate's dates fill the keeper's gaps; the keeper's lot size is untouched.
      patch: { open_date: "2026-09-07", close_date: "2026-09-09" },
    }]);
  });

  it("never merges two issues whose open dates disagree", () => {
    // Same name, different offerings - e.g. a company that returns to market.
    const plan = planIpoMerges([
      stored({ id: "a", slug: "acme", name: "Acme", open_date: "2025-01-10" }),
      stored({ id: "b", slug: "acme-india", name: "Acme India", open_date: "2026-09-10", created_at: "2026-09-09T00:00:00Z" }),
    ]);
    expect(plan.merges).toEqual([]);
  });

  it("leaves unrelated rows alone", () => {
    const plan = planIpoMerges([
      stored({ id: "a", slug: "hero-motors", name: "Hero Motors" }),
      stored({ id: "b", slug: "sham-foam", name: "Sham Foam" }),
    ]);
    expect(plan.merges).toEqual([]);
  });
});

describe("resolveSlug", () => {
  const survivors = [
    stored({ id: "a", slug: "glass-wall-systems", name: "Glass Wall Systems" }),
    stored({ id: "c", slug: "acme", name: "Acme", open_date: "2025-01-10" }),
  ];

  it("reuses the stored slug for an issue already on record, so its URL and GMP history carry on", () => {
    expect(resolveSlug({ slug: "glass-wall-systems-india", name: "Glass Wall Systems (India)", open_date: "2026-09-08" }, survivors))
      .toBe("glass-wall-systems");
  });

  it("does not attach a new offering to an old one with the same name", () => {
    expect(resolveSlug({ slug: "acme-2026", name: "Acme", open_date: "2026-09-10" }, survivors)).toBe("acme-2026");
  });

  it("keeps its own slug for an issue never seen before", () => {
    expect(resolveSlug({ slug: "new-co", name: "New Co", open_date: null }, survivors)).toBe("new-co");
  });
});

describe("issues known by an abbreviation", () => {
  // IPO Watch lists the exchange's own IPO as "NSE"; Chittorgarh as "National
  // Stock Exchange of India (NSE )". The bracketed abbreviation is the only
  // thing the two names share, and ignoring it listed the issue twice.
  it("merges a row named by the abbreviation with the row that spells it out", () => {
    const merged = reconcileIpos({
      ipowatch: [{
        slug: "nse", name: "NSE", board: "mainboard", status: "upcoming",
        price_band_min: null, price_band_max: null, open_date: null, close_date: null, gmp: 222, est_listing_price: null,
      }],
      investorgain: [],
      chittorgarh: [{
        slug: "national-stock-exchange-of-india-nse", name: "National Stock Exchange of India (NSE )", board: "mainboard",
        price_band_min: null, price_band_max: null, open_date: "2026-09-17", close_date: "2026-09-21",
        listing_date: null, issue_size_crore: null, detail_url: null,
      }],
    });
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ open_date: "2026-09-17", gmp: 222 });
  });

  it("folds the stored duplicate into the first-seen row", () => {
    const plan = planIpoMerges([
      stored({ id: "a", slug: "nse", name: "NSE", created_at: "2026-09-09T17:09:46Z" }),
      stored({ id: "b", slug: "national-stock-exchange-of-india-nse", name: "National Stock Exchange of India (NSE )", created_at: "2026-09-10T11:20:39Z", open_date: "2026-09-17" }),
    ]);
    expect(plan.merges).toEqual([expect.objectContaining({ fromSlug: "national-stock-exchange-of-india-nse", intoSlug: "nse" })]);
  });

  it("writes an incoming issue under the stored abbreviated slug", () => {
    const survivors = [stored({ id: "a", slug: "nse", name: "NSE" })];
    expect(resolveSlug({ slug: "national-stock-exchange-of-india-nse", name: "National Stock Exchange of India (NSE )", open_date: "2026-09-17" }, survivors)).toBe("nse");
  });

  it("does not treat a descriptive bracket as an abbreviation", () => {
    const merged = reconcileIpos({
      ipowatch: [{ slug: "india", name: "India", board: "mainboard", status: "upcoming", price_band_min: null, price_band_max: null, open_date: null, close_date: null, gmp: null, est_listing_price: null }],
      investorgain: [],
      chittorgarh: [{ slug: "glass-wall-systems-india", name: "Glass Wall Systems (India)", board: "sme", price_band_min: null, price_band_max: null, open_date: null, close_date: null, listing_date: null, issue_size_crore: null, detail_url: null }],
    });
    expect(merged).toHaveLength(2);
  });
});

describe("cleanIpoName", () => {
  it("tidies the stray space inside a bracket", () => {
    expect(cleanIpoName("National Stock Exchange of India (NSE )")).toBe("National Stock Exchange of India (NSE)");
  });
});

/*
 * IPO Watch's GMP table truncates long names: "Manipal Payment" for Manipal
 * Payment and Identity Solutions (2026-09-11). A prefix is only an identity
 * when the price band agrees and the dates do not disagree - "Tata Capital"
 * and "Tata Capital Housing Finance" are different issuers.
 */
describe("truncated names", () => {
  it("folds a truncated name into the one full name it starts, at the same price band", () => {
    const plan = planIpoMerges([
      stored({ id: "1", slug: "manipal-payment-identity-solutions", name: "Manipal Payment and Identity Solutions", open_date: "2026-09-09", price_band_max: 339, created_at: "2026-09-01T00:00:00Z" }),
      stored({ id: "2", slug: "manipal-payment", name: "Manipal Payment", open_date: null, price_band_max: 339, created_at: "2026-09-05T00:00:00Z" }),
      stored({ id: "3", slug: "manipal-health-enterprises", name: "Manipal Health Enterprises", open_date: "2026-07-29", price_band_max: 590, created_at: "2026-07-01T00:00:00Z" }),
    ]);
    expect(plan.merges.map((m) => `${m.fromSlug}->${m.intoSlug}`)).toEqual(["manipal-payment->manipal-payment-identity-solutions"]);
  });

  it("keeps a shorter name apart when the price band differs or is unknown", () => {
    expect(planIpoMerges([
      stored({ id: "1", slug: "tata-capital", name: "Tata Capital", price_band_max: 326 }),
      stored({ id: "2", slug: "tata-capital-housing-finance", name: "Tata Capital Housing Finance", price_band_max: 210 }),
    ]).merges).toEqual([]);
    expect(planIpoMerges([
      stored({ id: "1", slug: "tata-capital", name: "Tata Capital", price_band_max: null }),
      stored({ id: "2", slug: "tata-capital-housing-finance", name: "Tata Capital Housing Finance", price_band_max: 210 }),
    ]).merges).toEqual([]);
  });

  it("keeps a one-word name apart from every longer name", () => {
    expect(planIpoMerges([
      stored({ id: "1", slug: "manipal", name: "Manipal", price_band_max: 339 }),
      stored({ id: "2", slug: "manipal-payment", name: "Manipal Payment", price_band_max: 339 }),
    ]).merges).toEqual([]);
  });

  it("resolves an incoming truncated name to the stored full-name row", () => {
    const survivors = [stored({ id: "1", slug: "manipal-payment-identity-solutions", name: "Manipal Payment and Identity Solutions", open_date: "2026-09-09", price_band_max: 339 })];
    expect(resolveSlug({ slug: "manipal-payment", name: "Manipal Payment", open_date: null, price_band_max: 339 }, survivors)).toBe("manipal-payment-identity-solutions");
  });
});

describe("preferFullName", () => {
  it("keeps a stored full name over a truncated incoming one", () => {
    expect(preferFullName("Manipal Payment", "Manipal Payment and Identity Solutions")).toBe("Manipal Payment and Identity Solutions");
  });

  it("takes the incoming name otherwise", () => {
    expect(preferFullName("Manipal Payment and Identity Solutions", "Manipal Payment")).toBe("Manipal Payment and Identity Solutions");
    expect(preferFullName("Rentomojo", null)).toBe("Rentomojo");
    expect(preferFullName("Hero Motors", "Hero MotoCorp")).toBe("Hero Motors");
  });
});
