import { supabase } from "@/integrations/supabase/client";

/**
 * The indices whose constituents sync-market-data stores (its CONSTITUENT_FILES).
 * Listed here rather than read from the table because PostgREST cannot return
 * distinct names, and scripts/lib/market-list-routes.mjs reads this block to
 * prerender one page per index. A test keeps the two lists in step.
 */
export const INDEX_NAMES = [
  "NIFTY 50", "NIFTY NEXT 50", "NIFTY 100", "NIFTY 200", "NIFTY 500",
  "NIFTY MIDCAP 150", "NIFTY SMALLCAP 250", "NIFTY BANK", "NIFTY PRIVATE BANK",
  "NIFTY PSU BANK", "NIFTY FINANCIAL SERVICES", "NIFTY IT", "NIFTY AUTO",
  "NIFTY PHARMA", "NIFTY HEALTHCARE", "NIFTY FMCG", "NIFTY METAL", "NIFTY REALTY",
  "NIFTY ENERGY", "NIFTY OIL & GAS", "NIFTY MEDIA", "NIFTY CONSUMER DURABLES",
  "NIFTY MICROCAP 250", "NIFTY TOTAL MARKET",
];

/** "NIFTY OIL & GAS" -> "nifty-oil-gas". Must match slugify in scripts/lib/market-list-routes.mjs. */
export function listSlug(name: string): string {
  return name.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** "NIFTY OIL & GAS" -> "Nifty Oil & Gas", the way NSE writes it in prose. */
export function indexTitle(name: string): string {
  return name.split(" ").map((w) => (/^(IT|PSU|FMCG|&)$/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase())).join(" ");
}

/** index_valuation_daily's name for an index, where it differs by more than case. */
const STORED_NAME: Record<string, string> = { "NIFTY HEALTHCARE": "Nifty Healthcare Index" };
const storedName = (indexName: string) => STORED_NAME[indexName] ?? indexName;

export const indexBySlug = (slug: string | undefined) => INDEX_NAMES.find((n) => listSlug(n) === slug) ?? null;

export type Constituent = { symbol: string; company: string | null; industry: string | null; as_of: string };
export type IndexValuation = { trade_date: string; close: number | null; change_pct: number | null; pe: number | null; pb: number | null; div_yield: number | null };

export async function loadConstituents(indexName: string): Promise<Constituent[]> {
  const { data, error } = await supabase.from("index_constituents" as never)
    .select("symbol,company,industry,as_of").eq("index_name", indexName).order("symbol").limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []) as Constituent[];
}

/** Latest close and valuation. That table writes names in title case ("Nifty 50"), hence ilike. */
export async function loadIndexValuation(indexName: string): Promise<IndexValuation | null> {
  const { data, error } = await supabase.from("index_valuation_daily" as never)
    .select("trade_date,close,change_pct,pe,pb,div_yield").ilike("index_name", storedName(indexName))
    .order("trade_date", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as IndexValuation | null) ?? null;
}

/** Count per key, largest first. */
export function tally<T>(items: T[], key: (item: T) => string | null | undefined): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item)?.trim();
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export type IndexDay = { trade_date: string; close: number | null; pe: number | null; pb: number | null; div_yield: number | null };

const valuationTable = () => supabase.from("index_valuation_daily" as never);

/** Every stored day of one index, oldest first, paged past PostgREST's 1,000-row cap. */
export async function loadIndexHistory(indexName: string): Promise<IndexDay[]> {
  const out: IndexDay[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await valuationTable().select("trade_date,close,pe,pb,div_yield").ilike("index_name", storedName(indexName))
      .order("trade_date").range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as IndexDay[]));
    if ((data ?? []).length < 1000) return out;
  }
}

export type IndexBoardRow = { name: string; trade_date: string; close: number | null; change_pct: number | null; pe: number | null; year_pct: number | null };

/**
 * The latest day of every index on INDEX_NAMES, with its change over a year.
 * The stored names are title case ("Nifty Bank"), so the latest day is read
 * whole (one row per index, ~170) and matched without case, and the year-ago
 * window is then asked for by the stored names.
 */
export async function loadIndexBoard(): Promise<IndexBoardRow[]> {
  const head = await valuationTable().select("trade_date").order("trade_date", { ascending: false }).limit(1).maybeSingle();
  if (head.error) throw new Error(head.error.message);
  const date = (head.data as { trade_date: string } | null)?.trade_date;
  if (!date) return [];
  const latest = await valuationTable().select("index_name,trade_date,close,change_pct,pe").eq("trade_date", date);
  if (latest.error) throw new Error(latest.error.message);
  const wanted = new Set(INDEX_NAMES.map((n) => storedName(n).toLowerCase()));
  const rows = ((latest.data ?? []) as (Omit<IndexBoardRow, "name" | "year_pct"> & { index_name: string })[])
    .filter((r) => wanted.has(r.index_name.toLowerCase()));

  const yearAgo = (days: number) => new Date(Date.parse(`${date}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
  const past = await valuationTable().select("index_name,trade_date,close").in("index_name", rows.map((r) => r.index_name))
    .gte("trade_date", yearAgo(372)).lte("trade_date", yearAgo(365)).order("trade_date");
  if (past.error) throw new Error(past.error.message);
  const base = new Map<string, number>();
  for (const p of (past.data ?? []) as { index_name: string; close: number | null }[]) if (p.close) base.set(p.index_name, p.close);

  const byName = new Map(rows.map((r) => [r.index_name.toLowerCase(), r]));
  return INDEX_NAMES.flatMap((name) => {
    const r = byName.get(storedName(name).toLowerCase());
    if (!r) return [];
    const b = base.get(r.index_name);
    return [{ name, trade_date: r.trade_date, close: r.close, change_pct: r.change_pct, pe: r.pe, year_pct: b && r.close ? (r.close / b - 1) * 100 : null }];
  });
}

/** The broad NSE indices the screener can filter by, smallest first. */
export const SCREENER_INDICES = [
  { key: "NIFTY 50", label: "Nifty 50" },
  { key: "NIFTY NEXT 50", label: "Nifty Next 50" },
  { key: "NIFTY 100", label: "Nifty 100" },
  { key: "NIFTY MIDCAP 150", label: "Nifty Midcap 150" },
  { key: "NIFTY SMALLCAP 250", label: "Nifty Smallcap 250" },
  { key: "NIFTY MICROCAP 250", label: "Nifty Microcap 250" },
] as const;

/** Symbols in each of SCREENER_INDICES, paged past the 1,000-row cap. */
export async function loadIndexMembership(): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  for (let from = 0; from < 10_000; from += 1000) {
    const { data, error } = await supabase.from("index_constituents" as never)
      .select("index_name,symbol").in("index_name", SCREENER_INDICES.map((i) => i.key)).order("index_name").order("symbol").range(from, from + 999);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { index_name: string; symbol: string }[];
    for (const r of rows) (out.get(r.index_name) ?? out.set(r.index_name, new Set()).get(r.index_name)!).add(r.symbol);
    if (rows.length < 1000) break;
  }
  return out;
}
