import { describe, it, expect } from "vitest";
import { trimPromptKeepingTail } from "../../supabase/functions/_shared/prompt-trim";

/*
 * Groq chat prompts were cut to their first 2,000 characters. The client's
 * question is the LAST section of the prompt, so once the server added the
 * company record every question was cut off and the model answered nothing
 * in particular (Oct 2026: ~180-character replies to every chat turn).
 */
describe("trimPromptKeepingTail", () => {
  const question = "## Client's Question\nWhere is the price against its 52-week range?";

  it("leaves a prompt under the limit untouched", () => {
    expect(trimPromptKeepingTail("short", 100, "## Client's Question")).toBe("short");
  });

  it("keeps the whole question when the data before it is too long", () => {
    const prompt = "## Stock Context\n" + "x".repeat(10_000) + "\n" + question;
    const out = trimPromptKeepingTail(prompt, 2000, "## Client's Question");
    expect(out.length).toBeLessThanOrEqual(2000);
    expect(out.endsWith(question)).toBe(true);
    expect(out).toContain("[Data truncated]");
    expect(out.startsWith("## Stock Context")).toBe(true);
  });

  it("falls back to a plain head cut when the marker is absent", () => {
    const out = trimPromptKeepingTail("y".repeat(5000), 1000, "## Client's Question");
    expect(out.length).toBeLessThanOrEqual(1000);
  });
});
