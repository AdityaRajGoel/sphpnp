import { describe, it, expect } from "vitest";
import { forListing, LIST_OMITTED_FIELDS } from "../../supabase/functions/_shared/ipo-payload";

/*
 * The list response carried every IPO's full prospectus sections and news:
 * 1.8 MB for 119 issues, of which `details` (968 KB) and `news` (377 KB) are
 * read only by the detail page, which asks for one slug. The VPS health check
 * timed out on it from GitHub's runners.
 */
describe("forListing", () => {
  const ipo = { slug: "acme-ltd", name: "Acme", status: "open", details: { sections: [{ title: "About", tables: [], lines: ["x"] }] }, news: [{ url: "https://e.com", source: "e" }], gmp_history: [1, 2] };

  it("drops the fields only the detail page reads", () => {
    const row = forListing(ipo);
    for (const field of LIST_OMITTED_FIELDS) expect(field in row).toBe(false);
  });

  it("keeps everything the list renders", () => {
    expect(forListing(ipo)).toMatchObject({ slug: "acme-ltd", name: "Acme", status: "open", gmp_history: [1, 2] });
  });

  it("leaves a single-slug response untouched", () => {
    expect(forListing(ipo, true)).toEqual(ipo);
  });
});
