import { describe, expect, it } from "vitest";
import { runCascade, type CascadeStep } from "../../supabase/functions/_shared/ai-cascade";

const ok = (name: string, value: string, maxMs = 10_000): CascadeStep<string> => ({ name, maxMs, run: async () => value });
const fail = (name: string, maxMs = 10_000): CascadeStep<string> => ({ name, maxMs, run: async () => { throw new Error("HTTP 429"); } });

describe("runCascade", () => {
  it("returns the first provider that answers and records the ones that failed", async () => {
    const out = await runCascade([fail("Groq:a"), ok("Cerebras", "report"), ok("Gemini", "never asked")], { startedAt: Date.now(), deadlineMs: 50_000, minStepMs: 5_000 });
    expect(out).toEqual({ result: "report", served: "Cerebras", errors: ["Groq:a: HTTP 429"] });
  });

  it("moves on when a provider runs past its own cap", async () => {
    const hang: CascadeStep<string> = { name: "free", maxMs: 100, run: () => new Promise(() => {}) };
    const out = await runCascade([hang, ok("Groq", "fast")], { startedAt: Date.now(), deadlineMs: 10_000, minStepMs: 50 });
    expect(out.served).toBe("Groq");
    expect(out.errors[0]).toMatch(/free timed out after 100ms/);
  });

  it("never lets a provider run past the shared deadline", async () => {
    const hang: CascadeStep<string> = { name: "free", maxMs: 22_000, run: () => new Promise(() => {}) };
    const t0 = Date.now();
    const out = await runCascade([hang], { startedAt: t0, deadlineMs: 200, minStepMs: 50 });
    expect(out.result).toBeNull();
    expect(Date.now() - t0).toBeLessThan(1_000);
  });

  it("skips providers once too little of the deadline is left to answer", async () => {
    let called = false;
    const out = await runCascade([{ name: "Bytez", maxMs: 15_000, run: async () => { called = true; return "x"; } }], {
      startedAt: 0, deadlineMs: 52_000, minStepMs: 5_000, now: () => 49_000,
    });
    expect(called).toBe(false);
    expect(out).toEqual({ result: null, served: null, errors: ["Bytez: skipped, 3s left"] });
  });
});
