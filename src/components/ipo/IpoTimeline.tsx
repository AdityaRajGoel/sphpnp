import { Link } from "react-router-dom";

// SEBI's T+3 timetable for public issues (mandatory since 1 Dec 2023): T is
// the day the issue closes, counted in working days.
const STEPS = [
  { when: "Issue open", what: "Bid through UPI or ASBA", detail: "At least 3 working days; your bid amount is blocked in your bank account, not debited." },
  { when: "T", what: "Issue closes", detail: "Last day to bid. UPI mandates must be approved by 5 pm." },
  { when: "T+1", what: "Allotment", detail: "Basis of allotment finalised; check your status with the registrar or exchange." },
  { when: "T+2", what: "Shares or refund", detail: "Allotted shares reach your Demat account; blocked money for the rest is released." },
  { when: "T+3", what: "Listing", detail: "Shares start trading on NSE and BSE." },
];

/** The IPO timeline as a step diagram: the dates on every issue card follow it. */
export default function IpoTimeline() {
  return (
    <section aria-labelledby="ipo-timeline" className="mt-14">
      <h2 id="ipo-timeline" className="font-heading text-2xl font-bold">How an IPO runs, day by day</h2>
      <p className="mt-1 text-sm text-muted-foreground">SEBI's T+3 timetable, where T is the day the issue closes and each step is a working day.</p>
      <ol className="mt-6 grid gap-4 md:grid-cols-5 md:gap-0">
        {STEPS.map((s, i) => (
          <li key={s.when} className="relative flex gap-4 md:block md:pr-4">
            {/* The connector runs between markers: down the left on phones, across on desktop. */}
            {i < STEPS.length - 1 && <span aria-hidden className="absolute left-[1.15rem] top-10 h-[calc(100%-1.5rem)] w-px bg-border md:left-10 md:top-[1.15rem] md:h-px md:w-[calc(100%-2.5rem)]" />}
            <span className={`relative z-10 inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full border px-2 text-xs font-bold tabular-nums ${i === 0 ? "border-border bg-muted text-muted-foreground" : "border-secondary/40 bg-secondary/10 text-secondary"}`}>{s.when === "Issue open" ? "Bid" : s.when}</span>
            <div className="md:mt-3">
              <p className="font-semibold">{s.what}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-muted-foreground">More in the <Link to="/learn/ipo-guide" className="font-medium text-secondary hover:underline">IPO guide</Link>. Holidays push each step to the next working day.</p>
    </section>
  );
}
