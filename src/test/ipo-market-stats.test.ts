import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { ipoStats } from "@/components/ipo/IpoMarketStats";
import type { Ipo } from "@/lib/ipo";

const ipo = (over: Partial<Ipo>): Ipo => ({
  id: over.slug ?? "x", slug: "x", name: "X", board: "mainboard", type: "Mainboard", status: "listed",
  price_band_min: 90, price_band_max: 100, price: "₹90-100", lot_size: 150, issue_size_crore: null, size: "",
  open_date: null, close_date: null, date: "", allotment_date: null, listing_date: null, registrar: null, rhp_url: null, drhp_url: null,
  subscription_qib: null, subscription_nii: null, subscription_retail: null, listing_price: null, listing_gain_pct: null,
  source: "test", source_url: null, data_as_of: "2026-09-14T00:00:00Z", gmp: null, est_listing_price: null, gmp_history: [], field_sources: null,
  detail_url: null, min_investment: null, min_investment_lots: null, min_investment_shares: null, min_investment_category: null, face_value: null,
  issue_type: null, sale_type: null, listing_exchanges: null, fresh_issue_crore: null, ofs_crore: null, refund_date: null, credit_date: null,
  lead_managers: null, promoter_holding_pre: null, promoter_holding_post: null, details: null, details_source: null, details_fetched_at: null,
  subscription_total: null, subscription_employee: null, subscription_categories: null, subscription_as_of: null, documents: null, news: null,
  news_fetched_at: null, ...over,
});

describe("ipoStats", () => {
  const today = "2026-09-14";

  it("counts listings and money raised without needing a recorded listing gain", () => {
    const s = ipoStats([
      ipo({ slug: "a", listing_date: "2026-07-21", issue_size_crore: 126 }),
      ipo({ slug: "b", listing_date: "2026-08-01", issue_size_crore: 450 }),
      ipo({ slug: "c", listing_date: "2025-12-01", issue_size_crore: 999 }),
    ], today);
    expect(s.listedThisYear).toHaveLength(2);
    expect(s.raisedCr).toBe(576);
    expect(s.withGain).toBe(0);
    expect(s.avgListingGain).toBeNull();
    expect(s.best).toBeNull();
  });

  it("averages and ranks only the gains that exist", () => {
    const s = ipoStats([
      ipo({ slug: "a", name: "A", listing_date: "2026-07-21", listing_gain_pct: 20 }),
      ipo({ slug: "b", name: "B", listing_date: "2026-08-01", listing_gain_pct: -10 }),
      ipo({ slug: "c", name: "C", listing_date: "2026-08-02" }),
    ], today);
    expect(s.withGain).toBe(2);
    expect(s.avgListingGain).toBe(5);
    expect(s.positiveListings).toBe(1);
    expect(s.best!.name).toBe("A");
    expect(s.worst!.name).toBe("B");
  });

  it("finds open issues closing within two days and averages their GMP", () => {
    const s = ipoStats([
      ipo({ slug: "o1", status: "open", close_date: "2026-09-15", gmp: 10 }),
      ipo({ slug: "o2", status: "open", close_date: "2026-09-20", gmp: 30 }),
      ipo({ slug: "u", status: "upcoming" }),
    ], today);
    expect(s.open).toBe(2);
    expect(s.upcoming).toBe(1);
    expect(s.closingSoon.map((i) => i.slug)).toEqual(["o1"]);
    expect(s.avgOpenGmpPct).toBeCloseTo(20, 10);
  });
});
