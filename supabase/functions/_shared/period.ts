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

const MONTHS_PER_QUARTER = 3;
const TRAILING_QUARTERS = 4;

/** Months since epoch, for checking that two period ends are exactly one
 * fiscal quarter apart without being sensitive to which day of the month a
 * filing happens to land on. Null on an unparseable period_end so callers
 * fail closed instead of comparing NaNs. */
function monthIndex(periodEnd: string): number | null {
  const d = new Date(periodEnd);
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

/**
 * Sum of the trailing four quarters ending at `sorted[anchorIndex]`, or null
 * when that trailing window is not genuinely four consecutive quarters with
 * a usable figure in each.
 *
 * This is the fix for the "single quarter rendered as an annual ratio"
 * defect: fundamentals_income holds one XBRL OneD quarter's profit per row,
 * and every other source (Screener.in, Moneycontrol) shows ROE/ROCE as a
 * trailing-twelve-month figure. Handing a lone quarter's profit to a ratio
 * labelled without qualification reads as a real number and is roughly 4x
 * too low.
 *
 * Two ways this can fail closed rather than guess:
 *  - Fewer than four rows precede the anchor (`sorted`) -> null.
 *  - A gap: the four rows are not each exactly one quarter apart (a missed
 *    filing between them would silently stretch the window past a year and
 *    overstate the sum while still being labelled "TTM") -> null.
 *  - Any of the four quarters' figures is missing or non-finite -> null.
 *    Treating a missing quarter as zero profit would understate the sum
 *    exactly as silently as the defect this function exists to close.
 *
 * Deliberately NOT done here: annualising a shorter run by multiplying by
 * 4/n. That trades one silent-wrong-number defect for another - see the task
 * note this function was written against.
 */
function trailingFourQuarterSum(
  sorted: IncomeLike[],
  anchorIndex: number,
  pick: (row: IncomeLike) => number | null,
): number | null {
  if (anchorIndex < TRAILING_QUARTERS - 1) return null;
  const window = sorted.slice(anchorIndex - (TRAILING_QUARTERS - 1), anchorIndex + 1);

  const months = window.map((row) => monthIndex(row.period_end));
  if (months.some((m) => m === null)) return null;
  for (let i = 1; i < months.length; i++) {
    if ((months[i] as number) - (months[i - 1] as number) !== MONTHS_PER_QUARTER) return null;
  }

  let sum = 0;
  for (const row of window) {
    const value = pick(row);
    if (value === null || !Number.isFinite(value)) return null;
    sum += value;
  }
  return sum;
}

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
 *
 * profitAfterTax/profitBeforeTax on the returned RatioInput are trailing-
 * four-quarter (TTM) sums, not the anchor period's own single-quarter figure
 * - see trailingFourQuarterSum. `income` need not arrive sorted; it is
 * sorted locally by period_end before the trailing window is computed, since
 * the Supabase read that produces it carries no ORDER BY.
 */
export function alignPeriods(
  income: IncomeLike[],
  balance: BalanceLike[],
  cashflow: CashflowLike[],
): Array<{ periodEnd: string; input: RatioInput }> {
  const balByPeriod = new Map(balance.map((b) => [b.period_end, b]));
  const cfByPeriod = new Map(cashflow.map((c) => [c.period_end, c]));

  const sortedIncome = [...income].sort(
    (a, b) => new Date(a.period_end).getTime() - new Date(b.period_end).getTime(),
  );
  const anchorIndexByPeriod = new Map(sortedIncome.map((row, idx) => [row.period_end, idx]));

  return income.flatMap((i) => {
    const b = balByPeriod.get(i.period_end);
    const c = cfByPeriod.get(i.period_end);
    if (!b || !c) return [];
    const anchorIndex = anchorIndexByPeriod.get(i.period_end) as number;
    return [{
      periodEnd: i.period_end,
      input: {
        profitAfterTax: trailingFourQuarterSum(sortedIncome, anchorIndex, (row) => row.profit_after_tax),
        profitBeforeTax: trailingFourQuarterSum(sortedIncome, anchorIndex, (row) => row.profit_before_tax),
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
