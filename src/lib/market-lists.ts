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
];

/** "NIFTY OIL & GAS" -> "nifty-oil-gas". Must match slugify in scripts/lib/market-list-routes.mjs. */
export function listSlug(name: string): string {
  return name.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** "NIFTY OIL & GAS" -> "Nifty Oil & Gas", the way NSE writes it in prose. */
export function indexTitle(name: string): string {
  return name.split(" ").map((w) => (/^(IT|PSU|FMCG|&)$/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase())).join(" ");
}

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
    .select("trade_date,close,change_pct,pe,pb,div_yield").ilike("index_name", indexName)
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
