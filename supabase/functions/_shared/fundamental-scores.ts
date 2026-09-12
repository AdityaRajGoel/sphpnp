/**
 * Composite fundamental scores and the balance-sheet quality ratios this repo
 * does not already compute, from fundamentals_income / _balance / _cashflow.
 *
 * WHAT IS DELIBERATELY ABSENT, so nobody re-derives the gap from scratch:
 *
 *  - Altman Z-Score. Two of its five terms have no input here: retained
 *    earnings is not a stored line item, and EBIT needs an interest expense
 *    that neither the XBRL nor the Yahoo statements carry. A Z-Score missing
 *    retained earnings is not a weaker Z-Score, it is a different number
 *    wearing the name of a well-known one, which is worse than no score.
 *  - Quick ratio and working-capital days. No inventory, receivables or
 *    payables line items, and there is no honest proxy for them.
 *  - EV/EBITDA. Depreciation is not stored, so EBITDA cannot be built;
 *    enterprise value over SALES is computable and is provided instead.
 *
 * Periods are expected newest-first, as the fundamentals tables return them
 * ordered by period_end desc.
 */

export type IncomePeriod = {
  period_end: string;
  revenue?: number | null;
  total_income?: number | null;
  total_expenses?: number | null;
  profit_after_tax?: number | null;
};

export type BalancePeriod = {
  period_end: string;
  total_assets?: number | null;
  total_debt?: number | null;
  total_equity?: number | null;
  cash_and_equivalents?: number | null;
  current_assets?: number | null;
  current_liabilities?: number | null;
};

export type CashflowPeriod = {
  period_end: string;
  operating_cf?: number | null;
  capex?: number | null;
  free_cash_flow?: number | null;
};

const finite = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Division that refuses a zero or missing denominator instead of returning Infinity. */
const ratio = (numerator: number | null | undefined, denominator: number | null | undefined): number | null =>
  finite(numerator) && finite(denominator) && denominator !== 0 ? numerator / denominator : null;

/**
 * Collapses fundamentals_income to ONE reporting basis.
 *
 * This is not a tidying step. fundamentals_income is unique on
 * (symbol, period_end, is_consolidated), so a symbol routinely holds two rows
 * per period - consolidated and standalone - and on live data roughly half of
 * all rows are such a pair. Scoring across both mixes a standalone profit into
 * a consolidated balance sheet, which is the exact cross-basis mismatch that
 * has already cost this repo a correctness incident in fundamentals_derived.
 *
 * Consolidated wins when the symbol reports it at all, because that is what
 * the balance sheet and cash flow sources (Yahoo) report - the point is that
 * every number in a score comes from the same set of books, not which set.
 */
export function oneReportingBasis<T extends { period_end: string; is_consolidated?: boolean | null }>(rows: T[]): T[] {
  if (rows.length === 0) return rows;
  const consolidated = rows.filter((row) => row.is_consolidated === true);
  const chosen = consolidated.length > 0 ? consolidated : rows.filter((row) => row.is_consolidated !== true);

  // One row per period even within a basis: a re-filed period can appear twice,
  // and the first of an ordered list is the one to keep.
  const seen = new Set<string>();
  return chosen.filter((row) => {
    if (seen.has(row.period_end)) return false;
    seen.add(row.period_end);
    return true;
  });
}

export type Criterion = {
  name: string;
  /** null means the input for this test was absent - not a fail. */
  passed: boolean | null;
  /** Why it could not be tested, when it could not be. */
  unavailable?: string;
};

export type PiotroskiResult = {
  /** Criteria passed. */
  score: number;
  /**
   * Criteria that could actually be tested. NOT always 9, and the pair must be
   * shown together: "6 of 8 tested" is a fact, "6 of 9" would imply a symbol
   * failed a test that was never run.
   */
  testable: number;
  criteria: Criterion[];
};

