// Two NSE disclosures per listed stock, from the exchange's own JSON API:
//
//   corporate-share-holdings-master   each quarter's shareholding-pattern
//                                     filing: promoter and public %, and the
//                                     filing's XBRL.
//   corporates-pit                    insider trades under SEBI's Prohibition
//                                     of Insider Trading rules - who, buy or
//                                     sell, how many, at what value.
//
// Both need NSE_HEADERS (a real browser User-Agent); see _shared/nse.ts.
// Pure: no fetch, no Deno APIs. sync-nse-disclosures does the I/O.

export type ShareholdingFiling = {
  symbol: string;
  quarter_end: string;
  promoter_pct: number | null;
  public_pct: number | null;
  employee_trust_pct: number | null;
  xbrl_url: string | null;
  filed_at: string | null;
  record_id: string;
};

export type InsiderTrade = {
  symbol: string;
  /** NSE's disclosure id - stable, unique per trade line. */
  disclosure_id: string;
  person: string;
  category: string | null;
  transaction: "buy" | "sell" | "pledge" | "revoke" | "other";
  mode: string | null;
  security: string | null;
  quantity: number | null;
  value: number | null;
  holding_after_pct: number | null;
  traded_from: string | null;
  traded_to: string | null;
  disclosed_at: string | null;
  xbrl_url: string | null;
};

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" && v.trim() && v.trim() !== "-" ? v.trim() : null);
const num = (v: unknown) => {
  const s = str(v)?.replace(/,/g, "");
  if (!s || !/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
};

/** "30-JUN-2026" or "13-Feb-2026" -> "2026-06-30". */
export function nseDate(value: unknown): string | null {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(str(value) ?? "");
  const month = m ? MONTHS[m[2].toLowerCase()] : undefined;
  return m && month ? `${m[3]}-${month}-${m[1].padStart(2, "0")}` : null;
}

/** "16-JUL-2026 19:24:44" or "18-Feb-2026 19:06" (IST) -> an ISO timestamp. */
export function nseTimestamp(value: unknown): string | null {
  const date = nseDate(value);
  if (!date) return null;
  const time = /\s(\d{2}):(\d{2})(?::(\d{2}))?/.exec(str(value) ?? "");
  const hh = time?.[1] ?? "00", mm = time?.[2] ?? "00", ss = time?.[3] ?? "00";
  const t = Date.parse(`${date}T${hh}:${mm}:${ss}+05:30`);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

const xbrl = (v: unknown) => {
  const s = str(v);
  return s && /^https:\/\/nsearchives\.nseindia\.com\//.test(s) ? s : null;
};

/** One row per quarterly shareholding filing, newest first. A revision replaces the original for its quarter. */
export function parseShareholdingMaster(raw: unknown, symbol: string): ShareholdingFiling[] {
  if (!Array.isArray(raw)) return [];
  const byQuarter = new Map<string, ShareholdingFiling>();
  for (const row of raw.filter(isRecord)) {
    const quarter_end = nseDate(row.date);
    const record_id = str(row.recordId);
    if (!quarter_end || !record_id) continue;
    const filing: ShareholdingFiling = {
      symbol,
      quarter_end,
      promoter_pct: num(row.pr_and_prgrp),
      public_pct: num(row.public_val),
      employee_trust_pct: num(row.employeeTrusts),
      xbrl_url: xbrl(row.xbrl),
      filed_at: nseTimestamp(row.broadcastDate) ?? nseTimestamp(row.submissionDate),
      record_id,
    };
    const existing = byQuarter.get(quarter_end);
    if (!existing || (filing.filed_at ?? "") > (existing.filed_at ?? "")) byQuarter.set(quarter_end, filing);
  }
  return [...byQuarter.values()].sort((a, b) => b.quarter_end.localeCompare(a.quarter_end));
}

function transactionOf(type: string | null): InsiderTrade["transaction"] {
  const t = (type ?? "").toLowerCase();
  if (t === "buy") return "buy";
  if (t === "sell") return "sell";
  if (t.includes("revoke") || t.includes("release")) return "revoke";
  if (t.includes("pledge") || t.includes("invoke")) return "pledge";
  return "other";
}

/** Insider trades, newest disclosure first. */
export function parseInsiderTrades(raw: unknown, symbol: string): InsiderTrade[] {
  const rows = isRecord(raw) && Array.isArray(raw.data) ? raw.data : Array.isArray(raw) ? raw : [];
  const trades: InsiderTrade[] = [];
  for (const row of rows.filter(isRecord)) {
    const disclosure_id = str(row.did);
    const person = str(row.acqName);
    if (!disclosure_id || !person) continue;
    if (str(row.symbol) && str(row.symbol) !== symbol) continue;
    trades.push({
      symbol,
      disclosure_id,
      person,
      category: str(row.personCategory),
      transaction: transactionOf(str(row.tdpTransactionType)),
      mode: str(row.acqMode),
      security: str(row.secType),
      quantity: num(row.secAcq),
      value: num(row.secVal),
      holding_after_pct: num(row.afterAcqSharesPer),
      traded_from: nseDate(row.acqfromDt),
      traded_to: nseDate(row.acqtoDt),
      disclosed_at: nseTimestamp(row.date),
      xbrl_url: xbrl(row.xbrl),
    });
  }
  return trades.map(sanedDates).sort((a, b) => (b.disclosed_at ?? "").localeCompare(a.disclosed_at ?? ""));
}

/**
 * A trade cannot happen after it was disclosed. Companies do mistype these
 * (SOLARINDS filed "09-Nov-2026" in September 2026), and a future date sorts the
 * trade to the top of every "latest" list and out of every date window.
 */
function sanedDates(t: InsiderTrade): InsiderTrade {
  const day = t.disclosed_at?.slice(0, 10);
  if (!day) return t;
  const ok = (d: string | null) => (d && d > day ? null : d);
  return { ...t, traded_from: ok(t.traded_from), traded_to: ok(t.traded_to) };
}

/** One filing from corporates-pit-gg, NSE's insider-trading list since May 2026. */
export type PitFiling = { appId: string; xbrlUrl: string; disclosedAt: string | null };

export function parsePitFilings(raw: unknown, symbol: string): PitFiling[] {
  const rows = isRecord(raw) && Array.isArray(raw.data) ? raw.data : [];
  return rows.filter(isRecord).flatMap((r) => {
    const appId = str(r.appId);
    const xbrlUrl = xbrl(r.xmlFileName);
    if (!appId || !xbrlUrl || (str(r.symbol) && str(r.symbol) !== symbol)) return [];
    return [{ appId, xbrlUrl, disclosedAt: nseTimestamp(r.broadcastDateTime ?? r.exchdisstime) }];
  });
}

/**
 * The trades inside one Regulation 7 filing: NSE stopped putting them in the
 * corporates-pit JSON after April 2026, so they are read from the XBRL, which
 * carries one "DisclosureN" context per trade line.
 */
export function parseInsiderXbrl(xml: string, symbol: string, filing: PitFiling): InsiderTrade[] {
  const byContext = new Map<string, Record<string, string>>();
  const fact = /<[\w-]+:(\w+)\b[^>]*\bcontextRef="(Disclosure\d+)"[^>]*>([^<]*)</g;
  for (const [, name, ctx, value] of xml.matchAll(fact)) {
    const facts = byContext.get(ctx) ?? {};
    facts[name] = value.trim();
    byContext.set(ctx, facts);
  }
  const trades: InsiderTrade[] = [];
  for (const [ctx, f] of byContext) {
    const person = str(f.NameOfThePerson);
    if (!person) continue;
    const iso = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
    trades.push(sanedDates({
      symbol,
      disclosure_id: `gg:${filing.appId}:${ctx}`,
      person,
      category: str(f.CategoryOfPerson),
      transaction: transactionOf(str(f.SecuritiesAcquiredOrDisposedTransactionType)),
      mode: str(f.ModeOfAcquisitionOrDisposal),
      security: str(f.TypeOfInstrument),
      quantity: num(f.SecuritiesAcquiredOrDisposedNumberOfSecurity),
      value: num(f.SecuritiesAcquiredOrDisposedValueOfSecurity),
      holding_after_pct: num(f.SecuritiesHeldPostAcquistionOrDisposalPercentageOfShareholding),
      traded_from: iso(f.DateOfAllotmentAdviceOrAcquisitionOfSharesOrSaleOfSharesSpecifyFromDate),
      traded_to: iso(f.DateOfAllotmentAdviceOrAcquisitionOfSharesOrSaleOfSharesSpecifyToDate),
      disclosed_at: filing.disclosedAt,
      xbrl_url: filing.xbrlUrl,
    }));
  }
  return trades;
}

/**
 * The promoter group's holding and pledge from a shareholding-pattern XBRL
 * (the "ShareholdingOfPromoterAndPromoterGroup" total). Null when the filing
 * has no promoter total, as for a company with no promoter.
 */
export function parseShpPledge(xml: string): { promoter_shares: number; promoter_pledged_shares: number; promoter_pledged_pct: number } | null {
  const fact = (name: string) => {
    const m = new RegExp(`<[\\w-]+:${name}\\b[^>]*contextRef="ShareholdingOfPromoterAndPromoterGroup_ContextI"[^>]*>([^<]*)<`).exec(xml);
    return m ? num(m[1]) : null;
  };
  const held = fact("NumberOfShares");
  if (!held) return null;
  const pledged = fact("NumberOfSharesEncumberedUnderPledged") ?? 0;
  return { promoter_shares: held, promoter_pledged_shares: pledged, promoter_pledged_pct: (pledged / held) * 100 };
}
