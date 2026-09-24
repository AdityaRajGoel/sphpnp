import { describe, it, expect } from "vitest";
import { DOWNLOAD_SECTIONS, LANGUAGE_PACKS, filterDownloads } from "@/data/downloads";

describe("filterDownloads", () => {
  it("returns every section for an empty query", () => {
    expect(filterDownloads(DOWNLOAD_SECTIONS, "  ")).toBe(DOWNLOAD_SECTIONS);
  });

  it("matches titles case-insensitively and drops empty sections", () => {
    const hits = filterDownloads(DOWNLOAD_SECTIONS, "NOMINATION");
    expect(hits.map((s) => s.id)).toEqual(["demat"]);
    expect(hits[0].items.every((i) => /nomination/i.test(i.title))).toBe(true);
  });

  it("finds nothing for nonsense", () => {
    expect(filterDownloads(DOWNLOAD_SECTIONS, "zzzz")).toEqual([]);
  });
});

describe("download links", () => {
  const all = [...DOWNLOAD_SECTIONS.flatMap((s) => s.items.map((i) => i.href)), ...LANGUAGE_PACKS.flatMap((g) => g.packs.map((p) => p.href))];

  it("are https and unique", () => {
    expect(all.every((h) => h.startsWith("https://"))).toBe(true);
    expect(new Set(all).size).toBe(all.length);
  });

  it("never include the parent site's one dead file", () => {
    expect(all.some((h) => h.includes("/admin/downloads/"))).toBe(false);
  });
});
