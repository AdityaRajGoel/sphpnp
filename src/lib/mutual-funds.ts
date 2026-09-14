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
