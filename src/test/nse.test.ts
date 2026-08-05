import { describe, it, expect, vi, afterEach } from "vitest";
import {
  toIsoDate,
  fetchFilingRegistry,
  fetchXbrl,
  fetchCorporateActions,
  classifyActions,
  extractActionValue,
} from "../../supabase/functions/_shared/nse";

describe("toIsoDate", () => {
  it("converts an NSE date to ISO", () => {
    expect(toIsoDate("01-Oct-2024")).toBe("2024-10-01");
  });

  it("handles a date with a trailing time", () => {
    expect(toIsoDate("16-Jan-2025 20:20")).toBe("2025-01-16");
  });

  it("returns null for an unparseable value", () => {
    expect(toIsoDate("")).toBeNull();
    expect(toIsoDate("not a date")).toBeNull();
  });
});

// --- Mock fetch helpers -----------------------------------------------

function okJsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function okTextResponse(body: string): Response {
  return {
    ok: true,
    status: 200,
    json: async () => JSON.parse(body),
    text: async () => body,
  } as unknown as Response;
}

function errorResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => "",
  } as unknown as Response;
}

function baseFilingRow(
  overrides: Partial<Record<string, string>> = {},
): Record<string, string> {
  return {
    fromDate: "01-Oct-2024",
    toDate: "31-Dec-2024",
    period: "Quarterly",
    consolidated: "Consolidated",
    audited: "Audited",
    xbrl: "https://nsearchives.nseindia.com/corporate/xbrl/RELIANCE_Q3FY25.xml",
    filingDate: "05-Nov-2024",
    ...overrides,
  };
}

function baseActionRow(
  overrides: Partial<Record<string, string>> = {},
): Record<string, string> {
  return {
    exDate: "01-Oct-2024",
    recDate: "01-Oct-2024",
    subject: "Dividend - Rs 10 Per Share",
    ...overrides,
  };
}

// --- nseGet retry policy, exercised via fetchFilingRegistry / fetchXbrl ---
//
// These assert call COUNT, not just outcome: NSE is the exchange's own
// public endpoint, not an API sold to us, so an assertion that only checks
// the returned value would still pass if the retry policy hammered the
// server with extra requests. Fake timers keep the 3s retry sleep from
// actually costing the suite 3 real seconds.

describe("nseGet retry policy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("retries exactly once after a 5xx and returns the result if the retry succeeds", async () => {
    vi.useFakeTimers();
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(okJsonResponse([]));
    vi.stubGlobal("fetch", mockFetch);

    const resultPromise = fetchFilingRegistry("RELIANCE");
    await vi.advanceTimersByTimeAsync(3000);
    const result = await resultPromise;

    expect(result).toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws when both attempts return a 5xx", async () => {
    vi.useFakeTimers();
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(500))
      .mockResolvedValueOnce(errorResponse(502));
    vi.stubGlobal("fetch", mockFetch);

    const resultPromise = fetchFilingRegistry("RELIANCE");
    const assertion = expect(resultPromise).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(3000);
    await assertion;

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws immediately on a 4xx without a second request", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(errorResponse(404));
    vi.stubGlobal("fetch", mockFetch);

    await expect(fetchFilingRegistry("RELIANCE")).rejects.toThrow();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns the parsed body on a 200", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(okTextResponse("<xbrl/>"));
    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchXbrl("https://nsearchives.nseindia.com/doc.xml");

    expect(result).toBe("<xbrl/>");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("fetchFilingRegistry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an empty array when the response is not an array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(okJsonResponse({ error: "not found" })),
    );

    const result = await fetchFilingRegistry("RELIANCE");

    expect(result).toEqual([]);
  });

  it("drops a record missing xbrl", async () => {
    const { xbrl: _xbrl, ...rowWithoutXbrl } = baseFilingRow();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(okJsonResponse([rowWithoutXbrl])),
    );

    const result = await fetchFilingRegistry("RELIANCE");

    expect(result).toEqual([]);
  });

  it("drops a record whose dates are unparseable", async () => {
    const row = baseFilingRow({ fromDate: "not-a-date" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(okJsonResponse([row])));

    const result = await fetchFilingRegistry("RELIANCE");

    expect(result).toEqual([]);
  });

  it("marks isConsolidated true only when the metadata field is exactly Consolidated", async () => {
    const rows = [
      baseFilingRow({ consolidated: "Consolidated" }),
      baseFilingRow({ consolidated: "Standalone" }),
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(okJsonResponse(rows)));

    const result = await fetchFilingRegistry("RELIANCE");

    expect(result).toHaveLength(2);
    expect(result[0].isConsolidated).toBe(true);
    expect(result[1].isConsolidated).toBe(false);
  });

  it("marks isAudited true only when the metadata field is exactly Audited", async () => {
    const rows = [
      baseFilingRow({ audited: "Audited" }),
      baseFilingRow({ audited: "Un-Audited" }),
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(okJsonResponse(rows)));

    const result = await fetchFilingRegistry("RELIANCE");

    expect(result).toHaveLength(2);
    expect(result[0].isAudited).toBe(true);
    expect(result[1].isAudited).toBe(false);
  });
});

