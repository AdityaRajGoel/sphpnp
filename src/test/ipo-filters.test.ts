import { describe, it, expect } from "vitest";
import {
  DEFAULT_FILTERS,
  GMP_BAND_OPTIONS,
  MAX_COMPARE,
  compareSlugsToParam,
  filterIpos,
  ipoFiltersFromSearchParams,
  ipoFiltersToSearchParams,
  matchesListingWindow,
  parseCompareSlugs,
  sortIpos,
  toggleCompareSlug,
  trackerTab,
  type IpoFilters,
} from "@/lib/ipo-filters";
import type { Ipo } from "@/lib/ipo";

/*
 * IPO hub filtering, sorting and URL persistence.
 *
 * The rule under test throughout: a missing figure (null lot_size, null gmp,
 * null listing_date) must never be treated as zero or as the smallest/largest
 * value — it must be excluded from bands that require a value, and sorted to
 * the end rather than to either extreme.
 */

const makeIpo = (overrides: Partial<Ipo>): Ipo => ({
  id: overrides.slug ?? "id",
  slug: "acme",
  name: "Acme Industries",
  board: "mainboard",
  type: "Mainboard",
  status: "open",
  price_band_min: 100,
  price_band_max: 110,
  price: "₹100–110",
  lot_size: 100,
  issue_size_crore: 500,
  size: "₹500 Cr",
  open_date: "2026-09-10",
  close_date: "2026-09-12",
  date: "10 Sep 2026 – 12 Sep 2026",
  allotment_date: null,
  listing_date: "2026-09-17",
  registrar: null,
  rhp_url: null,
  drhp_url: null,
  subscription_qib: null,
  subscription_nii: null,
  subscription_retail: null,
  listing_price: null,
  listing_gain_pct: null,
  source: "chittorgarh",
  source_url: null,
  data_as_of: "2026-09-10T00:00:00Z",
  gmp: 50,
  est_listing_price: null,
  gmp_history: [],
  field_sources: null,
  detail_url: null, min_investment: null, min_investment_lots: null, min_investment_shares: null,
  min_investment_category: null, face_value: null, issue_type: null, sale_type: null, listing_exchanges: null,
  fresh_issue_crore: null, ofs_crore: null, refund_date: null, credit_date: null, lead_managers: null,
  promoter_holding_pre: null, promoter_holding_post: null, details: null, details_source: null, details_fetched_at: null,
  subscription_total: null, subscription_employee: null, subscription_categories: null, subscription_as_of: null,
  ...overrides,
});

