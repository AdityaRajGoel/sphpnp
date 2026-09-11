import { describe, it, expect } from "vitest";
import { nextBatch, cursorAfter } from "../../supabase/functions/_shared/batch-cursor";

const U = ["A", "B", "C", "D", "E"];

describe("nextBatch", () => {
  it("starts at the top without a cursor and resumes after one", () => {
    expect(nextBatch(U, null, 2)).toEqual({ batch: ["A", "B"], wrapped: false });
    expect(nextBatch(U, "B", 2)).toEqual({ batch: ["C", "D"], wrapped: false });
    expect(nextBatch(U, "D", 2)).toEqual({ batch: ["E"], wrapped: true });
  });

  it("resumes past a cursor that has left the universe", () => {
    expect(nextBatch(U, "BB", 2)).toEqual({ batch: ["C", "D"], wrapped: false });
    expect(nextBatch(U, "Z", 2)).toEqual({ batch: [], wrapped: true });
  });
});

describe("cursorAfter", () => {
  it("stores the last symbol done, or clears the cursor when the pass finished", () => {
    expect(cursorAfter("B", ["C", "D"], 2, false)).toBe("D");
    expect(cursorAfter("B", ["C", "D"], 1, false)).toBe("C");
    expect(cursorAfter("D", ["E"], 1, true)).toBeNull();
  });

  it("keeps the pass where it was when a batch stops early at the end", () => {
    expect(cursorAfter("C", ["D", "E"], 1, true)).toBe("D");
  });

  it("leaves the cursor alone when nothing was done", () => {
    expect(cursorAfter("B", ["C", "D"], 0, false)).toBe("B");
    expect(cursorAfter(null, ["A", "B"], 0, false)).toBeNull();
  });
});
