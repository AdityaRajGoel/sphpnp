/**
 * Tax-loss harvesting on listed equity, FY 2026-27: what selling the holdings
 * that sit below cost would do to this year's capital-gains tax. Every rate and
 * rule comes from tax-rules.ts (Income-tax Act, 2025).
 *
 * Set-off follows section 108(2): a short-term loss may reduce any capital gain,
 * a long-term loss only a long-term one. Short-term losses go against
 * short-term gains first, where they save 20% rather than 12.5%. What cannot be
 * set off this year carries forward (section 111(2), eight years).
 *
 * ponytail: surcharge is left out (it needs total income); the page says so.
 */
import { TAX_RULES } from "@/lib/tax-rules";

const E = TAX_RULES.equity;

export type HarvestPosition = { symbol: string; qty: number; avg: number; price: number; longTerm: boolean };
export type HarvestInput = { stcg: number; ltcg: number; positions: HarvestPosition[] };
export type Gains = { stcg: number; ltcg: number; tax: number };
export type HarvestResult = {
  losses: { symbol: string; loss: number; longTerm: boolean }[];
  shortTermLoss: number;
  longTermLoss: number;
  before: Gains;
  after: Gains;
  saved: number;
  carryForward: { shortTerm: number; longTerm: number };
};

const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/** Tax on a year's net equity gains: STCG at 20%, LTCG above the exemption at 12.5%, plus cess. */
export function gainsTax(stcg: number, ltcg: number): number {
  const base = pos(stcg) * E.stcgRate.value + pos(ltcg - E.ltcgExemption.value) * E.ltcgRate.value;
  return base * (1 + TAX_RULES.cess.value);
}

export function harvest({ stcg, ltcg, positions }: HarvestInput): HarvestResult {
  const losses = positions
    .map((p) => ({ symbol: p.symbol, loss: pos((p.avg - p.price) * p.qty), longTerm: p.longTerm }))
    .filter((l) => l.loss > 0)
    .sort((a, b) => b.loss - a.loss);
  const shortTermLoss = losses.filter((l) => !l.longTerm).reduce((s, l) => s + l.loss, 0);
  const longTermLoss = losses.filter((l) => l.longTerm).reduce((s, l) => s + l.loss, 0);

  let st = pos(stcg), lt = pos(ltcg), stLeft = shortTermLoss, ltLeft = longTermLoss;
  const take = (gain: number, loss: number) => Math.min(gain, loss);
  let used = take(lt, ltLeft); lt -= used; ltLeft -= used;
  used = take(st, stLeft); st -= used; stLeft -= used;
  used = take(lt, stLeft); lt -= used; stLeft -= used;

  const before = { stcg: pos(stcg), ltcg: pos(ltcg), tax: gainsTax(stcg, ltcg) };
  const after = { stcg: st, ltcg: lt, tax: gainsTax(st, lt) };
  return {
    losses, shortTermLoss, longTermLoss, before, after,
    saved: Math.max(0, before.tax - after.tax),
    carryForward: { shortTerm: stLeft, longTerm: ltLeft },
  };
}
