import { supabase } from "@/integrations/supabase/client";

export type GmpSnapshot = {
  captured_at: string;
  gmp: number;
  est_listing_price: number | null;
  source: string;
};

/** The three sources sync-ipos reconciles. Keep in step with `SourceName` in supabase/functions/_shared/ipo-parse.ts. */
export type IpoSourceName = "ipowatch" | "investorgain" | "chittorgarh";

export const SOURCE_LABELS: Record<IpoSourceName, string> = {
  ipowatch: "IPO Watch",
  investorgain: "InvestorGain",
  chittorgarh: "Chittorgarh",
};

/** Which source supplied a reconciled field. Absent key = not tracked for that field. */
export type IpoFieldSources = Partial<Record<string, IpoSourceName>>;

export type Ipo = {
  id: string;
  slug: string;
  name: string;
  board: "mainboard" | "sme";
  type: "Mainboard" | "SME";
  status: "upcoming" | "open" | "closed" | "listed";
  price_band_min: number | null;
  price_band_max: number | null;
  price: string;
  lot_size: number | null;
  issue_size_crore: number | null;
  size: string;
  open_date: string | null;
  close_date: string | null;
  date: string;
  allotment_date: string | null;
  listing_date: string | null;
  registrar: string | null;
  rhp_url: string | null;
  drhp_url: string | null;
  subscription_qib: number | null;
  subscription_nii: number | null;
  subscription_retail: number | null;
  listing_price: number | null;
  listing_gain_pct: number | null;
  source: string;
  source_url: string | null;
  data_as_of: string;
  gmp: number | null;
  est_listing_price: number | null;
  gmp_history: GmpSnapshot[];
  field_sources: IpoFieldSources | null;
  // From the issue's own Chittorgarh page (sync-ipo-details); null until read.
  detail_url: string | null;
  min_investment: number | null;
  min_investment_lots: number | null;
  min_investment_shares: number | null;
  min_investment_category: string | null;
  face_value: number | null;
  issue_type: string | null;
  sale_type: string | null;
  listing_exchanges: string | null;
  fresh_issue_crore: number | null;
  ofs_crore: number | null;
  refund_date: string | null;
  credit_date: string | null;
  lead_managers: string[] | null;
  promoter_holding_pre: number | null;
  promoter_holding_post: number | null;
  details: { sections: IpoPageSection[] } | null;
  details_source: string | null;
  details_fetched_at: string | null;
  // Chittorgarh's subscription page, once bidding opens; null before then.
  subscription_total: number | null;
  subscription_employee: number | null;
  subscription_categories: { category: string; times: number }[] | null;
  subscription_as_of: string | null;
  /** RHP/DRHP, anchor letter, allotment status and company site, from the issue page. */
  documents: IpoDocumentLink[] | null;
  /** Recent coverage from Google News, gathered by the sync. */
  news: IpoNewsItem[] | null;
  news_fetched_at: string | null;
};

export type IpoDocumentLink = { kind: "rhp" | "drhp" | "anchor" | "allotment" | "company"; label: string; url: string };
export type IpoNewsItem = { title: string; source: string; url: string; published_at: string };

/** Only web links are rendered as hrefs - these URLs come from third-party pages. */
export const isWebUrl = (url: string): boolean => /^https?:\/\//i.test(url);

/** One section of the issue page as it was published: tables as rows of cells, text as lines. */
export type IpoPageSection = { title: string; tables: string[][][]; lines: string[] };

type IpoResponse = { success: boolean; ipos?: Ipo[]; error?: string; fetchedAt?: string };

export async function getIpos(slug?: string): Promise<Ipo[]> {
  const { data, error } = await supabase.functions.invoke<IpoResponse>("fetch-ipos", {
    body: slug ? { slug } : {},
  });
  if (error || !data?.success) throw new Error(data?.error || error?.message || "Could not load IPO data");
  return data.ipos ?? [];
}

