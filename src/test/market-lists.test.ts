import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { INDEX_NAMES, indexBySlug, indexTitle, listSlug, tally } from "@/lib/market-lists";
import { assertListPageCaptured, indexNames, slugify } from "../../scripts/lib/market-list-routes.mjs";

describe("market lists", () => {
  it("lists exactly the indices sync-market-data stores", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../../supabase/functions/sync-market-data/index.ts"), "utf-8");
    const block = src.match(/const CONSTITUENT_FILES[^{]*\{([\s\S]*?)\};/)![1];
    const synced = [...block.matchAll(/"([^"]+)":/g)].map((m) => m[1]);
    expect([...INDEX_NAMES].sort()).toEqual(synced.sort());
  });

  it("gives the build script the same names and slugs as the app", () => {
    expect(indexNames()).toEqual(INDEX_NAMES);
    for (const n of INDEX_NAMES) expect(slugify(n)).toBe(listSlug(n));
  });

  it("slugs and titles an index the way NSE writes it", () => {
    expect(listSlug("NIFTY OIL & GAS")).toBe("nifty-oil-gas");
    expect(indexBySlug("nifty-oil-gas")).toBe("NIFTY OIL & GAS");
    expect(indexBySlug("nifty-51")).toBeNull();
    expect(indexTitle("NIFTY PSU BANK")).toBe("Nifty PSU Bank");
    expect(indexTitle("NIFTY OIL & GAS")).toBe("Nifty Oil & Gas");
  });

  it("tallies largest first and skips blanks", () => {
    expect(tally([{ k: "IT" }, { k: "Bank" }, { k: "IT" }, { k: null }], (x) => x.k)).toEqual([{ name: "IT", count: 2 }, { name: "Bank", count: 1 }]);
  });

  it("refuses a list page captured without rows", () => {
    expect(() => assertListPageCaptured("/indices/nifty-50", '<main data-list-state="loading"></main>')).toThrow(/skeleton/);
    expect(() => assertListPageCaptured("/indices/nifty-50", '<main data-list-state="ready"><table><tbody></tbody></table></main>')).toThrow(/no rows/);
    expect(() => assertListPageCaptured("/indices/nifty-50", '<main data-list-state="ready"><table><tbody><tr><td>1</td></tr></tbody></table></main>')).not.toThrow();
  });
});
