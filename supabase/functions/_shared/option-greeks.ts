/**
 * Black-Scholes greeks, implied volatility, and the chain-level measures that
 * need them - for the option_chain_eod snapshots this repo already stores.
 *
 * WHAT WAS ACTUALLY MISSING. NSE publishes an implied volatility per strike, so
 * IV itself is not the gap; _shared/option-chain.ts already carries it through
 * as callIV/putIV. What nothing here could do is put that number in context:
 * no greeks (NSE publishes none), no sense of whether today's IV is high or low
 * for this underlying, and no translation from IV into the thing a reader
 * actually wants - how far the option market thinks this could move by expiry.
 * That is what this module adds.
 *
 * European exercise throughout. NSE index options are European, so for NIFTY,
 * BANKNIFTY, FINNIFTY and MIDCPNIFTY this is exact. NSE STOCK options are
 * American, where Black-Scholes understates the value of early exercise - the
 * error is small for non-dividend-paying names and largest for deep in-the-money
 * puts. Stated here rather than discovered later; the figures are labelled as
 * model values on the surfaces that show them.
 */

/**
 * India's short-dated risk-free rate, roughly the 91-day T-bill. The greeks are
 * far more sensitive to volatility than to this, so a small drift costs little -
 * but it is a named constant rather than a literal so the assumption is visible.
 */
export const RISK_FREE_RATE = 0.065;

/** Calendar days, not trading days: option time value decays over weekends too. */
export const DAYS_PER_YEAR = 365;

export type OptionType = "call" | "put";

/**
 * Standard normal CDF via Abramowitz & Stegun 7.1.26 on erf. Accurate to about
 * 1.5e-7, which is several orders finer than the inputs here deserve - a chain
 * quoted in paise does not support more precision than that.
 */
export function normalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-z * z);
  return 0.5 * (1 + sign * y);
}

const normalPdf = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);

type Inputs = { spot: number; strike: number; years: number; vol: number; rate?: number };

const usable = ({ spot, strike, years, vol }: Inputs) =>
  Number.isFinite(spot) && spot > 0 &&
  Number.isFinite(strike) && strike > 0 &&
  Number.isFinite(years) && years > 0 &&
  Number.isFinite(vol) && vol > 0;

function d1d2(input: Inputs): { d1: number; d2: number } {
  const rate = input.rate ?? RISK_FREE_RATE;
  const { spot, strike, years, vol } = input;
  const d1 = (Math.log(spot / strike) + (rate + (vol * vol) / 2) * years) / (vol * Math.sqrt(years));
  return { d1, d2: d1 - vol * Math.sqrt(years) };
}

/** Black-Scholes price, or null when an input cannot support one. */
export function blackScholes(input: Inputs, type: OptionType): number | null {
  if (!usable(input)) return null;
  const rate = input.rate ?? RISK_FREE_RATE;
  const { spot, strike, years } = input;
  const { d1, d2 } = d1d2(input);
  const discounted = strike * Math.exp(-rate * years);
  return type === "call"
    ? spot * normalCdf(d1) - discounted * normalCdf(d2)
    : discounted * normalCdf(-d2) - spot * normalCdf(-d1);
}

export type Greeks = {
  /** Change in option value per 1 unit move in the underlying. */
  delta: number;
  /** Change in delta per 1 unit move in the underlying. */
  gamma: number;
  /** Change in option value per 1 PERCENTAGE POINT of implied volatility. */
  vega: number;
  /** Change in option value per calendar DAY, normally negative. */
  theta: number;
};

/**
 * Vega and theta are scaled to the units a reader thinks in - a point of IV and
 * a day of decay - rather than the raw per-unit-vol and per-year forms. The
 * raw forms are what every textbook prints and what nobody wants on a page.
 */
export function greeks(input: Inputs, type: OptionType): Greeks | null {
  if (!usable(input)) return null;
  const rate = input.rate ?? RISK_FREE_RATE;
  const { spot, strike, years, vol } = input;
  const { d1, d2 } = d1d2(input);
  const sqrtYears = Math.sqrt(years);
  const discounted = strike * Math.exp(-rate * years);

  const delta = type === "call" ? normalCdf(d1) : normalCdf(d1) - 1;
  const gamma = normalPdf(d1) / (spot * vol * sqrtYears);
  const vegaPerUnitVol = spot * normalPdf(d1) * sqrtYears;
  const thetaPerYear =
    type === "call"
      ? -(spot * normalPdf(d1) * vol) / (2 * sqrtYears) - rate * discounted * normalCdf(d2)
      : -(spot * normalPdf(d1) * vol) / (2 * sqrtYears) + rate * discounted * normalCdf(-d2);

  return {
    delta,
    gamma,
    vega: vegaPerUnitVol / 100,
    theta: thetaPerYear / DAYS_PER_YEAR,
  };
}

/**
 * NSE's tick size. A premium cannot be quoted below this, so an option whose
 * time value is thinner than one tick has no recoverable volatility in it -
 * the price is a rounding, and any IV inverted from it is a property of the
 * rounding rather than of the market.
 */
const MIN_TIME_VALUE = 0.05;

/**
 * Implied volatility from a traded price, as a percentage.
 *
 * Newton-Raphson, falling back to bisection. The fallback is not belt-and-
 * braces: Newton divides by vega, and vega collapses toward zero for deep
 * in- and out-of-the-money strikes, which is exactly where a real chain has its
 * least reliable prices. Left to itself Newton walks off to a negative or
 * absurd volatility there and returns it with total confidence.
 */
