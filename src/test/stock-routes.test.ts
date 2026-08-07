import { describe, it, expect, vi, afterEach } from "vitest";
// Build scripts, not app code - but they gate the sitemap and the 159
// prerendered stock pages, so they are on the deploy critical path and belong
// under the same vitest run as everything else.
import { fetchStockRoutes } from "../../scripts/lib/stock-routes.mjs";
import { routeToFilePath } from "../../scripts/lib/route-paths.mjs";

const respondWith = (rows: unknown) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => rows })),
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchStockRoutes", () => {
  it("percent-encodes a symbol containing an ampersand", async () => {
    respondWith([{ symbol: "M&M" }, { symbol: "M&MFIN" }, { symbol: "RELIANCE" }]);
    await expect(fetchStockRoutes()).resolves.toEqual([
      "/stock/M%26M",
      "/stock/M%26MFIN",
      "/stock/RELIANCE",
    ]);
  });

  it("uppercases and trims symbols", async () => {
    respondWith([{ symbol: " reliance " }]);
    await expect(fetchStockRoutes()).resolves.toEqual(["/stock/RELIANCE"]);
  });

  // Fails closed. Returning [] would ship a sitemap and a dist/ with every
  // stock page missing, and nothing in the build output would say so.
  it("throws on an empty universe rather than returning no routes", async () => {
    respondWith([]);
    await expect(fetchStockRoutes()).rejects.toThrow(/refusing to build an incomplete site/i);
  });

  it("throws when the universe fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, json: async () => [] })),
    );
    await expect(fetchStockRoutes()).rejects.toThrow(/HTTP 503/);
  });
});

describe("routeToFilePath", () => {
  it("writes the decoded filename a static host will look for", () => {
    // The bug: the encoded route was used verbatim as the filename, so
    // dist/stock/M%26M.html existed while /stock/M%26M resolved to M&M.html.
    expect(routeToFilePath("/stock/M%26M")).toBe("stock/M&M.html");
  });

  it("round-trips every route the sitemap advertises", async () => {
    respondWith([{ symbol: "M&M" }, { symbol: "RELIANCE" }]);
    const routes = await fetchStockRoutes();
    expect(routes.map(routeToFilePath)).toEqual([
      "stock/M&M.html",
      "stock/RELIANCE.html",
    ]);
  });

  it("maps the site root to index.html", () => {
    expect(routeToFilePath("/")).toBe("index.html");
  });

  it("keeps nested routes nested", () => {
    expect(routeToFilePath("/learn/recommendations")).toBe("learn/recommendations.html");
  });

  it("refuses a segment that decodes into a path separator", () => {
    expect(() => routeToFilePath("/stock/A%2F..%2Fetc")).toThrow(/unsafe path segment/);
  });

  it("refuses invalid percent-encoding rather than guessing", () => {
    expect(() => routeToFilePath("/stock/%E0%A4")).toThrow(/invalid percent-encoding/);
  });
});
