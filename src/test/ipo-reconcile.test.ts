import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { reconcileIpos, FIELD_PRECEDENCE } from "../../supabase/functions/_shared/ipo-reconcile";
import {
  parseIpoWatch,
  parseInvestorGain,
  parseChittorgarh,
} from "../../supabase/functions/_shared/ipo-parse";

/*
 * Reconciliation across the three IPO sources.
 *
 * The point of three sources is that no single site's layout change can
 * silently corrupt the page - which is exactly what happened with the
 * single-source parser. So the rules under test here are about *disagreement*:
 * who wins per field, what happens when a source is missing entirely, and the
 * standing rule that a null must never overwrite a value another source
 * supplied.
 */

// Repo-root-relative, matching unlisted-sources.test.ts: vitest runs from the
// project root, and neither __dirname (no node types in this tsconfig) nor
// import.meta.url (resolves against vitest's dev server, not the filesystem)
// gives a usable path here.
const fixture = (name: string) =>
  readFileSync(`src/test/fixtures/ipo/${name}`, "utf-8");

const ipowatch = () => parseIpoWatch(fixture("ipowatch-gmp-tables.html"));
const investorgain = () => parseInvestorGain(fixture("investorgain-report-table.html"));
const chittorgarh = () => [
  ...parseChittorgarh(fixture("chittorgarh-mainboard.html"), "mainboard").rows,
  ...parseChittorgarh(fixture("chittorgarh-sme.html"), "sme").rows,
];

describe("source parsers against real captured markup", () => {
  it("reads rows from every source", () => {
    // Not asserting exact counts: these are live captures and the number of
    // open IPOs is not a property of the parser. What matters is that each
    // parser found the table at all - a zero here is the signature of the
    // layout drift that broke the original.
    expect(ipowatch().rows.length).toBeGreaterThan(0);
    expect(investorgain().rows.length).toBeGreaterThan(0);
    expect(chittorgarh().length).toBeGreaterThan(0);
  });
});

describe("reconcileIpos", () => {
  const base = {
    slug: "acme-industries",
    name: "Acme Industries",
    board: "mainboard" as const,
    status: "open" as const,
  };

  it("prefers chittorgarh over ipowatch for issue facts", () => {
    const merged = reconcileIpos({
      ipowatch: [{ ...base, price_band_min: 90, price_band_max: 95, open_date: null, close_date: null, gmp: 10, est_listing_price: null }],
      investorgain: [],
      chittorgarh: [{ ...base, price_band_min: 100, price_band_max: 105, open_date: "2026-09-10", close_date: "2026-09-12", listing_date: "2026-09-17", issue_size_crore: 500 , detail_url: null }],
    });

    const row = merged.find((r) => r.slug === "acme-industries")!;
    expect(row.price_band_min).toBe(100);
    expect(row.field_sources.price_band_min).toBe("chittorgarh");
    expect(row.listing_date).toBe("2026-09-17");
  });

  it("falls back to a lower-precedence source when the preferred one is silent", () => {
    // A null from the preferred source is an absence, not an answer. Letting it
    // win would reproduce the exact defect the multi-source design exists to
    // prevent: one site going quiet blanking a field the others still know.
    const merged = reconcileIpos({
      ipowatch: [{ ...base, price_band_min: 90, price_band_max: 95, open_date: "2026-09-10", close_date: "2026-09-12", gmp: 10, est_listing_price: null }],
      investorgain: [],
      chittorgarh: [{ ...base, price_band_min: null, price_band_max: null, open_date: null, close_date: null, listing_date: null, issue_size_crore: null , detail_url: null }],
    });

    const row = merged.find((r) => r.slug === "acme-industries")!;
    expect(row.price_band_min).toBe(90);
    expect(row.field_sources.price_band_min).toBe("ipowatch");
  });

  it("takes lot size and issue size from investorgain when chittorgarh lacks them", () => {
    const merged = reconcileIpos({
      ipowatch: [],
      investorgain: [{ ...base, gmp: 12, lot_size: 100, issue_size_crore: 250 }],
      chittorgarh: [],
    });

    const row = merged.find((r) => r.slug === "acme-industries")!;
    expect(row.lot_size).toBe(100);
    expect(row.field_sources.lot_size).toBe("investorgain");
  });

  it("surfaces an IPO seen by only one source", () => {
    const merged = reconcileIpos({
      ipowatch: [],
      investorgain: [],
      chittorgarh: [{ ...base, slug: "solo-issue", name: "Solo Issue", price_band_min: 10, price_band_max: 12, open_date: null, close_date: null, listing_date: null, issue_size_crore: null , detail_url: null }],
    });
    expect(merged.map((r) => r.slug)).toContain("solo-issue");
  });

  it("keeps every field null when no source knows it, rather than inventing one", () => {
    const merged = reconcileIpos({
      ipowatch: [{ ...base, price_band_min: null, price_band_max: null, open_date: null, close_date: null, gmp: null, est_listing_price: null }],
      investorgain: [],
      chittorgarh: [],
    });

    const row = merged.find((r) => r.slug === "acme-industries")!;
    expect(row.lot_size).toBeNull();
    expect(row.listing_date).toBeNull();
    expect(row.field_sources.lot_size).toBeUndefined();
  });

  it("survives a source returning nothing at all", () => {
    // One site being down or restructured must degrade the page, never empty it.
    const merged = reconcileIpos({ ipowatch: ipowatch().rows, investorgain: [], chittorgarh: [] });
    expect(merged.length).toBeGreaterThan(0);
  });

  it("merges the real captures from all three sources without throwing", () => {
    const merged = reconcileIpos({
      ipowatch: ipowatch().rows,
      investorgain: investorgain().rows,
      chittorgarh: chittorgarh(),
    });

    expect(merged.length).toBeGreaterThan(0);
    for (const row of merged) {
      expect(row.slug).toBeTruthy();
      expect(row.name).toBeTruthy();
      expect(["mainboard", "sme"]).toContain(row.board);
      expect(["upcoming", "open", "closed", "listed"]).toContain(row.status);
    }
  });

  it("documents a precedence for every reconciled field", () => {
    // A field with no declared precedence would silently take whichever source
    // happened to be merged last - order-dependent and untraceable.
    for (const [field, order] of Object.entries(FIELD_PRECEDENCE)) {
      expect(order.length, `${field} has no declared source order`).toBeGreaterThan(0);
    }
  });
});
