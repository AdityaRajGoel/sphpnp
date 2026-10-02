/**
 * Tax estimates for FY 2026-27, computed only from the figures in tax-rules.ts.
 * Estimates, not a return: the pages that use these say what is left out.
 */
import { TAX_RULES, type Slab, type SurchargeBand } from "./tax-rules";

const R = TAX_RULES;
const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

/** `iso` plus `months`, clamped to the month's last day (31 Jan + 1 month = 28/29 Feb). */
function addMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return target.toISOString().slice(0, 10);
}

export type CgInput = {
  buyDate: string;
  sellDate: string;
  /** What was paid for the shares or units. */
  cost: number;
  /** What the sale brought in. */
  sale: number;
  /** Value on 31 Jan 2018, used only when bought before 1 Feb 2018. */
  fmv2018?: number;
  /** Long-term equity gains already made this tax year, which use up the exemption first. */
  otherLtcg?: number;
};

export type CgResult =
  | {
      ok: true;
      term: "short" | "long";
      heldDays: number;
      grandfathered: boolean;
      costUsed: number;
      gain: number;
      /** How much of the annual long-term exemption this sale uses. */
      exemption: number;
      taxable: number;
      rate: number;
      tax: number;
      cess: number;
      total: number;
    }
  | { ok: false; error: string };

/**
 * Tax on one sale of listed equity shares or equity-fund units (STT paid), at
 * the flat capital-gains rates plus cess. No surcharge, and no use of any unused
 * basic exemption limit: both depend on the rest of a person's income.
 */
export function capitalGainsTax({ buyDate, sellDate, cost, sale, fmv2018, otherLtcg = 0 }: CgInput): CgResult {
  if (!isoDate.test(buyDate) || !isoDate.test(sellDate)) return { ok: false, error: "Enter both dates" };
  if (sellDate < buyDate) return { ok: false, error: "The sale date is before the purchase date" };
  if (!(Number.isFinite(cost) && cost > 0)) return { ok: false, error: "Enter a purchase cost above 0" };
  if (!(Number.isFinite(sale) && sale >= 0)) return { ok: false, error: "Enter a sale value of 0 or more" };

  const term = sellDate > addMonths(buyDate, R.equity.longTermAfterMonths.value) ? "long" : "short";
  const grandfathered = term === "long" && buyDate < R.equity.grandfatherBefore.value && pos(fmv2018 ?? 0) > 0;
  const costUsed = grandfathered ? Math.max(cost, Math.min(fmv2018!, sale)) : cost;
  const gain = sale - costUsed;
  const exemption = term === "long" ? Math.min(pos(gain), pos(R.equity.ltcgExemption.value - pos(otherLtcg))) : 0;
  const taxable = pos(gain) - exemption;
  const rate = term === "long" ? R.equity.ltcgRate.value : R.equity.stcgRate.value;
  const tax = taxable * rate;
  const cess = tax * R.cess.value;
  const heldDays = Math.round((Date.parse(sellDate) - Date.parse(buyDate)) / 86_400_000);
  return { ok: true, term, heldDays, grandfathered, costUsed, gain, exemption, taxable, rate, tax, cess, total: tax + cess };
}

/** Tax on `income` across ascending slabs. */
export function slabTax(income: number, slabs: readonly Slab[]): number {
  let tax = 0;
  let floor = 0;
  for (const { upTo, rate } of slabs) {
    const top = upTo ?? Infinity;
    if (income > floor) tax += (Math.min(income, top) - floor) * rate;
    floor = top;
  }
  return tax;
}

/**
 * Surcharge on `tax` for `income`, limited by marginal relief: tax plus
 * surcharge may exceed the figure at the band's threshold only by the income
 * above that threshold.
 */
function surcharge(income: number, tax: number, bands: readonly SurchargeBand[], taxAt: (income: number) => number): number {
  const i = bands.filter((b) => income > b.above).length - 1;
  if (i < 0) return 0;
  const { above, rate } = bands[i];
  const atThreshold = taxAt(above) * (1 + (i > 0 ? bands[i - 1].rate : 0));
  return Math.max(0, Math.min(tax * rate, atThreshold + (income - above) - tax));
}

export type AgeBand = "below60" | "60to79" | "80plus";

export type IncomeInput = {
  age: AgeBand;
  /** Gross salary for the year. */
  salary: number;
  /** Interest, rent received and other income taxed at slab rates. */
  otherIncome: number;
  /** Old regime only, each capped as the Act caps it. */
  investments: number;
  healthSelf: number;
  healthParents: number;
  parentsSenior: boolean;
  homeLoanInterest: number;
  /** The HRA exemption already worked out, as an amount. */
  hraExempt: number;
  /** Own NPS contribution claimed under section 124(3), old regime only. */
  npsSelf?: number;
};

export type RegimeResult = {
  grossIncome: number;
  deductions: number;
  taxableIncome: number;
  slabTax: number;
  rebate: number;
  surcharge: number;
  cess: number;
  total: number;
};

function finish(grossIncome: number, deductions: number, slabs: readonly Slab[], bands: readonly SurchargeBand[], rebateFor: (income: number, tax: number) => number): RegimeResult {
  const taxableIncome = Math.round(pos(grossIncome - deductions));
  const tax = slabTax(taxableIncome, slabs);
  const rebate = Math.min(tax, rebateFor(taxableIncome, tax));
  const sur = surcharge(taxableIncome, tax - rebate, bands, (x) => slabTax(x, slabs));
  const cess = (tax - rebate + sur) * R.cess.value;
  return { grossIncome, deductions, taxableIncome, slabTax: tax, rebate, surcharge: sur, cess, total: tax - rebate + sur + cess };
}

/** Tax under both regimes for a resident individual with salary and other slab-rate income. */
export function incomeTax(input: IncomeInput): { old: RegimeResult; new: RegimeResult } {
  const salary = pos(input.salary);
  const gross = salary + pos(input.otherIncome);
  const { caps } = R.oldRegime;
  const selfSenior = input.age !== "below60";

  const nr = R.newRegime;
  const newResult = finish(gross, Math.min(salary, nr.standardDeduction.value), nr.slabs.value, nr.surcharge.value, (income, tax) => {
    if (income <= nr.rebateIncomeLimit.value) return nr.rebateMax.value;
    // Marginal relief: the tax may not exceed the income above the limit.
    return pos(tax - (income - nr.rebateIncomeLimit.value));
  });

  const or = R.oldRegime;
  const oldDeductions =
    Math.min(salary, or.standardDeduction.value) +
    Math.min(pos(input.hraExempt), salary) +
    Math.min(pos(input.homeLoanInterest), caps.homeLoanInterest.value) +
    Math.min(pos(input.investments), caps.investments.value) +
    Math.min(pos(input.npsSelf ?? 0), caps.npsSelf.value) +
    Math.min(pos(input.healthSelf), selfSenior ? caps.healthSenior.value : caps.healthSelf.value) +
    Math.min(pos(input.healthParents), input.parentsSenior ? caps.healthSenior.value : caps.healthParents.value);
  const oldResult = finish(gross, oldDeductions, or.slabs[input.age].value, or.surcharge.value, (income) =>
    income <= or.rebateIncomeLimit.value ? or.rebateMax.value : 0,
  );

  return { old: oldResult, new: newResult };
}
