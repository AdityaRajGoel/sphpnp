import { describe, expect, it } from "vitest";
import { isUsableUniverseFile, UNIVERSE_FILE_MAX_AGE_MS } from "@/lib/universe-file";

const now = Date.parse("2026-10-03T06:00:00Z");
const file = (over: Record<string, unknown> = {}) => ({
  generated_at: new Date(now - 60_000).toISOString(),
  quotes: [{ symbol: "RELIANCE" }], fundamentals: [], risk: [], scores: [],
  ...over,
});

describe("isUsableUniverseFile", () => {
  it("accepts a fresh file with every part", () => {
    expect(isUsableUniverseFile(file(), now)).toBe(true);
  });
  it("rejects a stale file, so a stopped job falls back to the tables", () => {
    expect(isUsableUniverseFile(file({ generated_at: new Date(now - UNIVERSE_FILE_MAX_AGE_MS - 1).toISOString() }), now)).toBe(false);
  });
  it("rejects a missing part, empty quotes, or not a file at all", () => {
    expect(isUsableUniverseFile(file({ risk: undefined }), now)).toBe(false);
    expect(isUsableUniverseFile(file({ quotes: [] }), now)).toBe(false);
    expect(isUsableUniverseFile("<html>", now)).toBe(false);
  });
});
