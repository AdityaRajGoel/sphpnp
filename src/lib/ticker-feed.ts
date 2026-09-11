import { supabase } from "@/integrations/supabase/client";

/** One line of the live-updates ticker, as ticker-feed composes it (supabase/functions/_shared/ticker.ts). */
export type TickerItem = {
  kind: "ipo" | "gainer" | "loser" | "news" | "ex_date" | "announcement" | "global" | "promo";
  tag: string;
  text: string;
  href: string | null;
  tone: "up" | "down" | "neutral";
  external: boolean;
};

export const TICKER_FRESH_MS = 5 * 60 * 1000;

/** The house lines woven between the live ones - what the bar used to rotate through. */
export const PROMOS: TickerItem[] = [
  { kind: "promo", tag: "FREE", text: "Open a Demat account with ₹0 opening charges", href: "/open-account", tone: "neutral", external: false },
  { kind: "promo", tag: "IPO", text: "Track every IPO - GMP, subscription and RHP in one place", href: "/ipo", tone: "neutral", external: false },
  { kind: "promo", tag: "PRE-IPO", text: "Pre-IPO & unlisted shares", href: "/unlisted-space", tone: "neutral", external: false },
  { kind: "promo", tag: "PRICING", text: "Transparent pricing - every charge published", href: "/pricing", tone: "neutral", external: false },
  { kind: "promo", tag: "SEBI", text: "SEBI registered · NSE · BSE · MCX", href: null, tone: "neutral", external: false },
];

/** A promo after every `every` live lines, cycling through the list; promos alone when there is nothing live. */
export function withPromos(items: TickerItem[], promos: TickerItem[] = PROMOS, every = 5): TickerItem[] {
  if (items.length === 0) return promos;
  const out: TickerItem[] = [];
  let p = 0;
  items.forEach((item, i) => {
    out.push(item);
    if ((i + 1) % every === 0 && promos.length > 0) out.push(promos[p++ % promos.length]);
  });
  if (p === 0 && promos.length > 0) out.push(promos[0]);
  return out;
}

const isTickerItem = (v: unknown): v is TickerItem =>
  typeof v === "object" && v !== null && typeof (v as TickerItem).text === "string" && typeof (v as TickerItem).tag === "string";

/** Only links this bar is willing to open: site paths and https. */
export const tickerHref = (href: string | null): string | null =>
  href && (/^\/(?!\/)/.test(href) || /^https:\/\//i.test(href)) ? href : null;

const table = () => supabase.from("ticker_feed" as never) as ReturnType<typeof supabase.from>;

/**
 * The cached ticker, refreshed through ticker-feed when it is more than five
 * minutes old. A headless browser (the build's prerender) only reads the cache.
 */
export async function loadTicker(allowRefresh: boolean): Promise<TickerItem[]> {
  const { data } = await table().select("items,built_at").eq("id", "main").maybeSingle();
  const row = data as { items: unknown; built_at: string } | null;
  const cached = Array.isArray(row?.items) ? row!.items.filter(isTickerItem) : [];
  const stale = !row || Date.now() - Date.parse(row.built_at) >= TICKER_FRESH_MS;
  if (!stale || !allowRefresh) return cached;
  const { data: fresh, error } = await supabase.functions.invoke("ticker-feed", { body: {} });
  const items = (fresh as { items?: unknown } | null)?.items;
  return !error && Array.isArray(items) ? items.filter(isTickerItem) : cached;
}
