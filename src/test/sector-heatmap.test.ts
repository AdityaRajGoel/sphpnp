import { describe, it, expect } from "vitest";
import { heatStep, sectorTiles } from "@/lib/sector-heatmap";

const s = (sector: string, market_cap: number, change_pct: number) => ({ sector, market_cap, change_pct });

describe("sector heatmap", () => {
  it("weights each sector's change by market value and sorts the largest first", () => {
    const tiles = sectorTiles([s("Banks", 300, 1), s("Banks", 100, -3), s("IT", 500, 0.5)]);
    expect(tiles.map((t) => t.name)).toEqual(["IT", "Banks"]);
    expect(tiles[1]).toMatchObject({ slug: "banks", cap: 400, count: 2 });
    expect(tiles[1].changePct).toBeCloseTo(0, 10); // (300*1 + 100*-3) / 400
  });

  it("leaves out stocks with no sector, no market value or no change", () => {
    const tiles = sectorTiles([s("General", 100, 1), s("", 100, 1), s("Auto", 0, 1), s("Auto", 100, Number.NaN), s("Auto", 50, 2)]);
    expect(tiles).toEqual([{ name: "Auto", slug: "auto", cap: 50, changePct: 2, count: 1 }]);
  });

  it("bins a change into a signed colour step, with a neutral band around zero", () => {
    expect([-2.5, -1.2, -0.4, -0.1, 0, 0.2, 0.6, 1.5, 4].map((v) => heatStep(v))).toEqual([-3, -2, -1, 0, 0, 0, 1, 2, 3]);
  });
});