/**
 * Piotroski's F-Score across two consecutive annual periods.
 *
 * Two of the nine tests are adapted to the line items available, and both
 * substitutions are recorded here rather than hidden:
 *
 *  - The original tests LONG-TERM debt over assets. Only total debt is stored,
 *    so total debt over assets is used. A company that shifted borrowing from
 *    long to short term therefore scores differently here than it would on the
 *    original definition.
 *  - The original tests GROSS margin. There is no cost-of-goods line, so
 *    operating margin - (total income - total expenses) / revenue - stands in.
 *
 * The ninth test, "issued no new equity", has no substitute: nothing here
 * stores a share count, and financing cash flow mixes equity with debt. It is
 * reported as untestable rather than quietly assumed passed, which is what
 * turns a 9-point score into an 8-point one for most symbols.
 */
export function piotroskiScore(
  income: IncomePeriod[],
  balance: BalancePeriod[],
  cashflow: CashflowPeriod[],
): PiotroskiResult | null {
  if (income.length < 2 || balance.length < 2) return null;
  const [income0, income1] = income;
  const [balance0, balance1] = balance;
  const cash0 = cashflow[0];
  const cash1 = cashflow[1];

  const roa0 = ratio(income0.profit_after_tax, balance0.total_assets);
  const roa1 = ratio(income1.profit_after_tax, balance1.total_assets);
  const cfo0 = cash0?.operating_cf;
  const currentRatio0 = ratio(balance0.current_assets, balance0.current_liabilities);
  const currentRatio1 = ratio(balance1.current_assets, balance1.current_liabilities);
  const leverage0 = ratio(balance0.total_debt, balance0.total_assets);
  const leverage1 = ratio(balance1.total_debt, balance1.total_assets);
  const turnover0 = ratio(income0.revenue, balance0.total_assets);
  const turnover1 = ratio(income1.revenue, balance1.total_assets);

  const operatingMargin = (period: IncomePeriod) =>
    finite(period.total_income) && finite(period.total_expenses)
      ? ratio(period.total_income - period.total_expenses, period.revenue)
      : null;
  const margin0 = operatingMargin(income0);
  const margin1 = operatingMargin(income1);

  // Accrual test: cash flow from operations should exceed reported profit.
  // Scaled by assets on both sides, as the original does.
  const cfoOverAssets = ratio(cfo0, balance0.total_assets);

  const test = (name: string, value: boolean | null, unavailable: string): Criterion =>
    value === null ? { name, passed: null, unavailable } : { name, passed: value };

  const criteria: Criterion[] = [
    test("Return on assets positive", roa0 === null ? null : roa0 > 0, "no profit or total assets figure"),
    test("Operating cash flow positive", finite(cfo0) ? cfo0 > 0 : null, "no cash flow statement"),
    test(
      "Return on assets improving",
      roa0 === null || roa1 === null ? null : roa0 > roa1,
      "needs two periods of profit and assets",
    ),
    test(
      "Cash flow exceeds profit",
      cfoOverAssets === null || roa0 === null ? null : cfoOverAssets > roa0,
      "needs cash flow and profit against assets",
    ),
    test(
      "Debt to assets falling",
      leverage0 === null || leverage1 === null ? null : leverage0 < leverage1,
      "no debt or total assets figure",
    ),
    test(
      "Current ratio improving",
      currentRatio0 === null || currentRatio1 === null ? null : currentRatio0 > currentRatio1,
      "no current assets or liabilities figure",
    ),
    {
      name: "No new equity issued",
      passed: null,
      unavailable: "no share count is collected, and financing cash flow mixes equity with debt",
    },
    test(
      "Operating margin improving",
      margin0 === null || margin1 === null ? null : margin0 > margin1,
      "needs total income and expenses for two periods",
    ),
    test(
      "Asset turnover improving",
      turnover0 === null || turnover1 === null ? null : turnover0 > turnover1,
      "needs revenue and assets for two periods",
    ),
  ];

  const tested = criteria.filter((criterion) => criterion.passed !== null);
  // A score from one or two surviving tests is noise wearing a famous name.
  if (tested.length < 5) return null;

  return {
    score: tested.filter((criterion) => criterion.passed).length,
    testable: tested.length,
    criteria,
  };
}

