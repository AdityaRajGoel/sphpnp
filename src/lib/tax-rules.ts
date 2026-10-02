/**
 * Every tax figure the site quotes, for FY 2026-27 - the first tax year under
 * the Income-tax Act, 2025, which replaced the 1961 Act (and renumbered its
 * sections) from 1 April 2026. Calculators and articles read from here and
 * nowhere else, so a rate changes in one place.
 *
 * Each figure carries the provision it comes from, the official text it was
 * checked against, the date it was checked, and `verified`. Verified means read
 * in the gazetted Act, not a summary of it. A figure that could not be checked
 * is kept with `verified: false`, and the pages that show it must say so.
 *
 * Sources: the Income-tax Act, 2025 (No. 30 of 2025, Gazette of 21 August 2025)
 * and the Finance Act, 2026 (No. 4 of 2026, assent 30 March 2026), which sets
 * the rates for tax year 2026-27 and amends the 2025 Act. Its amendments were
 * checked against every provision below; none changes these figures.
 */

export type Rule<T> = {
  value: T;
  /** The provision, e.g. "Income-tax Act, 2025, section 196". */
  ref: string;
  source: string;
  /** When the figure was checked against `source`. */
  asOf: string;
  verified: boolean;
};

/** A slab: income up to `upTo` (inclusive; null = no ceiling) is taxed at `rate`. */
export type Slab = { upTo: number | null; rate: number };

/** Surcharge on income-tax once total income exceeds `above`. */
export type SurchargeBand = { above: number; rate: number };

export const ACT_2025_URL = "https://egazette.gov.in/WriteReadData/2025/265620.pdf";
export const FINANCE_ACT_2026_URL = "https://egazette.gov.in/WriteReadData/2026/271439.pdf";
/** The Income Tax Department's own page for the 2025 Act, for readers. */
export const ACT_2025_PAGE = "https://www.incometax.gov.in/iec/foportal/newdownloads/income-tax-act-2025";

export const TAX_YEAR_LABEL = "FY 2026-27 (AY 2027-28)";
export const RULES_CHECKED_ON = "2026-09-29";

const act = <T>(value: T, ref: string): Rule<T> => ({
  value, ref: `Income-tax Act, 2025, ${ref}`, source: ACT_2025_URL, asOf: RULES_CHECKED_ON, verified: true,
});
const financeAct = <T>(value: T, ref: string): Rule<T> => ({
  value, ref: `Finance Act, 2026, ${ref}`, source: FINANCE_ACT_2026_URL, asOf: RULES_CHECKED_ON, verified: true,
});

const LAKH = 100_000;
const CRORE = 10_000_000;

