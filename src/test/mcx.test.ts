import { describe, expect, it } from "vitest";
import { activeContracts, mcxExpiry, parseMcxBhavcopy, parseMcxFutures } from "../../supabase/functions/_shared/mcx";

// Trimmed rows of MCX's GetMarketWatch response on 1 Oct 2026.
const gold = { Symbol: "GOLD", ExpiryDate: "04DEC2026", Unit: "10 GRMS", Open: 149643, Low: 149336, LTP: 150250, High: 150739, PreviousClose: 150390, PercentChange: -0.09, Volume: 7224, OpenInterest: 15955, ValueInLacs: 1084135.91, LTTValue: "2026-10-01 23:29:58", InstrumentName: "FUTCOM" };
const goldNear = { ...gold, ExpiryDate: "05NOV2026", LTP: 149000, OpenInterest: 900 };
const option = { ...gold, InstrumentName: "OPTFUT", StrikePrice: 150000 };

describe("parseMcxFutures", () => {
  it("keeps commodity futures with the IST trade time", () => {
    const [r] = parseMcxFutures([gold, option]);
    expect(r).toMatchObject({ trade_date: "2026-10-01", symbol: "GOLD", expiry: "2026-12-04", unit: "10 GRMS", close: 150250, prev_close: 150390, change_pct: -0.09, oi: 15955, ltt: "2026-10-01T23:29:58+05:30" });
  });
  it("drops rows that are not a clean futures quote", () => {
    expect(parseMcxFutures([{ ...gold, LTP: 0 }, { ...gold, Symbol: "<script>" }, { ...gold, ExpiryDate: "Dec-26" }, { ...gold, LTTValue: "" }, null, "x"])).toEqual([]);
    expect(parseMcxFutures({ not: "rows" })).toEqual([]);
  });
});

describe("contracts", () => {
  it("reads MCX expiry dates", () => {
    expect(mcxExpiry("15OCT2026")).toBe("2026-10-15");
    expect(mcxExpiry("15XYZ2026")).toBeNull();
  });
  it("picks the contract with the most open interest", () => {
    expect(activeContracts(parseMcxFutures([goldNear, gold])).get("GOLD")?.expiry).toBe("2026-12-04");
  });
});

describe("parseMcxBhavcopy", () => {
  it("reads a bhavcopy row from 1 Oct 2026, with MM/DD/YYYY dates and padded symbols", () => {
    const [r] = parseMcxBhavcopy([{ Date: "10/01/2026", Symbol: "ALUMINI      ", ExpiryDate: "30OCT2026", Open: 340.6, High: 341.2, Low: 337, Close: 337.65, PreviousClose: 341.8, Volume: 3096, Value: 10481.59, OpenInterest: 2635, InstrumentName: "FUTCOM" }]);
    expect(r).toMatchObject({ trade_date: "2026-10-01", symbol: "ALUMINI", expiry: "2026-10-30", close: 337.65, change_pct: -1.21, oi: 2635 });
  });
});
