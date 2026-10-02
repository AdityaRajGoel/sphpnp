import { describe, it, expect } from "vitest";
import { capitalGainsTax, incomeTax, slabTax, type IncomeInput } from "@/lib/tax-calculators";
import { TAX_RULES } from "@/lib/tax-rules";

/*
 * Every expected figure here is hand-computed from the FY 2026-27 rules in
 * src/lib/tax-rules.ts (Income-tax Act, 2025 and the Finance Act, 2026), so a
 * wrong slab, cap or threshold fails a named case.
 */

describe("tax rules", () => {
  it("carries a source, an as-of date and a verified flag on every figure", () => {
    const walk = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      if ("value" in node && "source" in node) {
        const r = node as unknown as { source: string; asOf: string; verified: boolean };
        expect(r.source).toMatch(/^https:\/\//);
        expect(r.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(typeof r.verified).toBe("boolean");
        return;
      }
      Object.values(node).forEach(walk);
    };
    walk(TAX_RULES);
  });
});

describe("capitalGainsTax", () => {
  it("taxes a short-term gain at 20% plus 4% cess", () => {
    const r = capitalGainsTax({ buyDate: "2026-01-10", sellDate: "2026-06-10", cost: 100000, sale: 120000 });
    expect(r).toMatchObject({ ok: true, term: "short", gain: 20000, taxable: 20000, tax: 4000, cess: 160, total: 4160 });
  });

  it("taxes a long-term gain at 12.5% above the ₹1.25 lakh exemption", () => {
    const r = capitalGainsTax({ buyDate: "2024-04-01", sellDate: "2026-06-01", cost: 200000, sale: 500000 });
    expect(r).toMatchObject({ ok: true, term: "long", gain: 300000, exemption: 125000, taxable: 175000, tax: 21875, cess: 875, total: 22750 });
  });

  it("counts a holding of exactly 12 months as short-term", () => {
    expect(capitalGainsTax({ buyDate: "2025-01-15", sellDate: "2026-01-15", cost: 100, sale: 200 })).toMatchObject({ term: "short" });
    expect(capitalGainsTax({ buyDate: "2025-01-15", sellDate: "2026-01-16", cost: 100, sale: 200 })).toMatchObject({ term: "long" });
  });

  it("applies only what is left of the exemption", () => {
    const r = capitalGainsTax({ buyDate: "2024-04-01", sellDate: "2026-06-01", cost: 200000, sale: 300000, otherLtcg: 100000 });
    expect(r).toMatchObject({ ok: true, exemption: 25000, taxable: 75000, tax: 9375 });
    const used = capitalGainsTax({ buyDate: "2024-04-01", sellDate: "2026-06-01", cost: 200000, sale: 300000, otherLtcg: 200000 });
    expect(used).toMatchObject({ ok: true, exemption: 0, taxable: 100000 });
  });

  it("grandfathers shares bought before 1 Feb 2018 at the 31 Jan 2018 value", () => {
    // Cost = higher of actual cost and (lower of FMV and sale value).
    const up = capitalGainsTax({ buyDate: "2017-06-01", sellDate: "2026-06-01", cost: 100000, sale: 200000, fmv2018: 150000 });
    expect(up).toMatchObject({ ok: true, grandfathered: true, costUsed: 150000, gain: 50000, taxable: 0, total: 0 });
    const below = capitalGainsTax({ buyDate: "2017-06-01", sellDate: "2026-06-01", cost: 100000, sale: 120000, fmv2018: 150000 });
    expect(below).toMatchObject({ ok: true, costUsed: 120000, gain: 0 });
    // Bought on or after 1 Feb 2018: the FMV is ignored.
    const after = capitalGainsTax({ buyDate: "2018-02-01", sellDate: "2026-06-01", cost: 100000, sale: 200000, fmv2018: 150000 });
    expect(after).toMatchObject({ ok: true, grandfathered: false, costUsed: 100000 });
  });

  it("charges no tax on a loss", () => {
    const r = capitalGainsTax({ buyDate: "2026-01-10", sellDate: "2026-06-10", cost: 120000, sale: 100000 });
    expect(r).toMatchObject({ ok: true, gain: -20000, taxable: 0, total: 0 });
  });

  it("rejects bad dates and amounts", () => {
    expect(capitalGainsTax({ buyDate: "2026-06-10", sellDate: "2026-01-10", cost: 1, sale: 2 })).toMatchObject({ ok: false });
    expect(capitalGainsTax({ buyDate: "", sellDate: "2026-01-10", cost: 1, sale: 2 })).toMatchObject({ ok: false });
    expect(capitalGainsTax({ buyDate: "2025-06-10", sellDate: "2026-01-10", cost: 0, sale: 2 })).toMatchObject({ ok: false });
    expect(capitalGainsTax({ buyDate: "2025-06-10", sellDate: "2026-01-10", cost: 10, sale: -2 })).toMatchObject({ ok: false });
  });
});

describe("slabTax", () => {
  it("adds up the new-regime slabs", () => {
    // 20,000 + 40,000 on the first 12 lakh.
    expect(slabTax(1200000, TAX_RULES.newRegime.slabs.value)).toBe(60000);
    expect(slabTax(400000, TAX_RULES.newRegime.slabs.value)).toBe(0);
  });
});

const base: IncomeInput = {
  age: "below60", salary: 0, otherIncome: 0, investments: 0, healthSelf: 0, healthParents: 0,
  parentsSenior: false, homeLoanInterest: 0, hraExempt: 0,
};

describe("incomeTax, new regime", () => {
  it("rebates the whole tax up to ₹12 lakh of taxable income", () => {
    // 12,75,000 salary - 75,000 standard deduction = 12,00,000.
    const r = incomeTax({ ...base, salary: 1275000 }).new;
    expect(r).toMatchObject({ taxableIncome: 1200000, slabTax: 60000, rebate: 60000, cess: 0, total: 0 });
  });

  it("gives marginal relief just above ₹12 lakh", () => {
    // 12,10,000: slab tax 61,500 exceeds the 10,000 over the limit by 51,500 → tax 10,000 + cess 400.
    const r = incomeTax({ ...base, salary: 1285000 }).new;
    expect(r).toMatchObject({ taxableIncome: 1210000, slabTax: 61500, rebate: 51500, cess: 400, total: 10400 });
  });

  it("stops the rebate once the tax is below the excess", () => {
    const r = incomeTax({ ...base, salary: 1375000 }).new;
    expect(r).toMatchObject({ taxableIncome: 1300000, slabTax: 75000, rebate: 0, cess: 3000, total: 78000 });
  });

  it("ignores old-regime deductions and gives no standard deduction on non-salary income", () => {
    const r = incomeTax({ ...base, otherIncome: 1000000, investments: 150000, healthSelf: 25000, homeLoanInterest: 200000, hraExempt: 100000 }).new;
    expect(r.taxableIncome).toBe(1000000);
  });

  it("adds a 10% surcharge above ₹50 lakh", () => {
    // Taxable 60 lakh: slab tax 13,80,000; surcharge 1,38,000; cess 4% of 15,18,000.
    const r = incomeTax({ ...base, salary: 6075000 }).new;
    expect(r).toMatchObject({ taxableIncome: 6000000, slabTax: 1380000, surcharge: 138000, cess: 60720, total: 1578720 });
  });

  it("limits the surcharge by marginal relief just above ₹50 lakh", () => {
    // Taxable 50,10,000: tax 10,83,000; at 50 lakh it is 10,80,000, so tax + surcharge
    // may not exceed 10,80,000 + 10,000 → surcharge 7,000.
    const r = incomeTax({ ...base, salary: 5085000 }).new;
    expect(r).toMatchObject({ slabTax: 1083000, surcharge: 7000, cess: 43600, total: 1133600 });
  });
});

describe("incomeTax, old regime", () => {
  it("applies the standard deduction and capped deductions", () => {
    // 10,00,000 - 50,000 - 1,50,000 (capped from 2,00,000) - 25,000 (capped from 30,000) = 7,75,000.
    // Tax 12,500 + 20% of 2,75,000 = 67,500; cess 2,700.
    const r = incomeTax({ ...base, salary: 1000000, investments: 200000, healthSelf: 30000 }).old;
    expect(r).toMatchObject({ taxableIncome: 775000, slabTax: 67500, rebate: 0, cess: 2700, total: 70200 });
  });

  it("rebates the tax up to ₹5 lakh of taxable income", () => {
    const r = incomeTax({ ...base, salary: 550000 }).old;
    expect(r).toMatchObject({ taxableIncome: 500000, slabTax: 12500, rebate: 12500, total: 0 });
  });

  it("uses the senior-citizen slabs and health-cover caps", () => {
    // 60-79: nil to 3 lakh. 8,00,000 - 50,000 - 50,000 (self, senior cap) - 50,000 (parents, senior cap)
    // = 6,50,000 → 10,000 + 20% of 1,50,000 = 40,000.
    const r = incomeTax({ ...base, age: "60to79", salary: 800000, healthSelf: 60000, healthParents: 60000, parentsSenior: true }).old;
    expect(r).toMatchObject({ taxableIncome: 650000, slabTax: 40000 });
    const eighty = incomeTax({ ...base, age: "80plus", salary: 800000 }).old;
    // 7,50,000: nil to 5 lakh, then 20% → 50,000.
    expect(eighty.slabTax).toBe(50000);
  });

  it("caps home-loan interest at ₹2 lakh and never goes below zero", () => {
    const r = incomeTax({ ...base, salary: 1500000, homeLoanInterest: 350000, hraExempt: 200000 }).old;
    // 15,00,000 - 50,000 - 2,00,000 HRA - 2,00,000 interest = 10,50,000.
    expect(r.taxableIncome).toBe(1050000);
    // Deductions larger than the income leave nothing taxable, not a negative income.
    expect(incomeTax({ ...base, salary: 100000, investments: 150000 }).old.taxableIncome).toBe(0);
    // The standard deduction is capped at the salary itself.
    expect(incomeTax({ ...base, salary: 30000 }).old.taxableIncome).toBe(0);
  });

  it("treats zero or invalid income as no tax", () => {
    const r = incomeTax({ ...base, salary: NaN, otherIncome: -5 });
    expect(r.old.total).toBe(0);
    expect(r.new.total).toBe(0);
  });
});

describe("incomeTax, NPS self-contribution (section 124(3))", () => {
  it("deducts up to ₹50,000 under the old regime, on top of the ₹1.5 lakh section 123 limit", () => {
    const without = incomeTax({ ...base, salary: 1500000, investments: 150000 }).old;
    const withNps = incomeTax({ ...base, salary: 1500000, investments: 150000, npsSelf: 80000 }).old;
    expect(without.taxableIncome - withNps.taxableIncome).toBe(50000);
  });

  it("changes nothing under the new regime", () => {
    expect(incomeTax({ ...base, salary: 1500000, npsSelf: 50000 }).new).toEqual(incomeTax({ ...base, salary: 1500000 }).new);
  });
});