export const TAX_RULES = {
  /** Listed equity shares and units of equity-oriented funds, STT paid. */
  equity: {
    stcgRate: act(0.2, "section 196(1)"),
    ltcgRate: act(0.125, "section 198(2)"),
    /** Long-term gains up to this much in a tax year are not taxed. */
    ltcgExemption: act(1.25 * LAKH, "section 198(2)"),
    /** Held for more than this many months = long-term. */
    longTermAfterMonths: act(12, "section 2(101)(b)"),
    /**
     * Bought before this date: cost is the higher of actual cost and the lower
     * of the 31 January 2018 value and the sale value.
     */
    grandfatherBefore: act("2018-02-01", "section 90(7)"),
    grandfatherFmvDate: act("2018-01-31", "section 90(8)(b)"),
    /** A short-term loss can be set off against any capital gain; a long-term loss only against long-term gains. */
    lossSetOff: act("Short-term losses against any capital gains; long-term losses against long-term gains only", "section 108(2)"),
    lossCarryForwardYears: act(8, "section 111(2)"),
  },

  /** Default regime for individuals. */
  newRegime: {
    slabs: act<Slab[]>([
      { upTo: 4 * LAKH, rate: 0 },
      { upTo: 8 * LAKH, rate: 0.05 },
      { upTo: 12 * LAKH, rate: 0.1 },
      { upTo: 16 * LAKH, rate: 0.15 },
      { upTo: 20 * LAKH, rate: 0.2 },
      { upTo: 24 * LAKH, rate: 0.25 },
      { upTo: null, rate: 0.3 },
    ], "section 202(1)"),
    standardDeduction: act(75_000, "section 19(1), Table Sl. No. 2(a)"),
    /** Full rebate up to this total income, with marginal relief just above it. */
    rebateIncomeLimit: act(12 * LAKH, "section 156(2)"),
    rebateMax: act(60_000, "section 156(2)(a)"),
    surcharge: financeAct<SurchargeBand[]>([
      { above: 50 * LAKH, rate: 0.1 },
      { above: 1 * CRORE, rate: 0.15 },
      { above: 2 * CRORE, rate: 0.25 },
    ], "section 3(4)(b), Table Sl. No. 10"),
  },

  /** The regime a person opts into under section 202(4), keeping the old deductions. */
  oldRegime: {
    slabs: {
      below60: financeAct<Slab[]>([
        { upTo: 2.5 * LAKH, rate: 0 },
        { upTo: 5 * LAKH, rate: 0.05 },
        { upTo: 10 * LAKH, rate: 0.2 },
        { upTo: null, rate: 0.3 },
      ], "First Schedule, Part I-B, Paragraph A(I)"),
      "60to79": financeAct<Slab[]>([
        { upTo: 3 * LAKH, rate: 0 },
        { upTo: 5 * LAKH, rate: 0.05 },
        { upTo: 10 * LAKH, rate: 0.2 },
        { upTo: null, rate: 0.3 },
      ], "First Schedule, Part I-B, Paragraph A(II)"),
      "80plus": financeAct<Slab[]>([
        { upTo: 5 * LAKH, rate: 0 },
        { upTo: 10 * LAKH, rate: 0.2 },
        { upTo: null, rate: 0.3 },
      ], "First Schedule, Part I-B, Paragraph A(III)"),
    },
    standardDeduction: act(50_000, "section 19(1), Table Sl. No. 2(b)"),
    rebateIncomeLimit: act(5 * LAKH, "section 156(1)"),
    rebateMax: act(12_500, "section 156(1)"),
    surcharge: financeAct<SurchargeBand[]>([
      { above: 50 * LAKH, rate: 0.1 },
      { above: 1 * CRORE, rate: 0.15 },
      { above: 2 * CRORE, rate: 0.25 },
      { above: 5 * CRORE, rate: 0.37 },
    ], "First Schedule, Part I-B, Paragraph F, Table 1"),
    /** Deductions the new regime does not allow (section 202(2)). */
    caps: {
      /** PPF, EPF, ELSS, life cover and the rest of Schedule XV (80C in the 1961 Act). */
      investments: act(1.5 * LAKH, "section 123"),
      /** Own contribution to NPS, over and above section 123 (80CCD(1B) in the 1961 Act). */
      npsSelf: { ...act(50_000, "section 124(3)"), asOf: "2026-10-02" },
      /** Health cover for self, spouse and children (80D in the 1961 Act). */
      healthSelf: act(25_000, "section 126(2)(a)"),
      healthParents: act(25_000, "section 126(2)(b)"),
      /** Either cap when the insured person is a senior citizen. */
      healthSenior: act(50_000, "section 126(8)(a)"),
      /** Interest on a loan for a self-occupied home. */
      homeLoanInterest: act(2 * LAKH, "section 22(2)"),
    },
  },

  /** Health and Education Cess, on income-tax plus surcharge, both regimes. */
  cess: financeAct(0.04, "section 3(15)"),
  /** Surcharge on tax on dividends and section 196-198 capital gains never exceeds this. */
  surchargeCapOnGains: financeAct(0.15, "section 3(4)(b), Table Sl. No. 10(v)"),
  /** Marginal relief: tax + surcharge above a threshold may not exceed that at the threshold plus the income over it. */
  surchargeMarginalRelief: financeAct(true, "section 3(5)"),
} as const;

/** "20%", "12.5%" - how a rate is printed. */
export const pctLabel = (rate: number) => `${+(rate * 100).toFixed(2)}%`;
