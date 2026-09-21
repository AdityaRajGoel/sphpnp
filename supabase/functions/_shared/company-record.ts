// What the exchanges have on record for one company, read from our own tables
// (the free-sources and market-data syncs fill them) and turned into a prompt
// section for ai-stock-analysis. Without it the report saw only Yahoo, and said
// nothing about a promoter selling, a pledge, or a block deal the day before.
//
// fetchCompanyRecord never throws: every query is optional context, and a slow
// or failed one drops out instead of costing the report.

// deno-lint-ignore no-explicit-any
type Sb = any;

export interface CompanyRecord {
  shareholding: { quarter_end: string; promoter_pct: number | null }[];
  insider: { person: string; category: string | null; transaction: string; mode: string | null; value: number | null; traded_to: string | null }[];
  pledge: { shp_date: string; pledged_pct_of_promoter: number | null } | null;
  deals: { trade_date: string; kind: string; client: string | null; side: string | null; quantity: number | null; price: number | null }[];
  delivery: { trade_date: string; deliv_pct: number | null }[];
  filings: { subject: string; critical: boolean; published_at: string | null }[];
  score: {
    period_end: string; piotroski_score: number | null; piotroski_testable: number | null;
    net_debt_to_equity: number | null; cash_conversion: number | null; fcf_yield: number | null;
    revenue_cagr_3y: number | null; profit_cagr_3y: number | null;
  } | null;
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

export async function fetchCompanyRecord(sb: Sb, symbol: string, timeoutMs = 4_000): Promise<CompanyRecord> {
  const rows = async <T>(q: PromiseLike<{ data: T[] | null }>): Promise<T[]> => {
    try {
      const timeout = new Promise<{ data: null }>((r) => setTimeout(() => r({ data: null }), timeoutMs));
      return (await Promise.race([q, timeout])).data ?? [];
    } catch {
      return [];
    }
  };
  const [shareholding, insider, pledge, deals, delivery, filings, score] = await Promise.all([
    rows(sb.from("nse_shareholding_filings").select("quarter_end, promoter_pct").eq("symbol", symbol).order("quarter_end", { ascending: false }).limit(5)),
    rows(sb.from("nse_insider_trades").select("person, category, transaction, mode, value, traded_to").eq("symbol", symbol).gte("traded_to", daysAgo(90)).in("transaction", ["buy", "sell", "pledge"]).order("value", { ascending: false }).limit(40)),
    rows(sb.from("nse_shareholding_filings").select("shp_date:quarter_end, pledged_pct_of_promoter:promoter_pledged_pct").eq("symbol", symbol).not("promoter_pledged_pct", "is", null).order("quarter_end", { ascending: false }).limit(1)),
    rows(sb.from("deal_history").select("trade_date, kind, client, side, quantity, price").eq("symbol", symbol).gte("trade_date", daysAgo(30)).in("kind", ["bulk", "block"]).order("trade_date", { ascending: false }).limit(5)),
    rows(sb.from("eq_eod").select("trade_date, deliv_pct").eq("symbol", symbol).eq("exchange", "NSE").order("trade_date", { ascending: false }).limit(20)),
    rows(sb.from("bse_announcements").select("subject, critical, published_at").eq("symbol", symbol).gte("published_at", daysAgo(30)).order("published_at", { ascending: false }).limit(6)),
    rows(sb.from("stock_fundamental_scores").select("period_end, piotroski_score, piotroski_testable, net_debt_to_equity, cash_conversion, fcf_yield, revenue_cagr_3y, profit_cagr_3y").eq("symbol", symbol).order("period_end", { ascending: false }).limit(1)),
  ]);
  return {
    shareholding, insider, deals, delivery, filings,
    pledge: pledge[0] ?? null,
    score: score[0] ?? null,
  } as CompanyRecord;
}

const cr = (rupees: number) => `₹${(rupees / 1e7).toFixed(rupees >= 1e8 ? 0 : 2)} Cr`;
const pct = (n: number, dp = 1) => `${n.toFixed(dp)}%`;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const isPromoter = (c: string | null) => /promoter/i.test(c ?? "");

/** Markdown for the report prompt; "" when we hold nothing on this company. */
export function formatCompanyRecord(r: CompanyRecord): string {
  const out: string[] = [];

  const sh = r.shareholding.filter((s) => s.promoter_pct !== null);
  if (sh.length) {
    const [now, ...before] = sh;
    const oldest = before.at(-1);
    const change = oldest ? now.promoter_pct! - oldest.promoter_pct! : null;
    out.push(`- **Promoter holding**: ${pct(now.promoter_pct!, 2)} (quarter ended ${now.quarter_end})` +
      (change === null ? "" : `; ${change >= 0 ? "+" : ""}${change.toFixed(2)} pts since ${oldest!.quarter_end}`));
  }

  if (r.pledge?.pledged_pct_of_promoter != null) {
    out.push(`- **Promoter pledge**: ${pct(r.pledge.pledged_pct_of_promoter, 2)} of promoter shares pledged (as of ${r.pledge.shp_date})`);
  }

  // Open-market trades only: ESOP exercises, gifts and inter-se transfers are
  // not anyone deciding the price is right.
  const trades = r.insider.filter((t) => t.value !== null && t.value > 0 && /^market/i.test(t.mode ?? ""));
  if (trades.length) {
    const sum = (side: string, promoterOnly: boolean) =>
      trades.filter((t) => t.transaction === side && (!promoterOnly || isPromoter(t.category))).reduce((a, t) => a + t.value!, 0);
    const buys = sum("buy", false), sells = sum("sell", false);
    const pBuys = sum("buy", true), pSells = sum("sell", true);
    out.push(`- **Insider open-market trades (SEBI PIT, last 90 days)**: bought ${cr(buys)}, sold ${cr(sells)}` +
      (pBuys || pSells ? ` - of which promoter group bought ${cr(pBuys)}, sold ${cr(pSells)}` : ""));
    for (const t of trades.slice(0, 3)) {
      out.push(`  - ${t.person}${t.category ? ` (${t.category})` : ""}: ${t.transaction} ${cr(t.value!)}${t.traded_to ? ` on ${t.traded_to}` : ""}`);
    }
  }

  for (const d of r.deals) {
    const qty = d.quantity ? `${(d.quantity / 1e5).toFixed(2)} lakh shares` : "";
    out.push(`- **${d.kind} deal** ${d.trade_date}: ${d.client ?? "undisclosed"} ${d.side ?? ""} ${qty}${d.price ? ` @ ₹${d.price}` : ""}`.replace(/\s+/g, " "));
  }

  const dv = r.delivery.map((d) => d.deliv_pct).filter((x): x is number => x !== null);
  if (dv.length >= 10) {
    const recent = avg(dv.slice(0, 5)), prior = avg(dv.slice(5));
    out.push(`- **Delivery %** (NSE): last 5 sessions avg ${pct(recent)} vs ${pct(prior)} over the ${dv.length - 5} sessions before`);
  }

  const s = r.score;
  if (s) {
    const parts = [
      s.piotroski_score !== null && s.piotroski_testable ? `Piotroski ${s.piotroski_score}/${s.piotroski_testable} testable` : null,
      s.revenue_cagr_3y !== null ? `3Y revenue CAGR ${pct(s.revenue_cagr_3y)}` : null,
      s.profit_cagr_3y !== null ? `3Y profit CAGR ${pct(s.profit_cagr_3y)}` : null,
      s.net_debt_to_equity !== null ? `net debt/equity ${s.net_debt_to_equity.toFixed(2)}` : null,
      s.cash_conversion !== null ? `operating cash/profit ${s.cash_conversion.toFixed(2)}x` : null,
      s.fcf_yield !== null ? `FCF yield ${pct(s.fcf_yield * 100)}` : null,
    ].filter(Boolean);
    if (parts.length) out.push(`- **Quality scores** (period ${s.period_end}): ${parts.join(" · ")}`);
  }

  for (const f of r.filings.slice(0, 5)) {
    out.push(`- **Filing** ${f.published_at?.slice(0, 10) ?? ""}${f.critical ? " [critical]" : ""}: ${f.subject.slice(0, 160)}`);
  }

  if (!out.length) return "";
  return `## 🗂️ On-Record Disclosures (NSE/BSE filings)
${out.join("\n")}

These come from exchange filings, not estimates. Use them in the Fundamental Assessment and Risk Factors: rising or falling promoter holding, any pledge, heavy promoter selling, and large bulk/block deals are material and must be mentioned if present. Do not invent disclosures that are not listed here.`;
}
