// Market data from outside the exchanges' file archives, captured 2026-09-11:
//
//   NSDL  www.fpi.nsdl.co.in/web/Reports/Latest.aspx    FPI daily flows (cash by
//         category and route, and derivatives by product)
//   MoSPI api.mospi.gov.in (CPI, IIP, WPI)              monthly macro - reachable
//         only with legacy TLS renegotiation, so it runs in GitHub Actions
//   NSE   /api/event-calendar                           board meetings ahead
//   BSE   /api/Corpforthresults/w                       results dates ahead
//
// Pure: no fetch.

import { isoDate, num } from "./market-files.ts";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() && v.trim() !== "-" ? v.trim() : null);
const cellText = (html: string) =>
  html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------------------
// NSDL FPI daily
// ---------------------------------------------------------------------------

export type FpiRow = {
  report_date: string; section: "cash" | "derivatives"; category: string; route: string;
  buy_cr: number | null; sell_cr: number | null; net_cr: number | null; net_usd_mn: number | null;
  buy_contracts: number | null; sell_contracts: number | null; oi_contracts: number | null; oi_cr: number | null;
};

const tableRows = (table: string) =>
  [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(([, tr]) => [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(([, c]) => cellText(c)));

/**
 * The "Daily Trends in FPI Investments" page: a cash table whose date and
 * category cells span rows (so later rows start with the route), and a
 * derivatives table by product.
 */
export function parseFpiDaily(html: string): FpiRow[] {
  const out: FpiRow[] = [];
  for (const [, table] of html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)) {
    const rows = tableRows(table);
    const isCash = rows.some((r) => r.some((c) => /Investment Route/i.test(c)));
    const isDerivatives = rows.some((r) => r.some((c) => /Derivative Products/i.test(c)));
    let date: string | null = null;
    let category = "";
    for (const cells of rows) {
      if (cells.length === 0) continue;
      const lead = isoDate(cells[0]);
      if (lead) { date = lead; cells.shift(); }
      if (!date) continue;
      if (isCash) {
        // [category?, route, buy, sell, net, net usd, (rate)]
        const numbers = cells.filter((c) => num(c) !== null);
        const words = cells.filter((c) => num(c) === null && !/^Rs\./.test(c));
        if (numbers.length < 4 || words.length === 0) continue;
        if (words.length >= 2) category = words[0];
        // The closing "Total" row is its own category, not a route of the last one.
        if (words.length === 1 && /^(grand )?total$/i.test(words[0])) category = "Total";
        const route = words[words.length - 1];
        out.push({
          report_date: date, section: "cash", category, route,
          buy_cr: num(numbers[0]), sell_cr: num(numbers[1]), net_cr: num(numbers[2]), net_usd_mn: num(numbers[3]),
          buy_contracts: null, sell_contracts: null, oi_contracts: null, oi_cr: null,
        });
      } else if (isDerivatives) {
        const [product, ...rest] = cells;
        const n = rest.map(num);
        if (!product || n.length < 6 || n.some((v) => v === null)) continue;
        out.push({
          report_date: date, section: "derivatives", category: product, route: "All",
          buy_cr: n[1], sell_cr: n[3], net_cr: n[1]! - n[3]!, net_usd_mn: null,
          buy_contracts: n[0], sell_contracts: n[2], oi_contracts: n[4], oi_cr: n[5],
        });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// MoSPI monthly macro
// ---------------------------------------------------------------------------

export type MacroMonthly = { series: string; period: string; value: number; change_pct: number | null; source: string };

const MONTH_NUMBER: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};
const period = (year: unknown, month: unknown) => {
  const m = MONTH_NUMBER[String(month ?? "").toLowerCase()];
  const y = typeof year === "number" ? year : Number(year);
  return m && Number.isInteger(y) ? `${y}-${m}-01` : null;
};

/**
 * Headline series only: CPI (all India, combined, general index, with its
 * inflation), IIP (general index, with growth) and WPI (the all-commodities index).
 */
export function parseMospi(raw: unknown, kind: "cpi" | "iip" | "wpi"): MacroMonthly[] {
  const rows = isRecord(raw) && Array.isArray(raw.data) ? raw.data.filter(isRecord) : [];
  return rows.flatMap((r) => {
    const p = period(r.year, r.month);
    if (!p) return [];
    if (kind === "cpi") {
      if (r.state !== "All India" || r.sector !== "Combined" || r.group !== "General") return [];
      const value = num(r.index);
      return value === null ? [] : [{ series: "CPI (Combined)", period: p, value, change_pct: num(r.inflation), source: "mospi" }];
    }
    if (kind === "iip") {
      if (r.type !== "General" || r.category !== "General") return [];
      const value = num(r.index);
      return value === null ? [] : [{ series: "IIP (General)", period: p, value, change_pct: num(r.growth_rate), source: "mospi" }];
    }
    if (r.majorgroup !== "Wholesale price index" || r.group) return [];
    const value = num(r.index_value);
    return value === null ? [] : [{ series: "WPI (All commodities)", period: p, value, change_pct: null, source: "mospi" }];
  });
}

/** Year-on-year change for a series whose source gives only the index (WPI). */
export function withYoy(rows: MacroMonthly[]): MacroMonthly[] {
  const byKey = new Map(rows.map((r) => [`${r.series}|${r.period}`, r]));
  return rows.map((r) => {
    if (r.change_pct !== null) return r;
    const prior = byKey.get(`${r.series}|${Number(r.period.slice(0, 4)) - 1}${r.period.slice(4)}`);
    return prior && prior.value > 0 ? { ...r, change_pct: Number(((r.value / prior.value - 1) * 100).toFixed(2)) } : r;
  });
}

// ---------------------------------------------------------------------------
// Corporate calendar
// ---------------------------------------------------------------------------

export type CalendarEvent = { event_key: string; symbol: string | null; company: string; event_date: string; purpose: string; detail: string | null; source: "nse" | "bse" };

/** Board meetings NSE lists ahead (results, dividends, fund raising). */
export function parseNseEventCalendar(raw: unknown): CalendarEvent[] {
  return (Array.isArray(raw) ? raw : []).filter(isRecord).flatMap((r) => {
    const symbol = str(r.symbol);
    const company = str(r.company);
    const event_date = isoDate(r.date);
    const purpose = str(r.purpose);
    if (!company || !event_date || !purpose) return [];
    return [{ event_key: `nse|${symbol ?? company}|${event_date}|${purpose}`, symbol, company, event_date, purpose, detail: str(r.bm_desc), source: "nse" as const }];
  });
}

/** Results dates BSE lists ahead, by scrip code; `symbolOf` maps codes we track to NSE symbols. */
export function parseBseResultsCalendar(raw: unknown, symbolOf: Map<string, string>): CalendarEvent[] {
  return (Array.isArray(raw) ? raw : []).filter(isRecord).flatMap((r) => {
    const code = str(r.scrip_Code);
    const company = str(r.Long_Name) ?? str(r.short_name);
    const event_date = isoDate(r.meeting_date);
    if (!code || !company || !event_date) return [];
    const symbol = symbolOf.get(code) ?? null;
    return [{ event_key: `bse|${code}|${event_date}|results`, symbol, company, event_date, purpose: "Financial Results", detail: null, source: "bse" as const }];
  });
}
