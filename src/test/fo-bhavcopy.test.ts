import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildUp, parseFoBhavcopy, summariseUnderlyings, unzipFirstFile } from "../../supabase/functions/_shared/fo-bhavcopy";

/*
 * NSE's F&O bhavcopy for 10 Sep 2026, trimmed to NIFTY and RELIANCE. The real
 * file (~34,000 contracts, 1 MB zipped) must parse inside an edge worker's
 * CPU limit, which is why the parser splits lines rather than scanning quotes.
 */

const csv = readFileSync("src/test/fixtures/nse-market/fo_bhavcopy_sample.csv", "utf-8");

describe("unzipFirstFile", () => {
  it("reads the CSV out of the zip NSE serves", async () => {
    const text = await unzipFirstFile(new Uint8Array(readFileSync("src/test/fixtures/nse-market/fo_bhavcopy_sample.zip")));
    expect(text).toBe(csv);
  });

  it("refuses something that is not a zip", async () => {
    await expect(unzipFirstFile(new TextEncoder().encode("<html>not found</html>"))).rejects.toThrow(/not a zip/);
  });
});

describe("parseFoBhavcopy", () => {
  const contracts = parseFoBhavcopy(csv);

  it("reads futures and options with strike, side, OI and its change", () => {
    const call = contracts.find((c) => c.symbol === "RELIANCE" && c.option === "CE")!;
    expect(call).toMatchObject({ type: "STO", expiry: "2026-09-29", tradeDate: "2026-09-10" });
    expect(call.strike).toBeGreaterThan(0);
    expect(contracts.some((c) => c.type === "STF" && c.symbol === "RELIANCE")).toBe(true);
  });
});

describe("summariseUnderlyings", () => {
  const snaps = summariseUnderlyings(parseFoBhavcopy(csv));

  it("summarises each underlying's nearest expiry and near-month future", () => {
    expect(snaps.map((s) => s.symbol)).toEqual(["NIFTY", "RELIANCE"]);
    const nifty = snaps[0];
    expect(nifty).toMatchObject({ trade_date: "2026-09-10", expiry: "2026-09-15" });
    expect(nifty.pcr).toBeGreaterThan(0);
    expect(nifty.max_pain).not.toBeNull();
    expect(nifty.strikes.length).toBeLessThanOrEqual(41);
    const rel = snaps[1];
    expect(rel.expiry).toBe("2026-09-29");
    expect(rel.fut_oi).toBeGreaterThan(0);
    expect(["long_buildup", "short_buildup", "short_covering", "long_unwinding", "neutral"]).toContain(rel.build_up);
  });
});

describe("buildUp", () => {
  it("reads positioning from price and open-interest change", () => {
    expect(buildUp(1.2, 4)).toBe("long_buildup");
    expect(buildUp(-1.2, 4)).toBe("short_buildup");
    expect(buildUp(1.2, -4)).toBe("short_covering");
    expect(buildUp(-1.2, -4)).toBe("long_unwinding");
    expect(buildUp(0.01, 4)).toBe("neutral");
    expect(buildUp(null, 4)).toBe("neutral");
  });
});
