/**
 * The investments that qualify for the old regime's section 123 deduction
 * (Schedule XV of the Income-tax Act, 2025), and NPS under section 124(3), for
 * the /tax-saving-investments comparison.
 *
 * Where each fact comes from:
 * - Which investments qualify, and how their returns are taxed: the gazetted Act
 *   (Schedule XV paragraph 1; Schedule II items 2, 3, 5 and 6), read 2 Oct 2026.
 * - Interest rates: DEA office memorandum of 29 Dec 2023 (from 1 Jan 2024). The
 *   memoranda of 31 Dec 2025, 30 Mar, 30 Jun and 30 Sep 2026 each keep the
 *   previous quarter's rates; those for Apr 2024 to Sep 2025 were not on
 *   dea.gov.in, so RATES_VERIFIED is false and the page says so.
 * - Lock-ins: each scheme's own rules, not the Act.
 */
export const SMALL_SAVINGS_RATES_URL = "https://dea.gov.in/budget-division/475";
export const RATES_QUARTER = "October to December 2026";
export const RATES_VERIFIED = false;
export const SAVING_CHECKED_ON = "2 Oct 2026";

export type TaxSaver = {
  id: string;
  name: string;
  /** Minimum holding before money can come out, from the scheme's rules. */
  lockIn: string;
  /** A notified rate, or how the return is set. */
  returns: string;
  /** How the interest, gains or maturity are taxed. */
  taxOnReturns: string;
  /** The Act's reference for the deduction. */
  deduction: string;
  note?: string;
};

export const TAX_SAVERS: TaxSaver[] = [
  { id: "elss", name: "ELSS mutual funds", lockIn: "3 years", returns: "Market-linked", taxOnReturns: "Gains taxed as equity: 12.5% above ₹1.25 lakh a year", deduction: "Section 123, Schedule XV 1(m)", note: "The shortest lock-in; the only one invested in shares." },
  { id: "ppf", name: "Public Provident Fund", lockIn: "15 years", returns: "7.1% a year, set each quarter", taxOnReturns: "Interest and maturity tax-free", deduction: "Section 123, Schedule XV 1(e)", note: "Tax-free under Schedule II item 3." },
  { id: "ssy", name: "Sukanya Samriddhi Account", lockIn: "Matures 21 years after opening", returns: "8.2% a year, set each quarter", taxOnReturns: "Tax-free", deduction: "Section 123, Schedule XV 1(h)", note: "For a girl child; payments tax-free under Schedule II item 5." },
  { id: "nsc", name: "National Savings Certificate", lockIn: "5 years", returns: "7.7% a year, compounded, paid at maturity", taxOnReturns: "Interest taxed at your slab rate", deduction: "Section 123, Schedule XV 1(i)" },
  { id: "scss", name: "Senior Citizens Savings Scheme", lockIn: "5 years", returns: "8.2% a year, paid quarterly", taxOnReturns: "Interest taxed at your slab rate", deduction: "Section 123, Schedule XV 1(u)", note: "For those 60 and over." },
  { id: "potd", name: "Post Office 5-year Time Deposit", lockIn: "5 years", returns: "7.5% a year", taxOnReturns: "Interest taxed at your slab rate", deduction: "Section 123, Schedule XV 1(v)" },
  { id: "bankfd", name: "Bank tax-saver fixed deposit", lockIn: "5 years", returns: "Set by each bank", taxOnReturns: "Interest taxed at your slab rate", deduction: "Section 123, Schedule XV 1(s)" },
  { id: "life", name: "Life insurance premium", lockIn: "Policy term", returns: "Depends on the plan", taxOnReturns: "Maturity tax-free if the premium is at most 10% of the sum assured and, for policies from 1 Apr 2023, total premiums are within ₹5 lakh (₹2.5 lakh for ULIPs)", deduction: "Section 123, Schedule XV 1(a)", note: "Schedule II item 2 sets the maturity conditions." },
  { id: "nps", name: "National Pension System (own contribution)", lockIn: "Until 60", returns: "Market-linked", taxOnReturns: "Up to 60% of the payout on exit tax-free; the rest buys a taxable pension", deduction: "Section 124(3): up to ₹50,000 more, beyond the ₹1.5 lakh", note: "Schedule II item 6 for the tax-free 60%." },
];

/** Also inside the ₹1.5 lakh: EPF, children's tuition fees and home-loan principal (Schedule XV 1(f), 1(q), 1(r)). */
export const ALSO_COUNTS = "Your EPF contribution, tuition fees for up to two children, and home-loan principal repayment also count towards the ₹1.5 lakh.";