describe("classifyActions", () => {
  it("recognises the common actions", () => {
    expect(classifyActions("Dividend - Rs 10 Per Share")).toEqual(["dividend"]);
    expect(classifyActions("Bonus 1:1")).toEqual(["bonus"]);
    expect(classifyActions("Face Value Split")).toEqual(["split"]);
    expect(classifyActions("Rights Issue")).toEqual(["rights"]);
    expect(classifyActions("Buy Back of Shares")).toEqual(["buyback"]);
  });

  it("falls back to other rather than guessing", () => {
    expect(classifyActions("Annual General Meeting")).toEqual(["other"]);
  });

  it("returns every action type present in a combined purpose", () => {
    const result = classifyActions(
      "Interim Dividend Rs 5 Per Share and Bonus Issue 1:1",
    );

    expect(result).toEqual(["dividend", "bonus"]);
  });

  it("never emits other alongside a real action type", () => {
    const result = classifyActions(
      "Interim Dividend Rs 5 Per Share and Bonus Issue 1:1",
    );

    expect(result).not.toContain("other");
  });
});

describe("extractActionValue", () => {
  it("pulls the rupee amount out", () => {
    expect(extractActionValue("Dividend - Rs 10 Per Share")).toBe(10);
    expect(extractActionValue("Dividend Rs.5.50 Per Share")).toBe(5.5);
  });

  it("returns null when there is no amount", () => {
    expect(extractActionValue("Bonus 1:1")).toBeNull();
  });

  it("returns the resulting face value for a from-to split, not the pre-split value", () => {
    expect(extractActionValue("Face Value Split from Rs 10 to Rs 2")).toBe(2);
  });

  it("still returns the first rupee figure for a plain (non-split) dividend purpose", () => {
    expect(extractActionValue("Dividend - Rs 10 Per Share")).toBe(10);
  });

  it("handles Rs./-  spacing and punctuation variants in from-to phrasing", () => {
    expect(
      extractActionValue("Sub-Division / Split - From Rs.10/- To Rs.2/-"),
    ).toBe(2);
    expect(
      extractActionValue("Face Value Split  from   Rs   10   to   Rs   1"),
    ).toBe(1);
  });

  // BUG 1 regression: NSE writes the singular rupee as "Re" (Re.1 / Re 1),
  // not just "Rs". The 10 -> 1 face-value split is the most common split in
  // India and is filed this way, so the "to" side (and the "from" side, for
  // filings that also spell the pre-split value as "Re") must recognise it.
  it("recognises the singular Re spelling on either side of a from-to split", () => {
    expect(
      extractActionValue("Face Value Split From Rs.10/- To Re.1/-"),
    ).toBe(1);
    expect(
      extractActionValue("Face Value Split From Rs 10/- To Re 1/-"),
    ).toBe(1);
    expect(
      extractActionValue("Face Value Split from Re.10/- to Re.1/-"),
    ).toBe(1);
  });

  // Existing correct cases from the bug report must still hold after the Re
  // fix is added.
  it("still returns the resulting value for the Rs-only spellings (regression)", () => {
    expect(
      extractActionValue("Sub-division of equity shares from Rs.10/- to Rs.1/-"),
    ).toBe(1);
    expect(extractActionValue("Stock Split From Rs.10/- To Rs.2/-")).toBe(2);
  });

  // BUG 2: a comma-grouped amount must not be truncated at the comma.
  it("keeps comma-grouped amounts instead of truncating at the comma", () => {
    expect(extractActionValue("Dividend Rs 1,250 Per Share")).toBe(1250);
    // Indian lakh-style grouping (irregular group sizes) must also survive.
    expect(extractActionValue("Dividend Rs 12,50,000 Per Share")).toBe(1250000);
  });

  // Regression guard: the decimal case must not be broken by comma support.
  it("still returns a decimal amount correctly (regression)", () => {
    expect(extractActionValue("Dividend Rs.5.50 Per Share")).toBe(5.5);
  });

  // Regression guard: a plain "Rs N Per Share" dividend must still resolve.
  it("still returns 10 for a plain Rs 10 Per Share dividend (regression)", () => {
    expect(extractActionValue("Rs 10 Per Share")).toBe(10);
  });
});

