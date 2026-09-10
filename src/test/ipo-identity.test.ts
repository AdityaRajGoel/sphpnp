import { describe, it, expect } from "vitest";
import { ipoMatchKey, parseChittorgarh } from "../../supabase/functions/_shared/ipo-parse";
import { reconcileIpos } from "../../supabase/functions/_shared/ipo-reconcile";
import { planIpoMerges, resolveSlug, type StoredIpo } from "../../supabase/functions/_shared/ipo-identity";

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
        listing_date: "2026-09-15", issue_size_crore: 50,
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
  listing_price: null, listing_gain_pct: null,
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