describe("filterIpos", () => {
  it("returns every current row when filters are all 'all'", () => {
    const ipos = [makeIpo({ slug: "a" }), makeIpo({ slug: "b", status: "listed" })];
    expect(filterIpos(ipos, DEFAULT_FILTERS, new Date("2026-09-10T06:00:00Z"))).toHaveLength(2);
  });

  describe("long-listed issues", () => {
    // The hub is a calendar of live issues. With every status filter at "all",
    // an issue that listed back in April is history, not news - it buried the
    // open and upcoming issues a visitor came for.
    const now = new Date("2026-09-10T06:00:00Z");
    const ipos = [
      makeIpo({ slug: "april", status: "listed", open_date: "2026-04-01", close_date: "2026-04-03", listing_date: "2026-04-08" }),
      makeIpo({ slug: "last-week", status: "listed", open_date: "2026-08-28", close_date: "2026-09-01", listing_date: "2026-09-04" }),
      makeIpo({ slug: "undated", status: "listed", open_date: null, close_date: null, listing_date: null }),
      makeIpo({ slug: "open", status: "open" }),
    ];

    it("drops issues listed more than 30 days ago from the default view", () => {
      expect(filterIpos(ipos, DEFAULT_FILTERS, now).map((i) => i.slug)).toEqual(["last-week", "open"]);
    });

    it("keeps the full archive when a visitor asks for listed issues", () => {
      expect(filterIpos(ipos, { ...DEFAULT_FILTERS, status: "listed" }, now)).toHaveLength(3);
      expect(filterIpos(ipos, { ...DEFAULT_FILTERS, listingWindow: "past" }, now).map((i) => i.slug))
        .toEqual(["april", "last-week"]);
    });

    it("falls back to the close date when a listed issue has no listing date", () => {
      const noListingDate = makeIpo({ slug: "x", status: "listed", close_date: "2026-09-02", listing_date: null });
      expect(filterIpos([noListingDate], DEFAULT_FILTERS, now)).toHaveLength(1);
    });
  });

  it("filters by status", () => {
    const ipos = [makeIpo({ slug: "a", status: "open" }), makeIpo({ slug: "b", status: "closed" })];
    const filters: IpoFilters = { ...DEFAULT_FILTERS, status: "closed" };
    expect(filterIpos(ipos, filters).map((i) => i.slug)).toEqual(["b"]);
  });

  it("filters by board", () => {
    const ipos = [makeIpo({ slug: "a", board: "mainboard" }), makeIpo({ slug: "b", board: "sme" })];
    const filters: IpoFilters = { ...DEFAULT_FILTERS, board: "sme" };
    expect(filterIpos(ipos, filters).map((i) => i.slug)).toEqual(["b"]);
  });

  it("treats a null GMP as its own band, not as zero or as 'below par'", () => {
    const ipos = [makeIpo({ slug: "no-gmp", gmp: null }), makeIpo({ slug: "zero-gmp", gmp: 0 }), makeIpo({ slug: "has-gmp", gmp: 30 })];
    const awaited: IpoFilters = { ...DEFAULT_FILTERS, gmpBand: "awaited" };
    expect(filterIpos(ipos, awaited).map((i) => i.slug)).toEqual(["no-gmp"]);

    const belowPar: IpoFilters = { ...DEFAULT_FILTERS, gmpBand: "negative" };
    expect(filterIpos(ipos, belowPar).map((i) => i.slug)).toEqual(["zero-gmp"]);
  });

  it("buckets GMP bands correctly at the boundaries", () => {
    const modest = GMP_BAND_OPTIONS.find((o) => o.id === "modest")!;
    const strong = GMP_BAND_OPTIONS.find((o) => o.id === "strong")!;
    const hot = GMP_BAND_OPTIONS.find((o) => o.id === "hot")!;
    expect(modest.test(50)).toBe(true);
    expect(modest.test(51)).toBe(false);
    expect(strong.test(51)).toBe(true);
    expect(strong.test(150)).toBe(true);
    expect(hot.test(150)).toBe(false);
    expect(hot.test(151)).toBe(true);
  });

  it("excludes IPOs with no listing_date from any specific listing window", () => {
    const ipos = [makeIpo({ slug: "unknown", listing_date: null })];
    const now = new Date("2026-09-10T00:00:00Z");
    for (const window of ["past", "next7", "next30", "later"] as const) {
      expect(filterIpos(ipos, { ...DEFAULT_FILTERS, listingWindow: window }, now)).toHaveLength(0);
    }
    // But "all" still includes it — the absence isn't hidden by default.
    expect(filterIpos(ipos, DEFAULT_FILTERS, now)).toHaveLength(1);
  });

  it("buckets listing windows relative to now", () => {
    const now = new Date("2026-09-10T00:00:00Z");
    expect(matchesListingWindow("2026-09-05", "past", now)).toBe(true);
    expect(matchesListingWindow("2026-09-15", "next7", now)).toBe(true);
    expect(matchesListingWindow("2026-09-25", "next7", now)).toBe(false);
    expect(matchesListingWindow("2026-09-25", "next30", now)).toBe(true);
    expect(matchesListingWindow("2026-11-01", "later", now)).toBe(true);
    expect(matchesListingWindow("2026-11-01", "next30", now)).toBe(false);
  });

  it("combines multiple active filters with AND", () => {
    const ipos = [
      makeIpo({ slug: "match", board: "sme", status: "open", gmp: 80 }),
      makeIpo({ slug: "wrong-board", board: "mainboard", status: "open", gmp: 80 }),
      makeIpo({ slug: "wrong-status", board: "sme", status: "closed", gmp: 80 }),
    ];
    const filters: IpoFilters = { status: "open", board: "sme", gmpBand: "strong", listingWindow: "all" };
    expect(filterIpos(ipos, filters).map((i) => i.slug)).toEqual(["match"]);
  });
});

