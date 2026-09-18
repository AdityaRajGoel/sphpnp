import { describe, it, expect } from "vitest";
import { RELOAD_COOLDOWN_MS, shouldReloadForChunkError } from "@/lib/chunk-reload";

describe("shouldReloadForChunkError", () => {
  it("reloads on the first failure while online", () => {
    expect(shouldReloadForChunkError(1_000, null, true)).toBe(true);
  });

  it("never reloads while offline", () => {
    expect(shouldReloadForChunkError(1_000, null, false)).toBe(false);
  });

  it("does not reload again right after a reload, so a missing chunk cannot loop", () => {
    expect(shouldReloadForChunkError(10_000, 1_000, true)).toBe(false);
  });

  it("allows another reload once the cooldown has passed", () => {
    expect(shouldReloadForChunkError(1_000 + RELOAD_COOLDOWN_MS + 1, 1_000, true)).toBe(true);
  });
});
