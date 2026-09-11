import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { isStale, relativeTime, safeHref, NEWS_FRESH_MS } from "@/lib/stock-news";

describe("isStale", () => {
  const now = Date.parse("2026-09-11T12:00:00Z");

  it("reuses a copy younger than two hours", () => {
    expect(isStale("2026-09-11T11:00:00Z", now)).toBe(false);
  });

  it("refreshes a copy two hours old, or none at all", () => {
    expect(isStale(new Date(now - NEWS_FRESH_MS).toISOString(), now)).toBe(true);
    expect(isStale(null, now)).toBe(true);
    expect(isStale("not a date", now)).toBe(true);
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-09-11T12:00:00Z");

  it("writes a story's age in the largest whole unit", () => {
    expect(relativeTime("2026-09-11T11:58:00Z", now)).toBe("2m ago");
    expect(relativeTime("2026-09-11T09:00:00Z", now)).toBe("3h ago");
    expect(relativeTime("2026-09-08T12:00:00Z", now)).toBe("3d ago");
  });
});

describe("safeHref", () => {
  it("opens https links only", () => {
    expect(safeHref("https://news.google.com/rss/articles/x")).toBe("https://news.google.com/rss/articles/x");
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
    expect(safeHref("http://example.com")).toBeUndefined();
  });
});