describe("sortIpos", () => {
  it("sorts a numeric field ascending and descending", () => {
    const ipos = [makeIpo({ slug: "a", issue_size_crore: 300 }), makeIpo({ slug: "b", issue_size_crore: 900 }), makeIpo({ slug: "c", issue_size_crore: 100 })];
    expect(sortIpos(ipos, "issue_size_crore", "asc").map((i) => i.slug)).toEqual(["c", "a", "b"]);
    expect(sortIpos(ipos, "issue_size_crore", "desc").map((i) => i.slug)).toEqual(["b", "a", "c"]);
  });

  it("always sorts missing lot_size to the end, in both directions", () => {
    const ipos = [makeIpo({ slug: "known", lot_size: 50 }), makeIpo({ slug: "unknown", lot_size: null }), makeIpo({ slug: "known2", lot_size: 10 })];
    const asc = sortIpos(ipos, "lot_size", "asc");
    const desc = sortIpos(ipos, "lot_size", "desc");
    expect(asc[asc.length - 1].slug).toBe("unknown");
    expect(desc[desc.length - 1].slug).toBe("unknown");
  });

  it("sorts by name case-insensitively", () => {
    const ipos = [makeIpo({ slug: "a", name: "zeta" }), makeIpo({ slug: "b", name: "Alpha" })];
    expect(sortIpos(ipos, "name", "asc").map((i) => i.slug)).toEqual(["b", "a"]);
  });

  it("does not mutate the input array", () => {
    const ipos = [makeIpo({ slug: "a", issue_size_crore: 300 }), makeIpo({ slug: "b", issue_size_crore: 100 })];
    const original = [...ipos];
    sortIpos(ipos, "issue_size_crore", "asc");
    expect(ipos).toEqual(original);
  });
});

describe("lifecycle order (the hub default)", () => {
  it("puts open first, then upcoming, closed and listed, each by its most relevant date", () => {
    const ipos = [
      makeIpo({ slug: "listed-old", status: "listed", listing_date: "2026-08-20" }),
      makeIpo({ slug: "upcoming-late", status: "upcoming", open_date: "2026-09-20" }),
      makeIpo({ slug: "listed-new", status: "listed", listing_date: "2026-09-08" }),
      makeIpo({ slug: "closed", status: "closed", listing_date: "2026-09-12" }),
      makeIpo({ slug: "upcoming-soon", status: "upcoming", open_date: "2026-09-12" }),
      makeIpo({ slug: "open-closing-later", status: "open", close_date: "2026-09-15" }),
      makeIpo({ slug: "open-closing-soon", status: "open", close_date: "2026-09-11" }),
    ];
    expect(sortIpos(ipos, "status", "asc").map((i) => i.slug)).toEqual([
      "open-closing-soon", "open-closing-later",
      "upcoming-soon", "upcoming-late",
      "closed",
      // Most recent listing first: last week's listing is what "listed" means
      // to a visitor, not the oldest one on record.
      "listed-new", "listed-old",
    ]);
  });
});

