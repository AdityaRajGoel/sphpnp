import { describe, it, expect, beforeEach, vi } from "vitest";
import { CONSENT_KEY, writeConsent } from "@/lib/consent";

const clarityScripts = () => document.querySelectorAll('script[src*="clarity.ms"]').length;

async function freshInstall() {
  vi.resetModules();
  const { installAnalyticsConsent } = await import("@/lib/analytics-consent");
  installAnalyticsConsent();
}

describe("installAnalyticsConsent", () => {
  beforeEach(() => {
    document.head.replaceChildren();
    localStorage.clear();
    delete window.clarity;
  });

  it("does not load Clarity before the visitor has decided", async () => {
    await freshInstall();
    expect(clarityScripts()).toBe(0);
  });

  it("does not load Clarity for a visitor who chose essential only", async () => {
    localStorage.setItem(CONSENT_KEY, "essential");
    await freshInstall();
    expect(clarityScripts()).toBe(0);
  });

  it("loads Clarity once for a visitor who accepted earlier", async () => {
    localStorage.setItem(CONSENT_KEY, "all");
    await freshInstall();
    writeConsent("all");
    expect(clarityScripts()).toBe(1);
  });

  it("loads on accept, and revokes Clarity's consent on a later refusal", async () => {
    await freshInstall();
    writeConsent("all");
    expect(clarityScripts()).toBe(1);
    const calls = window.clarity?.q ?? [];
    writeConsent("essential");
    expect(calls.at(-1)).toEqual(["consent", false]);
  });
});
