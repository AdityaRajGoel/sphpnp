/**
 * Derived ratios, computed fail-closed.
 *
 * The rule this file exists to enforce: a ratio is produced only when every
 * input it needs is present and usable. ROE depends on Yahoo-sourced equity,
 * and Yahoo thins out on smallcaps, so the common case is genuinely missing
 * data. Returning 0, Infinity, or a value computed against a stale denominator
 * would put a wrong number on a stock page that a retail investor may act on.
 * Absent is the correct answer.
 *
 * "Usable" is not just "present, finite, and non-zero" for denominators that
 * represent a capital base (equity, or equity + debt as capital employed).
 * A negative capital base is a real state a company can be in — liabilities
 * exceed assets — but dividing into it does not produce a meaningful return
 * ratio: a loss over negative equity divides out to a positive number that
 * reads as a healthy return, when the truth is the opposite. Two sign errors
 * cancelling is not a ratio, it is the module actively lying, and it would do
 * so while flagging the row as fully trustworthy. So a negative equity (or
 * equity + debt) denominator is treated the same way a zero denominator
 * already is: present but unusable, ratio withheld, `inputsComplete: false`.
 * This is strictly about the sign of the DENOMINATOR. A negative numerator
 * over a genuinely positive capital base is a real, meaningful negative
 * return — a company that lost money on a healthy equity base — and must
 * keep computing normally.
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
   * Denominators that were present and finite but not usable — zero (or
   * summed to zero), or negative where the denominator represents a capital
   * base (equity, or equity + debt as capital employed) — so the ratio came
   * back null even though nothing was absent.
   *
   * `missingInputs` and `unusableInputs` are deliberately kept separate
   * rather than merged into one list: "we have no equity figure" and "we
   * have an equity figure and it is zero (or negative)" are different facts
   * about the data, and a UI needs to say different things for each ("data
   * not available" vs. "not meaningful for this company"). Merging them
   * would repeat the same silent-wrong-number failure this module exists to
   * prevent, just one level up the stack. Entries name the input field(s)
   * that combined to produce the unusable denominator (e.g.
   * "totalEquity+totalDebt" for ROCE's capital-employed denominator), not a
   * synthetic field name, so they stay traceable back to RatioInput.
   */
  unusableInputs: string[];
};

const usable = (n: number | null): n is number => n !== null && Number.isFinite(n);
/** Denominators additionally must not be zero. */
const divisor = (n: number | null): n is number => usable(n) && n !== 0;
/**
 * Capital-base denominators (equity, capital employed) additionally must not
 * be negative. A negative capital base is a real state — liabilities exceed
 * assets — but dividing into it does not produce a meaningful ratio: it
 * silently flips the sign of whatever result comes out, which is worse than
 * merely being wrong, because it looks plausible. Kept as a separate helper
 * from `divisor` (rather than an inline sign check at each call site)
 * because it is a distinct usability rule that only applies where the
 * denominator is a capital base, not a general "can we divide by this"
 * check — currentRatio's denominator uses `divisor`, not this.
 */
const positiveDivisor = (n: number | null): n is number => divisor(n) && n > 0;

export function computeRatios(input: RatioInput): RatioResult {
  const missingInputs = (Object.keys(input) as Array<keyof RatioInput>)
    .filter((k) => !usable(input[k]))
    .map(String);

  const unusableInputs: string[] = [];

  const roe = usable(input.profitAfterTax) && positiveDivisor(input.totalEquity)
    ? (input.profitAfterTax / input.totalEquity) * 100
    : null;
  // totalEquity is present and finite but zero or negative: not missing,
  // just unusable. The sign of profitAfterTax is irrelevant here — this is
  // strictly about whether the denominator is a usable capital base.
  if (usable(input.totalEquity) && !positiveDivisor(input.totalEquity)) {
    unusableInputs.push("totalEquity");
  }

  const capitalEmployed =
    usable(input.totalEquity) && usable(input.totalDebt)
      ? input.totalEquity + input.totalDebt
      : null;
  const roce = usable(input.profitBeforeTax) && positiveDivisor(capitalEmployed)
    ? (input.profitBeforeTax / capitalEmployed) * 100
    : null;
  // Both equity and debt were present (capitalEmployed !== null), but they
  // summed to a zero or negative capital-employed denominator — a fact
  // about the ROCE denominator, not either input alone.
  if (capitalEmployed !== null && !positiveDivisor(capitalEmployed)) {
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
