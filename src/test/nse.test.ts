import { describe, it, expect, vi, afterEach } from "vitest";
import {
  toIsoDate,
  fetchFilingRegistry,
  fetchXbrl,
  classifyAction,
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

describe("classifyAction", () => {
  it("recognises the common actions", () => {
    expect(classifyAction("Dividend - Rs 10 Per Share")).toBe("dividend");
    expect(classifyAction("Bonus 1:1")).toBe("bonus");
    expect(classifyAction("Face Value Split")).toBe("split");
    expect(classifyAction("Rights Issue")).toBe("rights");
    expect(classifyAction("Buy Back of Shares")).toBe("buyback");
  });

  it("falls back to other rather than guessing", () => {
    expect(classifyAction("Annual General Meeting")).toBe("other");
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
});
