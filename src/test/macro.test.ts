import { describe, it, expect } from "vitest";
import { parseWorldBankIndicator, parseFrankfurterRate } from "../../supabase/functions/_shared/macro";

// Trimmed from a live probe of
// https://api.worldbank.org/v2/country/IND/indicator/FP.CPI.TOTL.ZG?format=json&per_page=100
// (2026-08-10). The live payload had no null `value` this run - the World Bank
// had already backfilled the newest year - so the 2025 row's value is edited
// to null here to cover the case the real feed hits whenever the newest year
// has not been backfilled yet, which is the normal state in production.
const cpiJson = [
  { page: 1, pages: 1, per_page: 100, total: 66, sourceid: "2", lastupdated: "2026-07-13" },
  [
    {
      indicator: { id: "FP.CPI.TOTL.ZG", value: "Inflation, consumer prices (annual %)" },
      country: { id: "IN", value: "India" },
      countryiso3code: "IND",
      date: "2025",
      value: null,
      unit: "",
      obs_status: "",
      decimal: 1,
    },
    {
      indicator: { id: "FP.CPI.TOTL.ZG", value: "Inflation, consumer prices (annual %)" },
      country: { id: "IN", value: "India" },
      countryiso3code: "IND",
      date: "2024",
      value: 4.95303550973661,
      unit: "",
      obs_status: "",
      decimal: 1,
    },
    {
      indicator: { id: "FP.CPI.TOTL.ZG", value: "Inflation, consumer prices (annual %)" },
      country: { id: "IN", value: "India" },
      countryiso3code: "IND",
      date: "2023",
      value: 5.64914318907925,
      unit: "",
      obs_status: "",
      decimal: 1,
    },
  ],
];

// Real error envelope for an unknown indicator/country - probed against
// https://api.worldbank.org/v2/country/IND/indicator/BOGUS.CODE?format=json
const worldBankErrorJson = [
  { message: [{ id: "120", key: "Invalid value", value: "The provided parameter value is not valid" }] },
];

// Real shape for a page beyond the last one - probed with
// per_page=1&page=99 against FP.CPI.TOTL.ZG - a valid two-element envelope
// whose data array is simply empty.
const worldBankEmptyPageJson = [
  { page: 99, pages: 66, per_page: 1, total: 66, sourceid: "2", lastupdated: "2026-07-13" },
  [],
];

// Probed https://api.frankfurter.app/latest?from=USD&to=INR,EUR,GBP (2026-08-10).
const frankfurterJson = {
  amount: 1.0,
  base: "USD",
  date: "2026-08-10",
  rates: { EUR: 0.86543, GBP: 0.7405, INR: 95.3 },
};

// Probed https://api.frankfurter.app/latest?from=USD&to=ZZZ - an unsupported
// currency answers 200, not 4xx.
const frankfurterNotFoundJson = { message: "not found" };

describe("parseWorldBankIndicator", () => {
  it("parses the two-element [metadata, data[]] envelope", () => {
    const rows = parseWorldBankIndicator(cpiJson);
    expect(rows).toEqual([
      { year: 2024, value: 4.95303550973661 },
      { year: 2023, value: 5.64914318907925 },
    ]);
  });

  // The behavior this parser exists for: a null `value` year must be skipped,
  // never coerced to 0 - a written 0 would read as "confirmed zero inflation"
  // rather than "no figure reported yet".
  it("skips a null value year rather than writing it as 0", () => {
    const rows = parseWorldBankIndicator(cpiJson);
    expect(rows.some((r) => r.year === 2025)).toBe(false);
    expect(rows.find((r) => r.year === 2024)?.value).not.toBe(0);
  });

  it("returns an empty array for the error envelope (unknown indicator/country)", () => {
    expect(parseWorldBankIndicator(worldBankErrorJson)).toEqual([]);
  });

  it("returns an empty array when the data page is empty", () => {
    expect(parseWorldBankIndicator(worldBankEmptyPageJson)).toEqual([]);
  });

  it("returns an empty array for malformed input", () => {
    expect(parseWorldBankIndicator(null)).toEqual([]);
    expect(parseWorldBankIndicator({})).toEqual([]);
    expect(parseWorldBankIndicator([])).toEqual([]);
    expect(parseWorldBankIndicator([{}])).toEqual([]);
  });
});

describe("parseFrankfurterRate", () => {
  it("extracts the requested quote currency's rate and date", () => {
    expect(parseFrankfurterRate(frankfurterJson, "INR")).toEqual({ date: "2026-08-10", rate: 95.3 });
  });

  it("extracts a different quote currency from the same multi-currency response", () => {
    expect(parseFrankfurterRate(frankfurterJson, "EUR")).toEqual({ date: "2026-08-10", rate: 0.86543 });
  });

  it("returns null when the requested currency is absent from rates", () => {
    expect(parseFrankfurterRate(frankfurterJson, "JPY")).toBeNull();
  });

  // Frankfurter answers an unsupported pair with 200 + {"message": "not
  // found"} rather than a 4xx, so the parser - not the HTTP status - is what
  // has to catch it.
  it("returns null for the not-found shape", () => {
    expect(parseFrankfurterRate(frankfurterNotFoundJson, "INR")).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(parseFrankfurterRate(null, "INR")).toBeNull();
    expect(parseFrankfurterRate({}, "INR")).toBeNull();
    expect(parseFrankfurterRate({ date: "2026-08-10" }, "INR")).toBeNull();
    expect(parseFrankfurterRate({ rates: { INR: 95.3 } }, "INR")).toBeNull();
  });
});
