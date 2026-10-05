import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { revealSection } from "@/lib/motion";
import { formatRule, rateRule } from "@/lib/brokerage";

type Row = { label: string; ours: string; fullService: string; discount: string };

const rate = (id: Parameters<typeof rateRule>[0]) => formatRule(rateRule(id));

// Rival columns are typical published ranges, never a named broker (the user's
// call - exchange advertising rules and stale figures). Checked October 2026
// against Zerodha, ICICI Direct, HDFC Securities and Kotak Securities pricing
// pages; re-check when updating. Our column is the branch's confirmed terms.
const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: "Brokerage",
    rows: [
      { label: "Equity delivery", ours: rate("delivery"), fullService: "0.20%–0.50%", discount: "₹0, or up to ₹20 per order" },
      { label: "Equity intraday", ours: rate("intraday"), fullService: "0.02%–0.05%", discount: "Up to ₹20 per order" },
      { label: "Equity futures", ours: rate("eqFutures"), fullService: "0.02%–0.05%", discount: "Up to ₹20 per order" },
      { label: "Equity options", ours: rate("eqOptions"), fullService: "₹20–₹50 per lot or order", discount: "₹20 per order" },
      { label: "Pricing plan", ours: "Custom plan for every client", fullService: "Fixed plans; negotiable for large accounts", discount: "Same flat fee for every client" },
    ],
  },
  {
    title: "Account",
    rows: [
      { label: "Account opening", ours: "₹0", fullService: "₹0 on most plans", discount: "₹0" },
      { label: "Demat AMC", ours: "₹885 a year", fullService: "₹300–₹750 a year", discount: "₹0–₹300 a year + GST" },
      { label: "Plan subscription", ours: "None", fullService: "₹999–₹9,999 a year on some plans, for lower rates", discount: "Usually none" },
    ],
  },
  {
    title: "Fees beyond brokerage",
    rows: [
      { label: "DP charge on selling shares", ours: "₹0", fullService: "About ₹20 + GST per stock", discount: "₹13–₹20 + GST per stock" },
      { label: "Call & trade", ours: "₹0", fullService: "₹0–₹50 per order", discount: "Typically ₹50 per order" },
      { label: "Auto square-off", ours: "No fee; your dealer calls before closing a position", fullService: "Usually charged per order", discount: "₹20–₹50 + GST per order" },
      { label: "Pledge / unpledge for margin", ours: "₹0", fullService: "Usually charged per stock", discount: "₹20–₹30 + GST per stock" },
      { label: "Adding funds", ours: "₹0 by bank transfer", fullService: "Usually free", discount: "UPI free; up to ₹9 + GST by netbanking" },
      { label: "Physical statements & contract notes", ours: "Free for every client, from the office", fullService: "Often charged per request", discount: "Often ₹20 + ₹100 courier + GST per request" },
    ],
  },
  {
    title: "Service",
    rows: [
      { label: "Research", ours: "Daily reports and stock recommendations from SEBI-registered analysts", fullService: "Included, often tiered by account size", discount: "None, or a paid add-on" },
      { label: "Point of contact", ours: "Your own dealer and the Panipat branch", fullService: "Relationship manager, often for larger accounts", discount: "App, chat and support tickets" },
      { label: "Algo trading", ours: "Free algo registration and setup, help building and deploying strategies, custom exposure plans", fullService: "Varies; platforms often paid", discount: "Self-serve APIs; data feeds often paid" },
      { label: "Margin trading (MTF)", ours: "Custom exposure by risk profile, no fixed cap", fullService: "Standard limits set by the broker", discount: "Standard limits set by the broker" },
      { label: "Paperwork & account services", ours: "Free for every client: KYC updates, nominations, transmissions, account changes and pledges", fullService: "At branches; offline requests may be charged", discount: "Online self-service; offline requests often charged" },
      { label: "HNI service", ours: "Advanced paperwork free, with service at your home or office", fullService: "Sometimes, for large accounts", discount: "Not offered" },
      { label: "Tax support", ours: "Capital gains statements and P&L reports, plus help with tax-filing paperwork", fullService: "Reports, with limited help", discount: "Self-serve reports" },
    ],
  },
];

const COLUMNS = ["Parasram India", "Typical full-service broker", "Typical discount broker"] as const;

const REASONS = [
  {
    title: "Lower than most full-service brokers",
    body: `${rate("delivery")} on delivery against the 0.20%–0.50% most full-service brokers charge, with the same research, dealer desk and branch behind it.`,
  },
  {
    title: "No hidden extras",
    body: "Discount brokers win on the headline rate, then add a DP charge every time you sell. Selling four stocks a month comes to about ₹700–₹1,100 a year in DP charges alone. Here it is ₹0, and so are call & trade, pledges, square-off fees and physical statements.",
  },
  {
    title: "A plan built around you",
    body: "Every client can ask for a custom brokerage plan tailored to their volume and needs, so the gap to a flat-fee broker narrows as you trade more.",
  },
];

export default function BrokerComparison() {
  return (
    <motion.section aria-labelledby="broker-comparison" className="rounded-2xl border border-border/50 bg-card" {...revealSection}>
      <div className="p-5 sm:p-6">
        <h2 id="broker-comparison" className="font-heading text-lg font-bold">How we compare with other brokers</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Parasram India against a typical full-service broker and a typical discount broker, including the fees that don't make the headline rate.
        </p>
      </div>

      <p className="border-t border-border/50 px-5 py-2 text-xs text-muted-foreground sm:hidden">Swipe the table sideways to see the other brokers.</p>
      <div className="overflow-x-auto border-t border-border/50">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Brokerage, account charges, other fees and services compared</caption>
          <thead>
            <tr className="border-b border-border/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="sticky left-0 z-10 w-[24%] bg-card px-4 py-3 font-medium sm:px-5"><span className="sr-only">Item</span></th>
              {COLUMNS.map((c, i) => (
                <th key={c} scope="col" className={`w-[25.33%] px-4 py-3 font-semibold ${i === 0 ? "bg-secondary/10 text-foreground" : ""}`}>{c}</th>
              ))}
            </tr>
          </thead>
          {GROUPS.map((g) => (
            <tbody key={g.title}>
              <tr className="border-b border-border/40 bg-muted/40">
                <th scope="colgroup" colSpan={4} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-secondary sm:px-5">{g.title}</th>
              </tr>
              {g.rows.map((r) => (
                <tr key={r.label} className="border-b border-border/30 align-top last:border-0">
                  <th scope="row" className="sticky left-0 z-10 bg-card px-4 py-3 text-left font-medium text-foreground sm:px-5">{r.label}</th>
                  <td className="bg-secondary/10 px-4 py-3 font-semibold text-foreground">{r.ours}</td>
                  <td className="px-4 py-3 text-foreground">{r.fullService}</td>
                  <td className="px-4 py-3 text-foreground">{r.discount}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <div className="border-t border-border/50 p-5 sm:p-6">
        <h3 className="font-heading text-base font-bold">What your brokerage pays for</h3>
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          {REASONS.map((r) => (
            <div key={r.title}>
              <h4 className="text-sm font-semibold text-foreground">{r.title}</h4>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{r.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          Other brokers' figures are typical published ranges as of October 2026, not any one broker; plans vary and change. Statutory charges (STT,
          exchange fees, SEBI fee, stamp duty, GST) apply at every broker. Third-party algo platform subscriptions, if any, are billed by the platform.
          Work out your own trade in the{" "}
          <Link to="/brokerage-calculator" className="font-medium text-secondary hover:underline">brokerage calculator</Link>.
        </p>
      </div>
    </motion.section>
  );
}
