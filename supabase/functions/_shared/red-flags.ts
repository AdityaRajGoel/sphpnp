// Warning signs for one listed company, from exchange filings we already store.
// One rule set serves the stock page card, the portfolio view and the Telegram
// watchlist alerts, so a flag means the same thing everywhere it appears.
//
// Every rule states the figure that tripped it; a flag is a prompt to read the
// filing, not a verdict on the company.

// deno-lint-ignore no-explicit-any
type Sb = any;

export type Severity = "high" | "medium";
export type RedFlag = { id: string; severity: Severity; title: string; detail: string; date: string | null };

export type RedFlagInputs = {
  pledges: { shp_date: string; pledged_pct_of_promoter: number | null }[];
  holdings: { quarter_end: string; promoter_pct: number | null }[];
  trades: { category: string | null; transaction: string; mode: string | null; value: number | null; traded_to: string | null }[];
  surveillance: { flag: string; stage: string | null; as_of: string | null }[];
  score: { period_end: string; piotroski_score: number | null; piotroski_testable: number | null } | null;
  filings: { subject: string; critical: boolean; published_at: string | null }[];
};

/** Thresholds, named so the card and the alert copy can quote them. */
export const PLEDGE_HIGH_PCT = 25;
export const PROMOTER_SELL_CR = 1;
export const HOLDING_DROP_PTS = 2;
export const PIOTROSKI_WEAK = 3;
const DAYS = 86_400_000;

/**
 * Filings that are material whatever the exchange tagged them. BSE's own
 * "critical" marker is set on AGM notices, scrutinizer reports and routine
 * credit-rating letters (33 of 37 flags in a September 2026 sample), so it is
 * not used.
 */
const MATERIAL_FILING = new RegExp([
  "resignation of (the )?(statutory )?auditor", "auditor.{0,20}resign",
  "resignation of .{0,40}(chief financial|cfo|chief executive|ceo|managing director|whole[- ]time director|company secretary)",
  "\\bdefault", "insolvency", "\\bnclt\\b", "\\bibc\\b", "\\bfraud", "forensic", "search (and|&) seizure",
  "downgrad", "clarification sought", "sebi order", "show cause", "winding up",
].join("|"), "i");
/** NCLT also approves every merger and scheme of arrangement; those notices are routine. */
const ROUTINE_FILING = /merger|amalgamation|arrangement|demerger/i;

const cr = (rupees: number) => `₹${(rupees / 1e7).toFixed(rupees >= 1e9 ? 0 : 1)} Cr`;
const isoDaysAgo = (now: number, days: number) => new Date(now - days * DAYS).toISOString().slice(0, 10);

export function redFlags(i: RedFlagInputs, now = Date.now()): RedFlag[] {
  const flags: RedFlag[] = [];

  const [pledge, prevPledge] = i.pledges.filter((p) => p.pledged_pct_of_promoter !== null);
  if (pledge && pledge.pledged_pct_of_promoter! > 0) {
    const pct = pledge.pledged_pct_of_promoter!;
    const rose = prevPledge && pct > prevPledge.pledged_pct_of_promoter! + 0.01;
    if (pct >= PLEDGE_HIGH_PCT || rose) {
      flags.push({
        id: "pledge", severity: pct >= PLEDGE_HIGH_PCT ? "high" : "medium",
        title: rose ? "Promoter pledge went up" : "High promoter pledge",
        detail: `${pct.toFixed(2)}% of promoter shares pledged${rose ? `, up from ${prevPledge!.pledged_pct_of_promoter!.toFixed(2)}%` : ""}`,
        date: pledge.shp_date,
      });
    }
  }

  const since90 = isoDaysAgo(now, 90);
  const promoterMarket = i.trades.filter((t) =>
    /promoter/i.test(t.category ?? "") && /^market/i.test(t.mode ?? "") && (t.value ?? 0) > 0 && (t.traded_to ?? "") >= since90);
  const net = promoterMarket.reduce((a, t) => a + (t.transaction === "sell" ? -t.value! : t.transaction === "buy" ? t.value! : 0), 0);
  if (net <= -PROMOTER_SELL_CR * 1e7) {
    const last = promoterMarket.map((t) => t.traded_to!).sort().at(-1) ?? null;
    flags.push({ id: "promoter-selling", severity: net <= -25e7 ? "high" : "medium", title: "Promoters selling in the market", detail: `Promoter group sold a net ${cr(-net)} on the open market in 90 days`, date: last });
  }

  const held = i.holdings.filter((h) => h.promoter_pct !== null).slice(0, 5);
  if (held.length >= 2) {
    const drop = held.at(-1)!.promoter_pct! - held[0].promoter_pct!;
    if (drop >= HOLDING_DROP_PTS) {
      flags.push({ id: "holding-drop", severity: "medium", title: "Promoter holding falling", detail: `${held[0].promoter_pct!.toFixed(2)}%, down ${drop.toFixed(2)} pts since ${held.at(-1)!.quarter_end}`, date: held[0].quarter_end });
    }
  }

  for (const s of i.surveillance) {
    if (s.flag === "fo_ban") {
      flags.push({ id: "fo-ban", severity: "medium", title: "In the F&O ban period", detail: "Open interest crossed 95% of the market-wide limit; no fresh derivative positions", date: s.as_of });
    } else {
      const label = s.flag === "gsm" ? "Graded surveillance (GSM)" : "Additional surveillance (ASM)";
      flags.push({ id: `surveillance-${s.flag}`, severity: "high", title: `Under ${label}`, detail: `The exchange has put this stock under ${label}${s.stage ? `, ${s.stage}` : ""}`, date: s.as_of });
    }
  }

  const sc = i.score;
  if (sc && sc.piotroski_score !== null && (sc.piotroski_testable ?? 0) >= 7 && sc.piotroski_score <= PIOTROSKI_WEAK) {
    flags.push({ id: "piotroski", severity: "medium", title: "Weak financial health score", detail: `Piotroski ${sc.piotroski_score} of ${sc.piotroski_testable} tests passed`, date: sc.period_end });
  }

  const since30 = isoDaysAgo(now, 30);
  for (const f of i.filings.filter((f) => MATERIAL_FILING.test(f.subject) && !ROUTINE_FILING.test(f.subject) && (f.published_at ?? "") >= since30).slice(0, 2)) {
    flags.push({ id: `filing-${f.published_at}`, severity: "medium", title: "Material exchange filing", detail: f.subject.slice(0, 160), date: f.published_at?.slice(0, 10) ?? null });
  }

  return flags.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1));
}

