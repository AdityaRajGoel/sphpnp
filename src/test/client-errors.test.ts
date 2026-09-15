import { describe, it, expect } from "vitest";
import { isNoise, shouldReport, toReport, MAX_REPORTS, CLIENT_ERROR_ENDPOINT } from "@/lib/client-errors";

describe("client error reporting", () => {
  it("reports only from the live site in a real browser", () => {
    expect(shouldReport("www.sphpnp.com", false)).toBe(true);
    expect(shouldReport("www.sphpnp.com", true)).toBe(false);
    expect(shouldReport("staging.sphpnp.com", false)).toBe(false);
    expect(shouldReport("localhost", false)).toBe(false);
  });

  it("builds a report from an Error with message, stack and page", () => {
    const report = toReport("react", new Error("boom"), undefined, "/stock/RELIANCE");
    expect(report.kind).toBe("react");
    expect(report.message).toBe("boom");
    expect(report.stack).toContain("boom");
    expect(report.page).toBe("/stock/RELIANCE");
    expect(() => new Date(report.at).toISOString()).not.toThrow();
  });

  it("handles non-Error values and truncates huge ones", () => {
    expect(toReport("unhandledrejection", "plain string").message).toBe("plain string");
    expect(toReport("unhandledrejection", undefined).message).toBe("");
    expect(toReport("error", "x".repeat(5000)).message.length).toBe(300);
  });

  it("drops noise from extensions and browser quirks", () => {
    expect(isNoise(toReport("error", "ResizeObserver loop completed with undelivered notifications"))).toBe(true);
    expect(isNoise(toReport("error", "bad", "chrome-extension://abc/content.js:1:1"))).toBe(true);
    expect(isNoise(toReport("error", "Script error."))).toBe(true);
    expect(isNoise(toReport("error", "Cannot read properties of undefined"))).toBe(false);
  });

  it("posts to the same-origin endpoint with a per-page cap", () => {
    expect(CLIENT_ERROR_ENDPOINT).toBe("/api/client-error");
    expect(MAX_REPORTS).toBeLessThanOrEqual(10);
  });
});
