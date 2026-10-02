import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import CalculatorShell from "@/components/calculators/CalculatorShell";
import TaxRulesUsed from "@/components/calculators/TaxRulesUsed";
import { Headline, NumberField, Rows, Segmented, inr, num } from "@/components/calculators/fields";
import { incomeTax, type AgeBand } from "@/lib/tax-calculators";
import { TAX_RULES, TAX_YEAR_LABEL } from "@/lib/tax-rules";
import { ALSO_COUNTS, RATES_QUARTER, RATES_VERIFIED, SAVING_CHECKED_ON, SMALL_SAVINGS_RATES_URL, TAX_SAVERS } from "@/lib/tax-saving";

const CAPS = TAX_RULES.oldRegime.caps;

export default function TaxSavingInvestmentsPage() {
  const [age, setAge] = useState<AgeBand>("below60");
  const [salary, setSalary] = useState("1800000");
  const [other, setOther] = useState("0");
  const [already, setAlready] = useState("60000");
  const [planned, setPlanned] = useState("90000");
  const [nps, setNps] = useState("50000");

  const input = { age, salary: num(salary) || 0, otherIncome: num(other) || 0, investments: num(already) || 0, healthSelf: 0, healthParents: 0, parentsSenior: false, homeLoanInterest: 0, hraExempt: 0 };
  const before = incomeTax(input);
  const after = incomeTax({ ...input, investments: (num(already) || 0) + (num(planned) || 0), npsSelf: num(nps) || 0 });
  const saved = Math.max(0, before.old.total - after.old.total);
  const room = Math.max(0, CAPS.investments.value - (num(already) || 0));
  const newIsLower = after.new.total < after.old.total;

  return (
    <CalculatorShell
      path="/tax-saving-investments"
      name="Tax-Saving Investments"
      seoTitle="Tax-Saving Investments FY 2026-27: ELSS vs PPF vs NPS"
      description={`Compare ELSS, PPF, NPS, Sukanya Samriddhi, NSC, SCSS and tax-saver FDs for ${TAX_YEAR_LABEL}: lock-in, returns, tax on returns, and the tax each one saves you.`}
      intro={`Under the old regime, investments listed in Schedule XV of the Income-tax Act, 2025 reduce taxable income by up to ${inr(CAPS.investments.value)} (section 123), and NPS by up to ${inr(CAPS.npsSelf.value)} more (section 124(3)). The new regime allows neither, so check which regime you file under first.`}
      notes={
        <>
          An estimate for a resident individual, not tax advice. It assumes no other old-regime deductions; the <Link to="/income-tax-calculator" className="underline underline-offset-4">income tax calculator</Link> takes HRA, health cover and home-loan interest too. Rates for {RATES_QUARTER} are those the Department of Economic Affairs has kept unchanged since 1 January 2024
          {RATES_VERIFIED ? "" : "; we checked the notices from December 2025 onward, and the earlier ones were not online"} (<a href={SMALL_SAVINGS_RATES_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">DEA notices</a>, checked {SAVING_CHECKED_ON}).
        </>
      }
      faqItems={[
        { question: "Do tax-saving investments help under the new regime?", answer: "No. The new regime does not allow the section 123 or section 124(3) deductions. Only someone filing under the old regime saves tax by making them." },
        { question: "What is the shortest lock-in?", answer: "ELSS mutual funds, at three years. PPF runs fifteen years; NSC, SCSS and tax-saver deposits five." },
        { question: "Which tax-saving investments have tax-free returns?", answer: "PPF and the Sukanya Samriddhi Account pay out tax-free. NPS pays up to 60% of the corpus tax-free on exit. ELSS gains are taxed as equity gains; interest on NSC, SCSS and deposits is taxed at your slab rate." },
      ]}
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="space-y-4 p-5 lg:col-span-2 lg:self-start">
          <Segmented<AgeBand> label="Your age" value={age} onChange={setAge} options={[{ value: "below60", label: "Under 60" }, { value: "60to79", label: "60-79" }, { value: "80plus", label: "80+" }]} />
          <div className="grid grid-cols-2 gap-3">
            <NumberField id="ts-salary" label="Salary for the year (₹)" value={salary} onChange={setSalary} />
            <NumberField id="ts-other" label="Other income (₹)" value={other} onChange={setOther} />
          </div>
          <NumberField id="ts-already" label="Already counting towards ₹1.5 lakh (₹)" value={already} onChange={setAlready} hint={`EPF, tuition fees, home-loan principal, premiums. ${inr(room)} of room left.`} />
          <div className="grid grid-cols-2 gap-3">
            <NumberField id="ts-planned" label="New section 123 investment (₹)" value={planned} onChange={setPlanned} />
            <NumberField id="ts-nps" label="NPS, own contribution (₹)" value={nps} onChange={setNps} hint={`Up to ${inr(CAPS.npsSelf.value)} extra`} />
          </div>
        </Card>

        <div className="space-y-6 lg:col-span-3" aria-live="polite">
          <Headline label="Old-regime tax these investments save" value={inr(saved)}>
            <Rows rows={[
              { label: "Old regime, before", value: inr(before.old.total) },
              { label: "Old regime, after investing", value: inr(after.old.total), strong: true },
              { label: "New regime (no deductions)", value: inr(after.new.total) },
            ]} />
            <p className={`mt-3 rounded-md px-3 py-2 text-sm ${newIsLower ? "bg-muted text-foreground" : "text-muted-foreground"}`}>
              {newIsLower
                ? `Even after these investments, the new regime costs ${inr(after.old.total - after.new.total)} less. Invest for the returns, not the deduction.`
                : `With these investments the old regime costs ${inr(after.new.total - after.old.total)} less than the new one.`}
            </p>
          </Headline>
          <TaxRulesUsed rules={[
            { label: "Schedule XV investments", value: `Up to ${inr(CAPS.investments.value)}`, rule: CAPS.investments },
            { label: "NPS, own contribution", value: `Up to ${inr(CAPS.npsSelf.value)} more`, rule: CAPS.npsSelf },
          ]} />
        </div>
      </div>

      <section aria-labelledby="compare" className="mt-10">
        <h2 id="compare" className="text-xl font-bold tracking-tight">The options side by side</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">Rates for {RATES_QUARTER}. {ALSO_COUNTS}</p>
        <Card className="mt-4 overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Investment</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Lock-in</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Returns</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Tax on returns</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Deduction</th>
              </tr>
            </thead>
            <tbody>
              {TAX_SAVERS.map((t) => (
                <tr key={t.id} className="border-t align-top">
                  <th scope="row" className="px-4 py-3 text-left font-semibold">
                    {t.name}
                    {t.note && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{t.note}</span>}
                  </th>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums">{t.lockIn}</td>
                  <td className="px-3 py-3 tabular-nums">{t.returns}</td>
                  <td className="px-3 py-3">{t.taxOnReturns}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{t.deduction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="mt-2 text-xs text-muted-foreground">Lock-ins come from each scheme's own rules; deductions and tax treatment from the Income-tax Act, 2025 (Schedules XV and II). Market-linked returns are not guaranteed.</p>
      </section>
    </CalculatorShell>
  );
}
