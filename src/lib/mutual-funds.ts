import { supabase } from "@/integrations/supabase/client";
import { cleanNavs, type NavPoint } from "@/lib/sip-backtest";

export type FundNav = { scheme_code: string; scheme_name: string; nav: number; prev_nav: number | null; nav_date: string };
export type FundHistory = { scheme_code: string; scheme_name: string | null; fund_house: string | null; scheme_category: string | null; navs: NavPoint[] };

/** The curated schemes sync-market-feed keeps current from AMFI, largest name first. */
export async function getTrackedFunds(): Promise<FundNav[]> {
  const { data, error } = await (supabase.from("mf_navs" as never) as ReturnType<typeof supabase.from>)
    .select("scheme_code,scheme_name,nav,prev_nav,nav_date")
    .order("scheme_name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as FundNav[]).map((f) => ({ ...f, nav: Number(f.nav), prev_nav: f.prev_nav === null ? null : Number(f.prev_nav) }));
}

export async function getFundHistory(schemeCode: string): Promise<FundHistory> {
  const { data, error } = await supabase.functions.invoke("fetch-mf-history", { body: { scheme_code: schemeCode } });
  if (error || !data?.success) throw new Error(data?.error ?? error?.message ?? "NAV history unavailable");
  return { ...data.meta, navs: cleanNavs(data.navs) };
}

/** Point-to-point annualised change over `years`, from the NAV nearest that far back. */
export function trailingCagr(navs: readonly NavPoint[], years: number): number | null {
  if (navs.length < 2) return null;
  const last = navs[navs.length - 1];
  const target = new Date(`${last.date}T00:00:00Z`);
  target.setUTCFullYear(target.getUTCFullYear() - years);
  const targetIso = target.toISOString().slice(0, 10);
  if (navs[0].date > targetIso) return null;
  const base = [...navs].reverse().find((n) => n.date <= targetIso);
  return base ? (Math.pow(last.nav / base.nav, 1 / years) - 1) * 100 : null;
}

/**
 * Mutual fund research data (mf_schemes, from AMFI) and the helpers the
 * /mutual-funds page needs. AMFI labels categories two ways at once: SEBI's
 * older names ("Equity Scheme - Large Cap Fund") beside newer ones ("Equity
 * Schemes - Large Cap Fund", "Income/Debt Oriented Schemes - Liquid Fund"),
 * so the page groups by a normalised category instead.
 */
export type MfGroup = "Equity" | "Hybrid" | "Debt" | "Index funds & ETFs" | "Fund of funds" | "Solution-oriented" | "Other";
export const MF_GROUPS: MfGroup[] = ["Equity", "Hybrid", "Debt", "Index funds & ETFs", "Fund of funds", "Solution-oriented", "Other"];

export type MfCategory = { group: MfGroup; name: string };

/** Ordered: the first matching rule wins, so the narrower patterns come first. */
const RULES: [RegExp, MfGroup, string][] = [
  [/etf/i, "Index funds & ETFs", ""],
  [/index funds?/i, "Index funds & ETFs", ""],
  [/fof overseas|investing overseas/i, "Fund of funds", "Overseas"],
  [/fof|fund of funds/i, "Fund of funds", "Domestic"],
  [/retirement/i, "Solution-oriented", "Retirement"],
  [/child/i, "Solution-oriented", "Children's"],
  [/life cycle/i, "Solution-oriented", "Life cycle"],
  [/elss|tax saver/i, "Equity", "ELSS (tax saver)"],
  [/large\s*&\s*mid/i, "Equity", "Large & Mid Cap"],
  [/large cap/i, "Equity", "Large Cap"],
  [/mid cap/i, "Equity", "Mid Cap"],
  [/small cap/i, "Equity", "Small Cap"],
  [/multi cap/i, "Equity", "Multi Cap"],
  [/flexi cap/i, "Equity", "Flexi Cap"],
  [/focused/i, "Equity", "Focused"],
  [/value fund/i, "Equity", "Value"],
  [/contra/i, "Equity", "Contra"],
  [/dividend yield/i, "Equity", "Dividend Yield"],
  [/aggressive hybrid/i, "Hybrid", "Aggressive Hybrid"],
  [/balanced advantage|dynamic asset/i, "Hybrid", "Balanced Advantage"],
  [/multi asset/i, "Hybrid", "Multi Asset"],
  [/equity savings/i, "Hybrid", "Equity Savings"],
  [/arbitrage/i, "Hybrid", "Arbitrage"],
  [/conservative hybrid/i, "Hybrid", "Conservative Hybrid"],
  [/balanced hybrid/i, "Hybrid", "Balanced Hybrid"],
  [/overnight/i, "Debt", "Overnight"],
  [/liquid/i, "Debt", "Liquid"],
  [/money market/i, "Debt", "Money Market"],
  [/ultra short/i, "Debt", "Ultra Short Duration"],
  [/short (duration|term)/i, "Debt", "Short Duration"],
  [/medium to long/i, "Debt", "Medium to Long Duration"],
  [/medium (duration|term)/i, "Debt", "Medium Duration"],
  [/long (duration|term)/i, "Debt", "Long Duration"],
  [/dynamic (bond|term)/i, "Debt", "Dynamic Bond"],
  [/corporate bond/i, "Debt", "Corporate Bond"],
  [/banking and psu/i, "Debt", "Banking & PSU"],
  [/credit risk/i, "Debt", "Credit Risk"],
  [/constant maturity/i, "Debt", "Gilt, 10-year constant maturity"],
  [/gilt/i, "Debt", "Gilt"],
  [/floating|floater/i, "Debt", "Floater"],
  [/^equity/i, "Equity", "Sectoral & Thematic"],
  [/^(income|debt)/i, "Debt", "Other debt"],
];

/** The ETF and index-fund kinds: Gold ETFs, Debt index funds, and so on. */
function indexOrEtfName(raw: string): string {
  if (/etf/i.test(raw)) {
    for (const kind of ["Gold", "Silver", "Equity", "Debt"]) if (new RegExp(`${kind} ETF`, "i").test(raw)) return `${kind} ETFs`;
    return "Other ETFs";
  }
  if (/debt/i.test(raw)) return "Debt index funds";
  if (/hybrid/i.test(raw)) return "Hybrid index funds";
  if (/equity/i.test(raw)) return "Equity index funds";
  return "Index funds";
}

export function normalizeCategory(raw: string): MfCategory {
  for (const [pattern, group, name] of RULES) {
    if (!pattern.test(raw)) continue;
    // A sectoral fund under a debt heading is debt, not equity thematic.
    if (name === "Sectoral & Thematic" && /debt|income/i.test(raw)) return { group: "Debt", name: "Other debt" };
    return { group, name: group === "Index funds & ETFs" ? indexOrEtfName(raw) : name };
  }
  if (/sectoral|thematic/i.test(raw)) return { group: /debt|income/i.test(raw) ? "Debt" : "Equity", name: /debt|income/i.test(raw) ? "Other debt" : "Sectoral & Thematic" };
  return { group: "Other", name: raw.split(" - ").pop()?.trim() || raw };
}

/** "HDFC Large Cap Fund - Growth Option - Direct Plan" -> "HDFC Large Cap Fund". */
export function cleanFundName(name: string): string {
  // Split on " - " or on a dash before a plan suffix ("Fund-Direct Plan"), never
  // inside a word: "Mid-Cap" used to come out as "Mid - Cap".
  const parts = name.split(/\s+-\s+|\s*-\s*(?=(?:direct|regular|growth|plan|option)\b)/i);
  const tail = /^(direct|regular|growth|plan|option|direct plan|regular plan|growth option|growth plan)\b/i;
  while (parts.length > 1 && tail.test(parts[parts.length - 1])) parts.pop();
  const cleaned = parts.join(" - ").trim();
  return /[a-z]/.test(cleaned) ? cleaned : titleCaseFundName(cleaned);
}

/** Kept in capitals: fund-house and index acronyms seen in AMFI's all-caps names. */
const FUND_ACRONYMS = new Set([
  "SBI", "HDFC", "ICICI", "UTI", "DSP", "LIC", "HSBC", "IDFC", "IDBI", "IIFL", "PGIM", "JM", "NJ", "ITI", "BNP", "PPFAS",
  "ETF", "FOF", "ELSS", "PSU", "CPSE", "MNC", "ESG", "IT", "FMCG", "CRISIL", "IBX", "SDL", "BSE", "NSE", "MSCI", "NASDAQ",
  "AMC", "US", "EM", "AAA", "REIT", "TRI", "G-SEC", "IDCW", "1D",
]);
const FUND_SMALL_WORDS = new Set(["of", "and", "the", "in", "to", "for", "on", "&"]);

/** "BANK OF INDIA FLEXI CAP FUND" -> "Bank of India Flexi Cap Fund"; acronyms stay capitals. */
function titleCaseFundName(name: string): string {
  return name.split(/\s+/).map((word, i) => {
    if (FUND_ACRONYMS.has(word) || /^[\d:.]+$/.test(word)) return word;
    const lower = word.toLowerCase();
    if (i > 0 && FUND_SMALL_WORDS.has(lower)) return lower;
    return lower.replace(/(^|[-(/])([a-z])/g, (_, sep: string, c: string) => sep + c.toUpperCase());
  }).join(" ");
}

export const median = (values: (number | null)[]): number | null => {
  const v = values.filter((x): x is number => x !== null && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};

export type MfScheme = {
  scheme_code: string;
  scheme_name: string;
  amc: string | null;
  category: string;
  nav: number;
  nav_date: string;
  ret_1m: number | null;
  ret_6m: number | null;
  ret_1y: number | null;
  ret_3y: number | null;
  ret_5y: number | null;
};

/** Every scheme in one plan, paged past PostgREST's 1,000-row cap (~1,800 direct). */
export async function loadSchemes(plan: "direct" | "regular"): Promise<MfScheme[]> {
  const out: MfScheme[] = [];
  for (let from = 0; from < 10_000; from += 1000) {
    const { data, error } = await supabase.from("mf_schemes" as never)
      .select("scheme_code,scheme_name,amc,category,nav,nav_date,ret_1m,ret_6m,ret_1y,ret_3y,ret_5y")
      .eq("plan", plan).order("scheme_code").range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as MfScheme[]));
    if ((data ?? []).length < 1000) break;
  }
  return out.map((s) => ({ ...s, nav: Number(s.nav), ret_1m: num(s.ret_1m), ret_6m: num(s.ret_6m), ret_1y: num(s.ret_1y), ret_3y: num(s.ret_3y), ret_5y: num(s.ret_5y) }));
}

/** PostgREST sends numeric columns as strings. */
const num = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));
