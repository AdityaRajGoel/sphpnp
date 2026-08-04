/**
 * Derived ratios, computed fail-closed.
 *
 * The rule this file exists to enforce: a ratio is produced only when every
 * input it needs is present and usable. ROE depends on Yahoo-sourced equity,
 * and Yahoo thins out on smallcaps, so the common case is genuinely missing
 * data. Returning 0, Infinity, or a value computed against a stale denominator
 * would put a wrong number on a stock page that a retail investor may act on.
 * Absent is the correct answer.
 */

export type RatioInput = {
  profitAfterTax: number | null;
  totalEquity: number | null;
  profitBeforeTax: number | null;
  totalDebt: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
  operatingCf: number | null;
  capex: number | null;
};

export type RatioResult = {
  roe: number | null;
  roce: number | null;
  currentRatio: number | null;
  freeCashFlow: number | null;
  inputsComplete: boolean;
  missingInputs: string[];
  /**
   * Denominators that were present and finite but zero (or that summed to
   * zero), so the ratio came back null even though nothing was absent.
   *
   * `missingInputs` and `unusableInputs` are deliberately kept separate
   * rather than merged into one list: "we have no equity figure" and "we
   * have an equity figure and it is zero" are different facts about the
   * data, and a UI needs to say different things for each ("data not
   * available" vs. "not meaningful for this company"). Merging them would
   * repeat the same silent-wrong-number failure this module exists to
   * prevent, just one level up the stack. Entries name the input field(s)
   * that combined to produce the zero (e.g. "totalEquity+totalDebt" for
   * ROCE's capital-employed denominator), not a synthetic field name, so
   * they stay traceable back to RatioInput.
   */
  unusableInputs: string[];
};

const usable = (n: number | null): n is number => n !== null && Number.isFinite(n);
/** Denominators additionally must not be zero. */
const divisor = (n: number | null): n is number => usable(n) && n !== 0;

export function computeRatios(input: RatioInput): RatioResult {
  const missingInputs = (Object.keys(input) as Array<keyof RatioInput>)
    .filter((k) => !usable(input[k]))
    .map(String);

  const unusableInputs: string[] = [];

  const roe = usable(input.profitAfterTax) && divisor(input.totalEquity)
    ? (input.profitAfterTax / input.totalEquity) * 100
    : null;
  // totalEquity is present and finite but zero: not missing, just unusable.
  if (usable(input.totalEquity) && !divisor(input.totalEquity)) {
    unusableInputs.push("totalEquity");
  }

  const capitalEmployed =
    usable(input.totalEquity) && usable(input.totalDebt)
      ? input.totalEquity + input.totalDebt
      : null;
  const roce = usable(input.profitBeforeTax) && divisor(capitalEmployed)
    ? (input.profitBeforeTax / capitalEmployed) * 100
    : null;
  // Both equity and debt were present (capitalEmployed !== null), but they
  // cancelled out to zero — the ROCE denominator, not either input alone.
  if (capitalEmployed !== null && !divisor(capitalEmployed)) {
    unusableInputs.push("totalEquity+totalDebt");
  }

  const currentRatio = usable(input.currentAssets) && divisor(input.currentLiabilities)
    ? input.currentAssets / input.currentLiabilities
    : null;
  if (usable(input.currentLiabilities) && !divisor(input.currentLiabilities)) {
    unusableInputs.push("currentLiabilities");
  }

  const freeCashFlow = usable(input.operatingCf) && usable(input.capex)
    ? input.operatingCf - input.capex
    : null;

  return {
    roe,
    roce,
    currentRatio,
    freeCashFlow,
    inputsComplete: missingInputs.length === 0 && unusableInputs.length === 0,
    missingInputs,
    unusableInputs,
  };
}