/** Reads everything redFlags needs for one symbol; any query that fails counts as no data. */
export async function fetchRedFlagInputs(sb: Sb, symbol: string, now = Date.now()): Promise<RedFlagInputs> {
  return (await fetchRedFlagInputsMany(sb, [symbol], now)).get(symbol)!;
}

/** The same for many symbols in six queries, for a portfolio or a batch of alerts. */
export async function fetchRedFlagInputsMany(sb: Sb, symbols: string[], now = Date.now()): Promise<Map<string, RedFlagInputs>> {
  const rows = async <T>(q: PromiseLike<{ data: T[] | null }>): Promise<(T & { symbol: string })[]> => {
    try { return ((await q).data ?? []) as (T & { symbol: string })[]; } catch { return []; }
  };
  // ponytail: one .in() per table caps at PostgREST's 1,000 rows; fine for a portfolio, page it if batches grow.
  const [holdings, trades, surveillance, scores, filings] = await Promise.all([
    rows(sb.from("nse_shareholding_filings").select("symbol, quarter_end, promoter_pct, promoter_pledged_pct").in("symbol", symbols).gte("quarter_end", isoDaysAgo(now, 550)).order("quarter_end", { ascending: false }).limit(1000)),
    rows(sb.from("nse_insider_trades").select("symbol, category, transaction, mode, value, traded_to").in("symbol", symbols).gte("traded_to", isoDaysAgo(now, 90)).in("transaction", ["buy", "sell"]).limit(1000)),
    rows(sb.from("surveillance_flags").select("symbol, flag, stage, as_of").in("symbol", symbols)),
    rows(sb.from("stock_fundamental_scores").select("symbol, period_end, piotroski_score, piotroski_testable").in("symbol", symbols).order("period_end", { ascending: false }).limit(1000)),
    rows(sb.from("bse_announcements").select("symbol, subject, critical, published_at").in("symbol", symbols).gte("published_at", isoDaysAgo(now, 30)).order("published_at", { ascending: false }).limit(1000)),
  ]);
  const of = <T extends { symbol: string }>(list: T[], symbol: string) => list.filter((r) => r.symbol === symbol);
  const out = new Map<string, RedFlagInputs>();
  for (const symbol of symbols) {
    const shp = of(holdings, symbol) as unknown as { quarter_end: string; promoter_pct: number | null; promoter_pledged_pct: number | null }[];
    out.set(symbol, {
      pledges: shp.filter((h) => h.promoter_pledged_pct !== null).slice(0, 2).map((h) => ({ shp_date: h.quarter_end, pledged_pct_of_promoter: h.promoter_pledged_pct })),
      holdings: shp.slice(0, 5),
      trades: of(trades, symbol) as unknown as RedFlagInputs["trades"],
      surveillance: of(surveillance, symbol) as unknown as RedFlagInputs["surveillance"],
      score: (of(scores, symbol)[0] as unknown as RedFlagInputs["score"]) ?? null,
      filings: of(filings, symbol).slice(0, 60) as unknown as RedFlagInputs["filings"],
    });
  }
  return out;
}
