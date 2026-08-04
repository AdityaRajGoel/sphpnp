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
};

const usable = (n: number | null): n is number => n !== null && Number.isFinite(n);
/** Denominators additionally must not be zero. */
const divisor = (n: number | null): n is number => usable(n) && n !== 0;

export function computeRatios(input: RatioInput): RatioResult {
  const missingInputs = (Object.keys(input) as Array<keyof RatioInput>)
    .filter((k) => !usable(input[k]))
    .map(String);

  const roe = usable(input.profitAfterTax) && divisor(input.totalEquity)
    ? (input.profitAfterTax / input.totalEquity) * 100
    : null;

  const capitalEmployed =
    usable(input.totalEquity) && usable(input.totalDebt)
      ? input.totalEquity + input.totalDebt
      : null;
  const roce = usable(input.profitBeforeTax) && divisor(capitalEmployed)
    ? (input.profitBeforeTax / capitalEmployed) * 100
    : null;

  const currentRatio = usable(input.currentAssets) && divisor(input.currentLiabilities)
    ? input.currentAssets / input.currentLiabilities
    : null;

  const freeCashFlow = usable(input.operatingCf) && usable(input.capex)
    ? input.operatingCf - input.capex
    : null;

  return {
    roe,
    roce,
    currentRatio,
    freeCashFlow,
    inputsComplete: missingInputs.length === 0,
    missingInputs,
  };
}