export const formatRupees = (value: number | null, fractionDigits = 0) =>
  value === null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: fractionDigits }).format(value);

export const formatDate = (value: string | null) =>
  value ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : "Awaited";

/**
 * Lot size is a static fact, not a future event — 84 of 113 IPOs will never
 * carry it because only InvestorGain publishes it. "Not disclosed" says that;
 * "Awaited" would wrongly imply it is still coming.
 */
export const formatLotSize = (value: number | null) => (value === null ? "Not disclosed" : value.toLocaleString("en-IN"));

/** Registrar is likewise a static fact a source either recorded or didn't. */
export const formatRegistrar = (value: string | null) => value ?? "Not disclosed";

/**
 * Paise are kept when there are any: GMP is often the median of two sources
 * (Rs 139.50), and rounding it to Rs 140 beside a percentage computed from
 * 139.5 made the two figures disagree on the same card.
 */
export const formatGmp = (value: number | null) =>
  value === null ? "Not yet quoted" : formatRupees(value, Number.isInteger(value) ? 0 : 2);

export const formatListingGain = (pct: number | null) =>
  pct === null ? null : `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;

/** Which source(s) back one reconciled field, for the provenance tags on the detail page. */
export function fieldSourceLabel(fieldSources: IpoFieldSources | null | undefined, field: string): string | null {
  const source = fieldSources?.[field];
  return source ? SOURCE_LABELS[source] : null;
}

/**
 * `ipos.source` and `ipo_gmp_snapshots.source` are both `"+"`-joined lists of
 * whichever sources contributed (see sync-ipos), e.g. "ipowatch+chittorgarh".
 * This turns that internal join key into the human-readable, deduplicated
 * list a visitor should see: "IPO Watch, Chittorgarh".
 */
export function formatSourceList(value: string): string {
  const unique = [...new Set(value.split("+").map((token) => token.trim()).filter(Boolean))];
  return unique.map((token) => SOURCE_LABELS[token as IpoSourceName] ?? token).join(", ");
}

type MinInvestmentFields = Pick<Ipo, "min_investment" | "min_investment_lots" | "min_investment_shares" | "min_investment_category">;

/**
 * The smallest application, exactly as the issue page publishes it. Never
 * computed from lot size x price: an SME application must be at least two
 * lots, so that arithmetic would understate an SME minimum by half.
 */
export function formatMinInvestment(ipo: MinInvestmentFields): { amount: string; basis: string | null } | null {
  if (ipo.min_investment === null) return null;
  const lots = ipo.min_investment_lots;
  const shares = ipo.min_investment_shares;
  const parts = [
    lots === null ? null : `${lots} ${lots === 1 ? "lot" : "lots"}`,
    shares === null ? null : `${shares.toLocaleString("en-IN")} shares`,
  ].filter(Boolean);
  return { amount: formatRupees(ipo.min_investment), basis: parts.length > 0 ? parts.join(" · ") : null };
}

/**
 * Whether an issue-page table opens with a header row. Grids of three or more
 * columns do (financials, lot sizes, KPIs); two-column tables are label/value
 * pairs and do not.
 */
export const sectionTableHasHeader = (rows: string[][]): boolean =>
  rows.length > 1 && (rows[0]?.length ?? 0) >= 3;

/**
 * GMP as a percentage of the upper price band - the price an applicant bidding
 * at cut-off pays, and so the base any listing gain is measured from. Absent
 * unless both figures are known and the band is a real price.
 */
export function gmpPercent(ipo: Pick<Ipo, "gmp" | "price_band_max">): number | null {
  if (ipo.gmp === null || ipo.price_band_max === null || ipo.price_band_max <= 0) return null;
  return (ipo.gmp / ipo.price_band_max) * 100;
}

export const formatGmpPercent = (pct: number | null): string | null =>
  pct === null ? null : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;

/** A subscription multiple as the market quotes it: "4.71x". */
export const formatSubscription = (times: number | null): string | null =>
  times === null ? null : `${times.toFixed(2)}x`;
