/**
 * FII and DII cash-market flows (NSE's provisional figures, stored daily in
 * market_flows by sync-market-feed) and FII index-futures positioning from the
 * participant-wise open interest. Pure functions for /fii-dii-data.
 */

export type FlowRecord = { activity_date: string; category: string; buy_cr: number; sell_cr: number };
export type Side = { buy: number; sell: number; net: number };
export type Session = { date: string; fii: Side | null; dii: Side | null };

const side = (r: FlowRecord | undefined): Side | null =>
  r && Number.isFinite(r.buy_cr) && Number.isFinite(r.sell_cr) ? { buy: r.buy_cr, sell: r.sell_cr, net: r.buy_cr - r.sell_cr } : null;

/** One row per trading day, newest first, from the fii_cash and dii_cash records. */
export function toSessions(rows: FlowRecord[]): Session[] {
  const byDate = new Map<string, { fii?: FlowRecord; dii?: FlowRecord }>();
  for (const r of rows) {
    if (r.category !== "fii_cash" && r.category !== "dii_cash") continue;
    const day = byDate.get(r.activity_date) ?? {};
    day[r.category === "fii_cash" ? "fii" : "dii"] = r;
    byDate.set(r.activity_date, day);
  }
  return [...byDate.entries()]
    .map(([date, d]) => ({ date, fii: side(d.fii), dii: side(d.dii) }))
    .filter((s) => s.fii || s.dii)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export type Totals = { fii: number; dii: number; sessions: number };

/** Net buying summed over the latest `n` sessions. */
export function netOver(sessions: Session[], n: number): Totals {
  const window = sessions.slice(0, n);
  return {
    fii: window.reduce((a, s) => a + (s.fii?.net ?? 0), 0),
    dii: window.reduce((a, s) => a + (s.dii?.net ?? 0), 0),
    sessions: window.length,
  };
}

/** Net buying per calendar month, newest first. */
export function monthlyTotals(sessions: Session[]): (Totals & { month: string })[] {
  const months = new Map<string, Totals>();
  for (const s of sessions) {
    const m = s.date.slice(0, 7);
    const t = months.get(m) ?? { fii: 0, dii: 0, sessions: 0 };
    months.set(m, { fii: t.fii + (s.fii?.net ?? 0), dii: t.dii + (s.dii?.net ?? 0), sessions: t.sessions + 1 });
  }
  return [...months.entries()].map(([month, t]) => ({ month, ...t })).sort((a, b) => b.month.localeCompare(a.month));
}

/** How many sessions in a row, ending at the latest, the group was a net buyer (positive) or seller (negative). */
export function streak(sessions: Session[], who: "fii" | "dii"): number {
  const first = sessions[0]?.[who]?.net;
  if (first === undefined || first === 0) return 0;
  const sign = Math.sign(first);
  let n = 0;
  for (const s of sessions) {
    const net = s[who]?.net;
    if (net === undefined || Math.sign(net) !== sign) break;
    n += 1;
  }
  return sign * n;
}

export type OiRecord = { trade_date: string; client_type: string; fut_idx_long: number | null; fut_idx_short: number | null };

/** FII long contracts as a share of their index-futures open interest, oldest first. */
export function fiiIndexLongShare(rows: OiRecord[]): { date: string; longPct: number; long: number; short: number }[] {
  return rows
    .filter((r) => r.client_type === "FII" && (r.fut_idx_long ?? 0) + (r.fut_idx_short ?? 0) > 0)
    .map((r) => {
      const long = r.fut_idx_long ?? 0, short = r.fut_idx_short ?? 0;
      return { date: r.trade_date, longPct: (long / (long + short)) * 100, long, short };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