describe("trackerTab (homepage)", () => {
  const now = new Date("2026-09-10T06:00:00Z");

  it("limits Recently Listed to the last 30 days, newest first", () => {
    const ipos = [
      makeIpo({ slug: "april", status: "listed", listing_date: "2026-04-08" }),
      makeIpo({ slug: "sep-4", status: "listed", listing_date: "2026-09-04" }),
      makeIpo({ slug: "sep-8", status: "listed", listing_date: "2026-09-08" }),
      makeIpo({ slug: "open", status: "open" }),
    ];
    expect(trackerTab(ipos, "listed", now).map((i) => i.slug)).toEqual(["sep-8", "sep-4"]);
  });

  it("orders upcoming issues by when they open", () => {
    const ipos = [
      makeIpo({ slug: "later", status: "upcoming", open_date: "2026-09-18" }),
      makeIpo({ slug: "sooner", status: "upcoming", open_date: "2026-09-11" }),
    ];
    expect(trackerTab(ipos, "upcoming", now).map((i) => i.slug)).toEqual(["sooner", "later"]);
  });
});

describe("URL persistence", () => {
  it("round-trips filters through search params", () => {
    const filters: IpoFilters = { status: "open", board: "sme", gmpBand: "hot", listingWindow: "next7" };
    const params = ipoFiltersToSearchParams(filters);
    expect(ipoFiltersFromSearchParams(params)).toEqual(filters);
  });

  it("omits default values from the URL", () => {
    const params = ipoFiltersToSearchParams(DEFAULT_FILTERS);
    expect([...params.keys()]).toEqual([]);
  });

  it("falls back to defaults for unrecognised or missing params", () => {
    const params = new URLSearchParams("status=bogus&gmp=nonsense");
    expect(ipoFiltersFromSearchParams(params)).toEqual(DEFAULT_FILTERS);
  });
});

describe("compare selection", () => {
  it("adds a slug, then removes it on a second toggle", () => {
    let selection = toggleCompareSlug([], "acme");
    expect(selection).toEqual(["acme"]);
    selection = toggleCompareSlug(selection, "acme");
    expect(selection).toEqual([]);
  });

  it("refuses to add beyond the max", () => {
    const full = ["a", "b", "c", "d"];
    expect(full).toHaveLength(MAX_COMPARE);
    expect(toggleCompareSlug(full, "e")).toEqual(full);
  });

  it("parses and caps a comma-separated URL param", () => {
    expect(parseCompareSlugs("a,b,b, c ,d,e")).toEqual(["a", "b", "c", "d"]);
    expect(parseCompareSlugs(null)).toEqual([]);
    expect(parseCompareSlugs("")).toEqual([]);
  });

  it("serialises an empty selection to undefined so it drops from the URL", () => {
    expect(compareSlugsToParam([])).toBeUndefined();
    expect(compareSlugsToParam(["a", "b"])).toBe("a,b");
  });
});

describe("sorting by GMP % and subscription", () => {
  it("ranks by GMP relative to the issue price, not by rupee GMP", () => {
    // Rs 50 on a Rs 1,000 issue is 5%; Rs 20 on a Rs 50 issue is 40%.
    const ipos = [
      makeIpo({ slug: "big-rupees", gmp: 50, price_band_max: 1000 }),
      makeIpo({ slug: "big-percent", gmp: 20, price_band_max: 50 }),
      makeIpo({ slug: "unquoted", gmp: null, price_band_max: 100 }),
    ];
    expect(sortIpos(ipos, "gmp_pct", "desc").map((i) => i.slug)).toEqual(["big-percent", "big-rupees", "unquoted"]);
  });

  it("puts issues not yet bid on after subscribed ones, in both directions", () => {
    const ipos = [
      makeIpo({ slug: "none", subscription_total: null }),
      makeIpo({ slug: "hot", subscription_total: 173.17 }),
      makeIpo({ slug: "cold", subscription_total: 0.29 }),
    ];
    expect(sortIpos(ipos, "subscription_total", "desc").map((i) => i.slug)).toEqual(["hot", "cold", "none"]);
    expect(sortIpos(ipos, "subscription_total", "asc").map((i) => i.slug)).toEqual(["cold", "hot", "none"]);
  });
});
