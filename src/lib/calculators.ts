/**
 * The maths behind the calculator pack (/calculators). Pure functions, no
 * React: each returns null (or an error) for inputs it cannot honestly price,
 * so a page never prints NaN or Infinity. Tax maths lives in tax-calculators.ts.
 *
 * Conventions, matched to the /sip-calculator that was here first: an annual
 * rate is compounded monthly as rate/12 for monthly schemes, SIP instalments
 * are paid at the start of each month, and a lumpsum compounds once a year.
 */
import { normalCdf, blackScholes, greeks } from "../../supabase/functions/_shared/option-greeks";
import { xirr } from "./sip-backtest";

const isPos = (n: number) => Number.isFinite(n) && n > 0;
/** A usable annual rate in percent: finite, and not a loss of 100% or more. */
const isRate = (pct: number) => Number.isFinite(pct) && pct > -100;

export type GrowthRow = { year: number; invested: number; value: number };
export type GrowthResult = { invested: number; value: number; gain: number; rows: GrowthRow[] };

/** One amount invested today, compounded yearly. */
export function lumpsum(amount: number, ratePct: number, years: number): GrowthResult | null {
  if (!isPos(amount) || !isPos(years) || !isRate(ratePct)) return null;
  const rows: GrowthRow[] = [];
  for (let y = 1; y <= Math.ceil(years); y++) {
    rows.push({ year: y, invested: amount, value: amount * Math.pow(1 + ratePct / 100, Math.min(y, years)) });
  }
  const value = amount * Math.pow(1 + ratePct / 100, years);
  return { invested: amount, value, gain: value - amount, rows };
}

/**
 * A monthly SIP whose instalment rises by `stepUpPct` every 12 months. Simulated
 * month by month; with no step-up it equals the plain SIP formula.
 */
export function stepUpSip(monthly: number, stepUpPct: number, ratePct: number, years: number): GrowthResult | null {
  if (!isPos(monthly) || !isPos(years) || !isRate(ratePct) || !Number.isFinite(stepUpPct) || stepUpPct < 0) return null;
  const i = ratePct / 100 / 12;
  const months = Math.round(years * 12);
  const rows: GrowthRow[] = [];
  let value = 0;
  let invested = 0;
  for (let m = 0; m < months; m++) {
    const instalment = monthly * Math.pow(1 + stepUpPct / 100, Math.floor(m / 12));
    invested += instalment;
    value = (value + instalment) * (1 + i);
    if ((m + 1) % 12 === 0 || m === months - 1) rows.push({ year: Math.ceil((m + 1) / 12), invested, value });
  }
  return { invested, value, gain: value - invested, rows };
}

export type SwpRow = { year: number; withdrawn: number; balance: number };
export type SwpResult = { withdrawn: number; balance: number; monthsPaid: number; depleted: boolean; rows: SwpRow[] };

/**
 * A fixed monthly withdrawal from a corpus. Each month the corpus earns a
 * month's return, then the withdrawal is paid; the month it runs short, what is
 * left is paid and the plan stops.
 */
export function swp(corpus: number, withdrawal: number, ratePct: number, years: number): SwpResult | null {
  if (!isPos(corpus) || !isPos(withdrawal) || !isPos(years) || !isRate(ratePct)) return null;
  const i = ratePct / 100 / 12;
  const months = Math.round(years * 12);
  const rows: SwpRow[] = [];
  let balance = corpus;
  let withdrawn = 0;
  let monthsPaid = 0;
  for (let m = 0; m < months && balance > 0; m++) {
    balance *= 1 + i;
    const paid = Math.min(withdrawal, balance);
    balance -= paid;
    withdrawn += paid;
    monthsPaid++;
    if ((m + 1) % 12 === 0 || m === months - 1 || balance === 0) rows.push({ year: Math.ceil((m + 1) / 12), withdrawn, balance });
  }
  return { withdrawn, balance, monthsPaid, depleted: balance === 0, rows };
}

/** Compound annual growth rate in percent. An end value of 0 is a -100% CAGR. */
export function cagr(start: number, end: number, years: number): number | null {
  if (!isPos(start) || !isPos(years) || !Number.isFinite(end) || end < 0) return null;
  return (Math.pow(end / start, 1 / years) - 1) * 100;
}

export type CashFlow = { date: string; amount: number };

