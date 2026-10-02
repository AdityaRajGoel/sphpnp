type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/**
 * Every row of a query, read `size` rows at a time. PostgREST answers at most
 * 1,000 rows a request and says nothing when it truncates, so a single read of
 * a growing table silently drops the rest: the IPO list lost every GMP snapshot
 * past the oldest 1,000. The query must order by something unique for pages
 * not to overlap.
 */
export async function allPages<T>(page: (from: number, to: number) => Page<T>, size = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < size) return out;
  }
}
