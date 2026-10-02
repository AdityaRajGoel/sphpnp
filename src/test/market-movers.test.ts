import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { MOVER_LISTS, istDateTime, moverList } from "@/lib/market-movers";
import { MARKET_MOVER_ROUTES } from "../../scripts/lib/market-list-routes.mjs";

describe("market mover lists", () => {
  it("prerenders and lists in the sitemap exactly the pages the app serves", () => {
    expect([...MARKET_MOVER_ROUTES].sort()).toEqual(["/markets/gift-nifty", ...MOVER_LISTS.map((l) => `/markets/${l.slug}`)].sort());
  });

  it("reads only snapshot kinds that sync-market-data writes", () => {
    const sync = readFileSync("supabase/functions/sync-market-data/index.ts", "utf-8");
    for (const { kind } of MOVER_LISTS) expect(sync).toContain(`kind: "${kind}"`);
  });

  it("has one list per slug and per kind", () => {
    expect(new Set(MOVER_LISTS.map((l) => l.slug)).size).toBe(MOVER_LISTS.length);
    expect(new Set(MOVER_LISTS.map((l) => l.kind)).size).toBe(MOVER_LISTS.length);
    expect(moverList("top-gainers")?.kind).toBe("gainers");
    expect(moverList("nope")).toBeUndefined();
  });

  it("shows the time in IST whatever the visitor's clock", () => {
    expect(istDateTime("2026-09-28T10:30:00.000Z")).toMatch(/28 Sept? 2026.*4:00\s?pm/i);
    expect(istDateTime(null)).toBeNull();
  });
});
