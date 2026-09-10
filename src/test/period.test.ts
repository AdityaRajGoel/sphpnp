import { describe, it, expect } from "vitest";
import { alignPeriods } from "../../supabase/functions/_shared/period";

const inc = (period_end: string, pat = 100, pbt = 130) =>
  ({ period_end, profit_after_tax: pat, profit_before_tax: pbt });
const bal = (period_end: string, eq = 500) =>
  ({ period_end, total_equity: eq, total_debt: 200, current_assets: 300, current_liabilities: 150 });
const cf = (period_end: string, op = 90) =>
  ({ period_end, operating_cf: op, capex: 30 });

describe("alignPeriods", () => {
  // THE DEFECT: fundamentals_income's profit_after_tax/profit_before_tax are
  // single-quarter XBRL OneD figures. RatiosPanel renders whatever lands in
  // input.profitAfterTax/profitBeforeTax under the bare labels "Return on
  // equity" / "Return on capital employed" - labels that read as annual
  // everywhere else in finance (Screener.in, Moneycontrol). Passing a lone
  // quarter's profit straight through, as this test used to assert, is
  // exactly that defect: a real ~14% annual ROE would render as ~3.4%. With
  // only one quarter of income history available there are not four trailing
  // quarters to sum, so the honest answer is "withheld", not "this one
  // quarter's figure, unlabelled".
  it("does not pass a lone quarter's profit through as if it were a trailing-twelve-month figure", () => {
    const out = alignPeriods([inc("2024-12-31")], [bal("2024-12-31")], [cf("2024-12-31")]);
    expect(out).toHaveLength(1);
    expect(out[0].periodEnd).toBe("2024-12-31");
    expect(out[0].input.profitAfterTax).toBeNull();
    expect(out[0].input.profitBeforeTax).toBeNull();
    // Everything else pairs through unaffected - only the profit figures
    // that feed ROE/ROCE are subject to the trailing-four-quarters rule.
    expect(out[0].input.totalEquity).toBe(500);
    expect(out[0].input.totalDebt).toBe(200);
    expect(out[0].input.currentAssets).toBe(300);
    expect(out[0].input.currentLiabilities).toBe(150);
    expect(out[0].input.operatingCf).toBe(90);
    expect(out[0].input.capex).toBe(30);
  });

  // The honest case this whole module exists to enable: four CONSECUTIVE
  // quarters (each exactly one quarter apart) sum to a real trailing-twelve-
  // month figure, matching what Screener.in/Moneycontrol show as annual ROE.
  it("sums the trailing four consecutive quarters of profit into the anchor period", () => {
    const income = [
      inc("2024-03-31", 100, 130),
      inc("2024-06-30", 110, 140),
      inc("2024-09-30", 120, 150),
      inc("2024-12-31", 130, 160),
    ];
    const balance = [bal("2024-12-31")];
    const cashflow = [cf("2024-12-31")];
    const out = alignPeriods(income, balance, cashflow);
    expect(out).toHaveLength(1);
    expect(out[0].input.profitAfterTax).toBe(100 + 110 + 120 + 130); // 460
    expect(out[0].input.profitBeforeTax).toBe(130 + 140 + 150 + 160); // 580
  });

  // Order-independence: the caller (a raw Supabase read with no ORDER BY)
  // does not guarantee the income rows arrive sorted.
  it("sums the trailing four quarters regardless of input order", () => {
    const income = [
      inc("2024-12-31", 130, 160),
      inc("2024-03-31", 100, 130),
      inc("2024-09-30", 120, 150),
      inc("2024-06-30", 110, 140),
    ];
    const out = alignPeriods(income, [bal("2024-12-31")], [cf("2024-12-31")]);
    expect(out[0].input.profitAfterTax).toBe(460);
  });

  // Never silently annualise a shorter run by pretending it is four quarters,
  // and never sum across a gap. A missing interim filing means the four most
  // recent rows for this symbol span more than a year - summing them would
  // silently overstate profit while still being labelled "(TTM)".
  it("withholds the TTM sum when a quarter is missing from the trailing window", () => {
    const income = [
      inc("2024-03-31", 100, 130),
      // Q2 (2024-06-30) never filed - gap.
      inc("2024-09-30", 120, 150),
      inc("2024-12-31", 130, 160),
    ];
    const out = alignPeriods(income, [bal("2024-12-31")], [cf("2024-12-31")]);
    expect(out[0].input.profitAfterTax).toBeNull();
    expect(out[0].input.profitBeforeTax).toBeNull();
  });

  // Three quarters of history is not four - withhold rather than guess.
  it("withholds the TTM sum when fewer than four quarters of history exist", () => {
    const income = [
      inc("2024-06-30", 110, 140),
      inc("2024-09-30", 120, 150),
      inc("2024-12-31", 130, 160),
    ];
    const out = alignPeriods(income, [bal("2024-12-31")], [cf("2024-12-31")]);
    expect(out[0].input.profitAfterTax).toBeNull();
  });

  // One null quarter inside an otherwise-complete four-quarter window must
  // withhold the sum rather than silently treating the gap as zero profit -
  // the same "absent beats wrong" rule computeRatios already enforces one
  // layer down.
  it("withholds the TTM sum when one of the four quarters has a null profit figure", () => {
    const income = [
      inc("2024-03-31", 100, 130),
      { period_end: "2024-06-30", profit_after_tax: null, profit_before_tax: 140 },
      inc("2024-09-30", 120, 150),
      inc("2024-12-31", 130, 160),
    ];
    const out = alignPeriods(income, [bal("2024-12-31")], [cf("2024-12-31")]);
    expect(out[0].input.profitAfterTax).toBeNull();
    // profitBeforeTax's own four quarters are all present and usable, and
    // must not be dragged down by profitAfterTax's gap - they are summed
    // independently.
    expect(out[0].input.profitBeforeTax).toBe(130 + 140 + 150 + 160);
  });

  // THE TRAP. NSE's filing toDate and Yahoo's quarter endDate can differ by a
  // few days. Pairing a Q2 profit with a Q3 equity yields a plausible, wrong
  // ROE - the same class of defect as mixing consolidated with standalone.
  it("never pairs periods that differ, even by one day", () => {
    const out = alignPeriods([inc("2024-12-31")], [bal("2024-12-30")], [cf("2024-12-31")]);
    expect(out).toHaveLength(0);
  });

  it("emits nothing when the balance sheet is missing for a period", () => {
    expect(alignPeriods([inc("2024-12-31")], [], [cf("2024-12-31")])).toHaveLength(0);
  });

  it("emits nothing when cash flow is missing for a period", () => {
    expect(alignPeriods([inc("2024-12-31")], [bal("2024-12-31")], [])).toHaveLength(0);
  });

  it("aligns only the periods present in all three, ignoring the rest", () => {
    const out = alignPeriods(
      [inc("2024-12-31"), inc("2024-09-30"), inc("2024-06-30")],
      [bal("2024-12-31"), bal("2024-09-30")],
      [cf("2024-12-31")],
    );
    expect(out.map((x) => x.periodEnd)).toEqual(["2024-12-31"]);
  });

  it("passes nulls through rather than substituting zero", () => {
    const out = alignPeriods(
      [{ period_end: "2024-12-31", profit_after_tax: null, profit_before_tax: null }],
      [{ period_end: "2024-12-31", total_equity: null, total_debt: null, current_assets: null, current_liabilities: null }],
      [{ period_end: "2024-12-31", operating_cf: null, capex: null }],
    );
    expect(out[0].input.profitAfterTax).toBeNull();
    expect(out[0].input.profitBeforeTax).toBeNull();
    expect(out[0].input.totalEquity).toBeNull();
    expect(out[0].input.totalDebt).toBeNull();
    expect(out[0].input.currentAssets).toBeNull();
    expect(out[0].input.currentLiabilities).toBeNull();
    expect(out[0].input.operatingCf).toBeNull();
    expect(out[0].input.capex).toBeNull();
  });
});