describe("fetchCorporateActions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("emits one row per detected action type for a combined purpose", async () => {
    const row = baseActionRow({
      subject: "Interim Dividend Rs 5 Per Share and Bonus Issue 1:1",
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(okJsonResponse([row])));

    const result = await fetchCorporateActions("RELIANCE");

    expect(result).toHaveLength(2);
    const [first, second] = result;
    expect(first.symbol).toBe("RELIANCE");
    expect(second.symbol).toBe("RELIANCE");
    expect(first.exDate).toBe(second.exDate);
    expect(first.description).toBe(second.description);
    expect(first.actionType).not.toBe(second.actionType);
    expect([first.actionType, second.actionType].sort()).toEqual([
      "bonus",
      "dividend",
    ]);
  });

  it("emits a single 'other' row for an unrecognised purpose", async () => {
    const row = baseActionRow({ subject: "Annual General Meeting" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(okJsonResponse([row])));

    const result = await fetchCorporateActions("RELIANCE");

    expect(result).toHaveLength(1);
    expect(result[0].actionType).toBe("other");
  });

  // BUG 3: a bare "Rs N Per Share" figure belongs to the dividend it was
  // extracted from, not to a bonus row emitted from the same purpose string.
  it("attributes a bare per-share figure to dividend only, leaving the co-emitted bonus row null", async () => {
    const row = baseActionRow({
      subject: "Bonus Issue 1:1 and Interim Dividend Rs 4 Per Share",
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(okJsonResponse([row])));

    const result = await fetchCorporateActions("RELIANCE");

    expect(result).toHaveLength(2);
    const dividend = result.find((r) => r.actionType === "dividend");
    const bonus = result.find((r) => r.actionType === "bonus");
    expect(dividend?.value).toBe(4);
    expect(bonus?.value).toBeNull();
  });

  // BUG 3: a from-to figure is a resulting face value and belongs to split
  // only, not to a co-emitted dividend row from the same purpose string.
  it("attributes a from-to face-value figure to split only, leaving the co-emitted dividend row null", async () => {
    const row = baseActionRow({
      subject:
        "Face Value Split From Rs.10/- To Rs.2/- And Dividend Rs.3/- Per Share",
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(okJsonResponse([row])));

    const result = await fetchCorporateActions("RELIANCE");

    expect(result).toHaveLength(2);
    const split = result.find((r) => r.actionType === "split");
    const dividend = result.find((r) => r.actionType === "dividend");
    expect(split?.value).toBe(2);
    expect(dividend?.value).toBeNull();
  });

  // Regression guard: a single-type purpose must still carry its value
  // (attribution must not null out the common, unambiguous case).
  it("still assigns the value to a single-type dividend purpose (regression)", async () => {
    const row = baseActionRow({ subject: "Dividend - Rs 10 Per Share" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(okJsonResponse([row])));

    const result = await fetchCorporateActions("RELIANCE");

    expect(result).toHaveLength(1);
    expect(result[0].actionType).toBe("dividend");
    expect(result[0].value).toBe(10);
  });
});