export function impliedVolatility(
  price: number,
  input: Omit<Inputs, "vol">,
  type: OptionType,
  { maxIterations = 60, tolerance = 1e-5 } = {},
): number | null {
  const { spot, strike, years } = input;
  if (!Number.isFinite(price) || price <= 0) return null;
  if (!(spot > 0 && strike > 0 && years > 0)) return null;

  const rate = input.rate ?? RISK_FREE_RATE;
  // A price below intrinsic value is an arbitrage, not a volatility; a price at
  // intrinsic value has no time value to invert.
  const intrinsic = type === "call"
    ? Math.max(0, spot - strike * Math.exp(-rate * years))
    : Math.max(0, strike * Math.exp(-rate * years) - spot);
  if (price <= intrinsic + MIN_TIME_VALUE) return null;

  let vol = 0.3;
  for (let i = 0; i < maxIterations; i++) {
    const modelled = blackScholes({ ...input, vol }, type);
    if (modelled === null) break;
    const diff = modelled - price;
    if (Math.abs(diff) < tolerance) return vol * 100;
    const vegaPerUnitVol = spot * normalPdf(d1d2({ ...input, vol }).d1) * Math.sqrt(years);
    if (!Number.isFinite(vegaPerUnitVol) || vegaPerUnitVol < 1e-8) break;
    const step = diff / vegaPerUnitVol;
    const next = vol - step;
    if (!Number.isFinite(next) || next <= 0 || next > 5) break;
    vol = next;
  }

  // Bisection over a 1%-500% band. Wide on purpose: a weekly far out-of-the-
  // money strike on an Indian smallcap genuinely prints three-digit IV.
  let low = 0.01;
  let high = 5;
  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    const modelled = blackScholes({ ...input, vol: mid }, type);
    if (modelled === null) return null;
    if (Math.abs(modelled - price) < tolerance) return mid * 100;
    if (modelled > price) high = mid;
    else low = mid;
  }
  const settled = (low + high) / 2;
  // Landing on a bound means the price was outside what any volatility in the
  // band explains - report nothing rather than the bound itself.
  return settled <= 0.0101 || settled >= 4.99 ? null : settled * 100;
}

/** Calendar years between two ISO dates, floored at zero. */
export function yearsToExpiry(tradeDate: string, expiry: string): number {
  const days = (Date.parse(`${expiry}T00:00:00Z`) - Date.parse(`${tradeDate}T00:00:00Z`)) / 86_400_000;
  return days <= 0 ? 0 : days / DAYS_PER_YEAR;
}

export type ChainRow = { strike: number; callLTP: number; callIV: number; putLTP: number; putIV: number };

export type AtmMetrics = {
  strike: number;
  callIV: number | null;
  putIV: number | null;
  /**
   * Put IV minus call IV at the money. Positive is the normal state for equity
   * options - downside protection costs more than upside - so the number is
   * read by how far it sits from its own usual level, not by its sign.
   */
  skew: number | null;
  /** The at-the-money straddle: what the market charges for the move either way. */
  straddle: number | null;
  /**
   * The move to expiry the straddle implies, as a percentage of spot. This is
   * the one figure on this page a non-specialist can use: "the option market is
   * pricing a ±4.2% move by the 25th".
   */
  expectedMovePct: number | null;
};

/**
 * NSE publishes 0 where it has no IV for a strike. Zero is not a volatility,
 * and carrying it through would drag every average toward nothing.
 */
const iv = (value: number) => (Number.isFinite(value) && value > 0 ? value : null);

/** The chain's at-the-money measures, or null when the chain cannot support them. */
export function atmMetrics(rows: ChainRow[], spot: number): AtmMetrics | null {
  if (rows.length === 0 || !Number.isFinite(spot) || spot <= 0) return null;
  const atm = rows.reduce((closest, row) =>
    Math.abs(row.strike - spot) < Math.abs(closest.strike - spot) ? row : closest,
  );

  const callIV = iv(atm.callIV);
  const putIV = iv(atm.putIV);
  const straddle =
    Number.isFinite(atm.callLTP) && atm.callLTP > 0 && Number.isFinite(atm.putLTP) && atm.putLTP > 0
      ? atm.callLTP + atm.putLTP
      : null;

  return {
    strike: atm.strike,
    callIV,
    putIV,
    skew: callIV !== null && putIV !== null ? putIV - callIV : null,
    straddle,
    expectedMovePct: straddle === null ? null : (straddle / spot) * 100,
  };
}

/**
 * Where today's IV sits in its own stored history, 0 (the lowest seen) to 100
 * (the highest).
 *
 * Rank against the observed range rather than a percentile of observations: it
 * is the form traders quote, and it answers "is this expensive for THIS
 * underlying" without pretending the stored history is a full sample.
 */
export function ivRank(current: number, history: number[], minObservations = 30): number | null {
  const values = history.filter((value) => Number.isFinite(value) && value > 0);
  if (!Number.isFinite(current) || current <= 0 || values.length < minObservations) return null;
  const low = Math.min(...values);
  const high = Math.max(...values);
  // A flat history has no range to place anything in.
  if (high <= low) return null;
  const clamped = Math.min(Math.max(current, low), high);
  return ((clamped - low) / (high - low)) * 100;
}
