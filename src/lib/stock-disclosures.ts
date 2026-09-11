import { supabase } from "@/integrations/supabase/client";

/**
 * Per-stock data from the free sources: NSE insider trades and shareholding
 * filings, BSE announcements (their own tables), and the screener.in /
 * Tickertape blocks stored on stock_profiles. Shapes mirror
 * supabase/functions/_shared/{nse-disclosures,bse,screener-in,tickertape}.ts.
 */

export type InsiderTrade = {
  disclosure_id: string;
  person: string;
  category: string | null;
  transaction: "buy" | "sell" | "pledge" | "revoke" | "other";
  mode: string | null;
  quantity: number | null;
  value: number | null;
  traded_to: string | null;
  disclosed_at: string | null;
  xbrl_url: string | null;
};

export type BseAnnouncement = {
  news_id: string;
  subject: string;
  summary: string | null;
  category: string | null;
  critical: boolean;
  attachment_url: string | null;
  published_at: string | null;
};

export type ShareholdingFiling = { quarter_end: string; promoter_pct: number | null; public_pct: number | null; xbrl_url: string | null; filed_at: string | null };

export type DocLink = { title: string; url: string; note: string | null };
export type ScreenerProfile = {
  name: string | null;
  basis: "consolidated" | "standalone";
  about: string | null;
  top_ratios: Record<string, number | null>;
  growth: { title: string; values: { period: string; pct: number | null }[] }[];
  pros: string[];
  cons: string[];
  documents: { annual_reports: DocLink[]; credit_ratings: DocLink[]; concalls: { period: string; transcript: string | null; ppt: string | null; recording: string | null }[] };
};

export type TickertapeProfile = {
  sid: string;
  url: string | null;
  analysts: { total: number; buy_pct: number } | null;
  holdings: { date: string; promoter: number | null; fii: number | null; dii: number | null; mutual_funds: number | null; insurance: number | null; other_dii: number | null; retail: number | null; others: number | null }[];
  top_funds: { name: string; url: string | null; pct_of_company: number | null; weight_in_fund: number | null; change_3m: number | null }[];
  scorecard: { name: string; tag: string; description: string | null; tone: "good" | "bad" | "neutral" }[];
  sector: { name: string | null; pe: number | null; pb: number | null; dividend_yield: number | null };
  beta: number | null;
};

export type StockDisclosures = {
  trades: InsiderTrade[];
  announcements: BseAnnouncement[];
  shareholding: ShareholdingFiling | null;
};

const table = (name: string) => supabase.from(name as never) as ReturnType<typeof supabase.from>;

export async function loadStockDisclosures(symbol: string): Promise<StockDisclosures> {
  const [trades, announcements, shp] = await Promise.all([
    table("nse_insider_trades")
      .select("disclosure_id,person,category,transaction,mode,quantity,value,traded_to,disclosed_at,xbrl_url")
      .eq("symbol", symbol).order("disclosed_at", { ascending: false, nullsFirst: false }).limit(100),
    table("bse_announcements")
      .select("news_id,subject,summary,category,critical,attachment_url,published_at")
      .eq("symbol", symbol).order("published_at", { ascending: false, nullsFirst: false }).limit(15),
    table("nse_shareholding_filings")
      .select("quarter_end,promoter_pct,public_pct,xbrl_url,filed_at")
      .eq("symbol", symbol).order("quarter_end", { ascending: false }).limit(1),
  ]);
  const failure = trades.error || announcements.error || shp.error;
  if (failure) throw new Error(failure.message);
  return {
    trades: (trades.data ?? []) as unknown as InsiderTrade[],
    announcements: (announcements.data ?? []) as unknown as BseAnnouncement[],
    shareholding: ((shp.data ?? [])[0] as unknown as ShareholdingFiling | undefined) ?? null,
  };
}

export type InsiderSummary = { buys: number; sells: number; boughtValue: number; soldValue: number; net: number };

/**
 * Market buying and selling by insiders over the last `days` - pledges,
 * revocations and gifts are not trades and are left out of the totals.
 */
export function insiderSummary(trades: InsiderTrade[], now = Date.now(), days = 365): InsiderSummary {
  const since = now - days * 86_400_000;
  const recent = trades.filter((t) => t.disclosed_at && Date.parse(t.disclosed_at) >= since);
  const sum = (kind: "buy" | "sell") => recent.filter((t) => t.transaction === kind).reduce((a, t) => a + (t.value ?? 0), 0);
  const boughtValue = sum("buy");
  const soldValue = sum("sell");
  return {
    buys: recent.filter((t) => t.transaction === "buy").length,
    sells: recent.filter((t) => t.transaction === "sell").length,
    boughtValue, soldValue, net: boughtValue - soldValue,
  };
}

/** Rupees written short: ₹4.3 Cr, ₹12.5 L, ₹8,500. */
export function shortRupees(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(abs >= 1e9 ? 0 : 1)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(1)} L`;
  return `${sign}₹${Math.round(abs).toLocaleString("en-IN")}`;
}

/** Only web links become hrefs - every URL here is third-party data. */
export const webHref = (url: string | null | undefined): string | undefined =>
  url && /^https?:\/\//i.test(url) ? url : undefined;
