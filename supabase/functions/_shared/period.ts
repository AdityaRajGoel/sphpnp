import type { RatioInput } from "./ratios.ts";

type IncomeLike = {
  period_end: string;
  profit_after_tax: number | null;
  profit_before_tax: number | null;
};
type BalanceLike = {
  period_end: string;
  total_equity: number | null;
  total_debt: number | null;
  current_assets: number | null;
  current_liabilities: number | null;
};
type CashflowLike = {
  period_end: string;
  operating_cf: number | null;
  capex: number | null;
};

/**
 * Build ratio inputs by joining the three sources on EXACT period_end.
 *
 * The income statement comes from NSE XBRL; the balance sheet and cash flow
 * come from Yahoo. Their period ends are independently produced and are not
 * guaranteed to agree. Pairing a quarter's profit with a different quarter's
 * equity produces an ROE that looks entirely reasonable and is wrong, which on
 * a SEBI-registered broker's page is worse than showing nothing.
 *
 * So: exact equality only. No rounding to quarter end, no nearest-match, no
 * tolerance window. A period that does not line up across all three sources
 * yields no derived row, and the page renders the ratio as unavailable.
 */
export function alignPeriods(
  income: IncomeLike[],
  balance: BalanceLike[],
  cashflow: CashflowLike[],
): Array<{ periodEnd: string; input: RatioInput }> {
  const balByPeriod = new Map(balance.map((b) => [b.period_end, b]));
  const cfByPeriod = new Map(cashflow.map((c) => [c.period_end, c]));

  return income.flatMap((i) => {
    const b = balByPeriod.get(i.period_end);
    const c = cfByPeriod.get(i.period_end);
    if (!b || !c) return [];
    return [{
      periodEnd: i.period_end,
      input: {
        profitAfterTax: i.profit_after_tax,
        profitBeforeTax: i.profit_before_tax,
        totalEquity: b.total_equity,
        totalDebt: b.total_debt,
        currentAssets: b.current_assets,
        currentLiabilities: b.current_liabilities,
        operatingCf: c.operating_cf,
        capex: c.capex,
      },
    }];
  });
}
