import { describe, it, expect, vi, afterEach } from "vitest";
// Build script, not app code - but it decides which IPO pages exist for search
// engines. Before it, every /ipo URL answered crawlers with the 404 page
// (HTTP 404, noindex), which Search Console reported as indexing failed.
import { fetchIpoRoutes, assertIpoPageCaptured } from "../../scripts/lib/ipo-routes.mjs";

const respondWith = (rows: unknown) =>
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => rows })));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchIpoRoutes", () => {
  it("builds one route per catalogue slug", async () => {
    respondWith([{ slug: "rentomojo" }, { slug: "jindal-supreme" }]);
    await expect(fetchIpoRoutes()).resolves.toEqual(["/ipo/rentomojo", "/ipo/jindal-supreme"]);
  });

  it("drops a slug that is not a plain URL segment rather than writing an odd file", async () => {
    respondWith([{ slug: "ok-issue" }, { slug: "../etc" }, { slug: "" }, { slug: "Has Space" }]);
    await expect(fetchIpoRoutes()).resolves.toEqual(["/ipo/ok-issue"]);
  });

  // Fails closed, like fetchStockRoutes: a build that silently dropped every IPO
  // page would put the 404s straight back.
  it("throws on an empty catalogue", async () => {
    respondWith([]);
    await expect(fetchIpoRoutes()).rejects.toThrow(/refusing to build an incomplete site/i);
  });

  it("throws when the catalogue fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503, json: async () => [] })));
    await expect(fetchIpoRoutes()).rejects.toThrow(/HTTP 503/);
  });
});

describe("assertIpoPageCaptured", () => {
  const ready = '<main data-ipo-state="ready"><meta name="robots" content="index, follow"></main>';

  it("accepts a page captured with its data and indexable", () => {
    expect(() => assertIpoPageCaptured("/ipo/rentomojo", ready)).not.toThrow();
  });

  it("refuses a page captured while still loading", () => {
    expect(() => assertIpoPageCaptured("/ipo/rentomojo", '<main data-ipo-state="loading"></main>'))
      .toThrow(/refusing to ship/i);
  });

  it("refuses a page carrying noindex", () => {
    // The detail page is noindex until its IPO has loaded, so a capture taken
    // too early would bake noindex into the file Google reads.
    expect(() => assertIpoPageCaptured("/ipo/rentomojo", '<main data-ipo-state="ready"><meta name="robots" content="noindex, nofollow"></main>'))
      .toThrow(/noindex/i);
  });
});
