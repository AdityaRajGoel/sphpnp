import { describe, it, expect } from "vitest";
import { allPages } from "../../supabase/functions/_shared/paging";

/** A fake PostgREST range read over `rows`, recording each call. */
const source = (rows: number[], calls: [number, number][] = []) => async (from: number, to: number) => {
  calls.push([from, to]);
  return { data: rows.slice(from, to + 1), error: null };
};

describe("allPages", () => {
  it("keeps asking until a short page, so nothing past the first 1,000 rows is lost", async () => {
    const calls: [number, number][] = [];
    const rows = Array.from({ length: 2500 }, (_, i) => i);
    expect(await allPages(source(rows, calls))).toEqual(rows);
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("stops on an empty page when the total is an exact multiple of the page size", async () => {
    const calls: [number, number][] = [];
    expect(await allPages(source(Array.from({ length: 4 }, (_, i) => i), calls), 2)).toHaveLength(4);
    expect(calls).toEqual([[0, 1], [2, 3], [4, 5]]);
  });

  it("throws the database error instead of returning a partial list", async () => {
    await expect(allPages(async () => ({ data: null, error: { message: "boom" } }))).rejects.toThrow("boom");
  });
});
