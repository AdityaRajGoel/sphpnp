import { supabase } from "@/integrations/supabase/client";
import { UNIVERSE_SOURCES, type UniversePart } from "@/lib/universe-file";
import { allPages } from "../../supabase/functions/_shared/paging";

/**
 * A universe part read straight from its table when the static file is unusable.
 * Paged by symbol: PostgREST stops at 1,000 rows without saying so, and
 * stock_fundamentals_summary passed 3,000 in October 2026.
 */
export function readUniverseTable<T>(part: UniversePart): Promise<T[]> {
  const { table, select } = UNIVERSE_SOURCES[part];
  return allPages<T>((from, to) =>
    (supabase.from(table as never) as ReturnType<typeof supabase.from>)
      .select(select)
      .order("symbol")
      .range(from, to) as unknown as PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  );
}
