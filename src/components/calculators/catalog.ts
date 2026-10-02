import {
  ArrowDownUp, Calculator, CalendarClock, Coins, Landmark, LineChart, PiggyBank, ReceiptIndianRupee, Scale, Sigma, TrendingUp, Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type CalculatorEntry = { href: string; name: string; blurb: string; icon: LucideIcon; group: "Investing" | "Returns" | "Trading" | "Tax" };

/** Every calculator on the site, for the /calculators hub and the "more calculators" row on each one. */
export const CALCULATORS: CalculatorEntry[] = [
  { href: "/sip-calculator", name: "SIP Calculator", blurb: "What a fixed monthly SIP can grow to", icon: TrendingUp, group: "Investing" },
  { href: "/step-up-sip-calculator", name: "Step-up SIP Calculator", blurb: "A SIP that rises by a set percentage every year", icon: LineChart, group: "Investing" },
  { href: "/lumpsum-calculator", name: "Lumpsum Calculator", blurb: "One amount invested today, compounded yearly", icon: PiggyBank, group: "Investing" },
  { href: "/swp-calculator", name: "SWP Calculator", blurb: "Monthly withdrawals from a corpus, and how long it lasts", icon: Wallet, group: "Investing" },
  { href: "/cagr-calculator", name: "CAGR Calculator", blurb: "The yearly growth rate between two values", icon: Sigma, group: "Returns" },
  { href: "/xirr-calculator", name: "XIRR Calculator", blurb: "Annual return on money paid in and out on different dates", icon: CalendarClock, group: "Returns" },
  { href: "/stock-average-calculator", name: "Stock Average Calculator", blurb: "Average buy price across several buys and sells", icon: ArrowDownUp, group: "Trading" },
  { href: "/option-value-calculator", name: "Option Value Calculator", blurb: "Black-Scholes call and put value with the Greeks", icon: Scale, group: "Trading" },
  { href: "/brokerage-calculator", name: "Brokerage Calculator", blurb: "Charges and net P&L on a trade", icon: Calculator, group: "Trading" },
  { href: "/margin-calculator", name: "Margin Calculator", blurb: "SPAN margin for F&O and MCX", icon: Coins, group: "Trading" },
  { href: "/capital-gains-tax-calculator", name: "Capital Gains Tax Calculator", blurb: "Tax on selling listed shares and equity funds", icon: ReceiptIndianRupee, group: "Tax" },
  { href: "/income-tax-calculator", name: "Income Tax Calculator", blurb: "Old and new regime side by side for FY 2026-27", icon: Landmark, group: "Tax" },
  { href: "/tax-saving-investments", name: "Tax-Saving Investments", blurb: "ELSS, PPF, NPS and more compared, and the tax each saves", icon: PiggyBank, group: "Tax" },
  { href: "/tax-loss-harvesting-calculator", name: "Tax-Loss Harvesting", blurb: "Tax saved by booking losses against this year's gains", icon: ArrowDownUp, group: "Tax" },
];