/**
 * XIRR in percent for dated flows (negative = paid in, positive = received).
 * Null - never NaN - when the flows cannot be solved: fewer than two usable
 * rows, no money going both ways, every flow on one day, or no rate between
 * -99% and +1,000% a year that nets them to zero.
 */
export function cashFlowXirr(flows: readonly CashFlow[]): number | null {
  const clean = flows
    .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f.date) && !Number.isNaN(Date.parse(f.date)) && Number.isFinite(f.amount) && f.amount !== 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (clean.length !== flows.length || clean.length < 2 || clean[0].date === clean[clean.length - 1].date) return null;
  const r = xirr(clean);
  return r !== null && Number.isFinite(r) ? r : null;
}

export type Trade = { side: "buy" | "sell"; qty: number; price: number };
export type AverageResult =
  | { ok: true; qty: number; average: number; cost: number; realised: number }
  | { ok: false; row: number; field: "qty" | "price"; error: string };

/**
 * Average buy price of what is still held. Sells are matched against the
 * earliest buys first (first in, first out), and the profit or loss on the
 * shares sold is reported as `realised`.
 */
export function averagePrice(trades: readonly Trade[]): AverageResult {
  const lots: { qty: number; price: number }[] = [];
  let realised = 0;
  for (const [row, t] of trades.entries()) {
    if (!isPos(t.qty)) return { ok: false, row, field: "qty", error: "Enter a quantity above 0" };
    if (!isPos(t.price)) return { ok: false, row, field: "price", error: "Enter a price above 0" };
    if (t.side === "buy") {
      lots.push({ qty: t.qty, price: t.price });
      continue;
    }
    const held = lots.reduce((s, l) => s + l.qty, 0);
    if (t.qty > held + 1e-9) return { ok: false, row, field: "qty", error: `Sells more than the ${held.toLocaleString("en-IN")} shares held` };
    let left = t.qty;
    while (left > 1e-9) {
      const lot = lots[0];
      const take = Math.min(left, lot.qty);
      realised += take * (t.price - lot.price);
      left -= take;
      if (take >= lot.qty - 1e-9) lots.shift();
      else lots[0] = { ...lot, qty: lot.qty - take };
    }
  }
  const qty = lots.reduce((s, l) => s + l.qty, 0);
  const cost = lots.reduce((s, l) => s + l.qty * l.price, 0);
  return { ok: true, qty, average: qty > 0 ? cost / qty : 0, cost, realised };
}

/**
 * Whole shares to buy at `price` to move an average of `average` on `qty`
 * shares to `target`. Null unless the target lies strictly between the price
 * and the current average - a buy cannot pull the average past its own price.
 */
export function sharesToReachAverage(qty: number, average: number, price: number, target: number): number | null {
  if (![qty, average, price, target].every(isPos)) return null;
  const between = (target < average && target > price) || (target > average && target < price);
  if (!between) return null;
  return Math.ceil((qty * (average - target)) / (target - price) - 1e-9);
}

export type OptionSide = { price: number; delta: number; gamma: number; vega: number; theta: number; rho: number };
export type OptionInput = { spot: number; strike: number; days: number; volPct: number; ratePct: number };

/**
 * Black-Scholes value of a European call and put, with the Greeks in the units
 * a trader reads: vega and rho per 1 percentage point, theta per calendar day.
 * Reuses the pricing the F&O pages already rely on.
 */
export function optionValue({ spot, strike, days, volPct, ratePct }: OptionInput): { call: OptionSide; put: OptionSide } | null {
  if (![spot, strike, days, volPct].every(isPos) || !Number.isFinite(ratePct)) return null;
  const input = { spot, strike, years: days / 365, vol: volPct / 100, rate: ratePct / 100 };
  const side = (type: "call" | "put"): OptionSide | null => {
    const price = blackScholes(input, type);
    const g = greeks(input, type);
    if (price === null || g === null) return null;
    const d2 = (Math.log(spot / strike) + (input.rate - input.vol ** 2 / 2) * input.years) / (input.vol * Math.sqrt(input.years));
    const discounted = strike * input.years * Math.exp(-input.rate * input.years);
    const rho = (type === "call" ? discounted * normalCdf(d2) : -discounted * normalCdf(-d2)) / 100;
    return { price, ...g, rho };
  };
  const call = side("call");
  const put = side("put");
  return call && put ? { call, put } : null;
}