export type QualityMetrics = {
  /** Debt net of cash. Negative means the company holds more cash than debt. */
  net_debt: number | null;
  net_debt_to_equity: number | null;
  /**
   * (Profit - operating cash flow) / assets. High and positive means reported
   * profit is not arriving as cash - the single most-cited earnings-quality
   * warning, and computable from exactly what is stored.
   */
  accruals_ratio: number | null;
  /** Operating cash flow per rupee of reported profit. Below 1 is the flag. */
  cash_conversion: number | null;
  capex_intensity: number | null;
  free_cash_flow: number | null;
  fcf_yield: number | null;
  ev_to_sales: number | null;
  peg: number | null;
  /**
   * Dividend as a share of earnings. Derived from yield and P/E rather than a
   * dividends-paid line, which is not stored: yield is DPS/price and P/E is
   * price/EPS, so their product is DPS/EPS exactly.
   */
  payout_ratio: number | null;
};

export type MarketInputs = {
  market_cap?: number | null;
  pe?: number | null;
  dividend_yield_pct?: number | null;
  profit_growth_yoy_pct?: number | null;
};

export function qualityMetrics(
  income: IncomePeriod[],
  balance: BalancePeriod[],
  cashflow: CashflowPeriod[],
  market: MarketInputs = {},
): QualityMetrics {
  const income0 = income[0];
  const balance0 = balance[0];
  const cash0 = cashflow[0];

  const netDebt =
    finite(balance0?.total_debt) && finite(balance0?.cash_and_equivalents)
      ? balance0.total_debt - balance0.cash_and_equivalents
      : null;

  const freeCashFlow = finite(cash0?.free_cash_flow)
    ? cash0.free_cash_flow
    : finite(cash0?.operating_cf) && finite(cash0?.capex)
      // capex is stored as a negative outflow by Yahoo and a positive spend by
      // others, so it is added after being forced negative rather than
      // subtracted blindly - subtracting a negative capex would INFLATE free
      // cash flow, which is the wrong direction for a conservative measure.
      ? cash0.operating_cf - Math.abs(cash0.capex)
      : null;

  const accruals =
    finite(income0?.profit_after_tax) && finite(cash0?.operating_cf)
      ? ratio(income0.profit_after_tax - cash0.operating_cf, balance0?.total_assets)
      : null;

  const enterpriseValue =
    finite(market.market_cap) && netDebt !== null ? market.market_cap + netDebt : null;

  // A PEG on a shrinking or flat profit is not a cheap stock, it is a
  // meaningless ratio - a negative denominator would print an attractive-looking
  // negative PEG for a company whose profit is collapsing.
  const growth = market.profit_growth_yoy_pct;
  const peg = finite(market.pe) && finite(growth) && growth > 0 && market.pe > 0 ? market.pe / growth : null;

  return {
    net_debt: netDebt,
    net_debt_to_equity: netDebt === null ? null : ratio(netDebt, balance0?.total_equity),
    accruals_ratio: accruals,
    cash_conversion: ratio(cash0?.operating_cf, income0?.profit_after_tax),
    capex_intensity: finite(cash0?.capex) ? ratio(Math.abs(cash0.capex), income0?.revenue) : null,
    free_cash_flow: freeCashFlow,
    fcf_yield: freeCashFlow === null ? null : ratio(freeCashFlow, market.market_cap),
    ev_to_sales: enterpriseValue === null ? null : ratio(enterpriseValue, income0?.revenue),
    peg,
    payout_ratio:
      finite(market.dividend_yield_pct) && finite(market.pe) && market.pe > 0
        ? (market.dividend_yield_pct * market.pe) / 100
        : null,
  };
}

/**
 * Compound annual growth rate between the oldest and newest period, as a
 * percentage.
 *
 * Refuses a non-positive starting value: a company that moved from a loss to a
 * profit has no meaningful growth RATE, and the formula would otherwise return
 * a confident number from a negative base.
 */
export function cagr(values: number[], years: number): number | null {
  if (values.length < 2 || years <= 0) return null;
  const first = values[0];
  const last = values[values.length - 1];
  if (!finite(first) || !finite(last) || first <= 0 || last <= 0) return null;
  return ((last / first) ** (1 / years) - 1) * 100;
}
