// One line on a company's latest quarter: revenue and profit against the same
// quarter a year earlier, and the net margin. Read from fundamentals_income.
//
// Rows come from several sources; the company's own NSE filing wins, and a
// quarter is only compared with a year-earlier quarter from the same source and
// the same basis. Yahoo has labelled standalone figures as consolidated
// (RELIANCE, March 2026), and a comparison across bases reads as a swing that
// never happened.

export type IncomeRow = {
  period_end: string; is_consolidated: boolean; source: string;
  revenue: number | null; profit_after_tax: number | null;
};

export type ResultsSummary = {
  period_end: string; label: string; basis: "consolidated" | "standalone";
  revenue: number; revenue_yoy: number | null;
  profit: number | null; profit_yoy: number | null; net_margin: number | null;
  text: string;
};

const SOURCE_RANK: Record<string, number> = { nse_xbrl: 0, screener_in: 1, indianapi: 2, yahoo: 3 };

/** "2026-06-30" -> "Q1 FY27" (Indian fiscal year, April to March). */
export function fiscalQuarter(periodEnd: string): string {
  const [y, m] = periodEnd.split("-").map(Number);
  const q = m >= 4 && m <= 6 ? 1 : m <= 9 && m >= 7 ? 2 : m >= 10 ? 3 : 4;
  const fy = m >= 4 ? y + 1 : y;
  return `Q${q} FY${String(fy).slice(2)}`;
}

const crore = (rupees: number) => `₹${Math.round(rupees / 1e7).toLocaleString("en-IN")} Cr`;
const growth = (now: number | null, then: number | null) =>
  now === null || then === null || then <= 0 ? null : ((now - then) / then) * 100;
const signed = (pct: number) => `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;

export function resultsSummary(rows: IncomeRow[]): ResultsSummary | null {
  const usable = rows.filter((r) => r.revenue !== null && r.revenue > 0);
  if (usable.length === 0) return null;
  const rank = (r: IncomeRow) => (SOURCE_RANK[r.source] ?? 9) * 2 + (r.is_consolidated ? 0 : 1);
  const latestPeriod = usable.map((r) => r.period_end).sort().at(-1)!;
  const latest = usable.filter((r) => r.period_end === latestPeriod).sort((a, b) => rank(a) - rank(b))[0];

  const yearAgo = `${Number(latestPeriod.slice(0, 4)) - 1}${latestPeriod.slice(4)}`;
  const prior = usable.find((r) => r.period_end === yearAgo && r.source === latest.source && r.is_consolidated === latest.is_consolidated) ?? null;

  const revenue = latest.revenue!;
  const profit = latest.profit_after_tax;
  const revenue_yoy = growth(revenue, prior?.revenue ?? null);
  const profit_yoy = growth(profit, prior?.profit_after_tax ?? null);
  const net_margin = profit === null ? null : (profit / revenue) * 100;
  const label = fiscalQuarter(latestPeriod);

  const parts = [
    `revenue ${crore(revenue)}${revenue_yoy === null ? "" : ` (${signed(revenue_yoy)} YoY)`}`,
    profit === null ? null : `net profit ${crore(profit)}${profit_yoy === null ? "" : ` (${signed(profit_yoy)} YoY)`}`,
    net_margin === null ? null : `net margin ${net_margin.toFixed(1)}%`,
  ].filter(Boolean);

  return {
    period_end: latestPeriod, label, basis: latest.is_consolidated ? "consolidated" : "standalone",
    revenue, revenue_yoy, profit, profit_yoy, net_margin,
    text: `${label}: ${parts.join(", ")}`,
  };
}
