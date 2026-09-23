/**
 * Parasram's brokerage and the statutory charges on a trade - one source for the
 * Pricing page's rate card and the Brokerage Calculator. They drifted apart once
 * (the calculator said 0.015% and ₹15/lot for a year after the rate card moved to
 * 0.02% and ₹30/lot), so neither keeps its own copy now.
 *
 * Brokerage is what a trade COSTS. Margin - the money a position BLOCKS - is a
 * different number with its own calculator (/margin-calculator); nothing here
 * is margin.
 */

/** Parasram's standard plan (rate card, July 2026). Per-lot rates apply to each side. */
export type BrokerageRule = { kind: "percent"; rate: number } | { kind: "perLot"; amount: number };

export type RateCardId = "delivery" | "intraday" | "eqFutures" | "eqOptions" | "curFutures" | "curOptions" | "mcx";

export const RATE_CARD: { id: RateCardId; label: string; rule: BrokerageRule }[] = [
  { id: "delivery", label: "Equity Delivery", rule: { kind: "percent", rate: 0.0015 } },
  { id: "intraday", label: "Equity Intraday", rule: { kind: "percent", rate: 0.0002 } },
  { id: "eqFutures", label: "Equity Futures", rule: { kind: "percent", rate: 0.0002 } },
  { id: "eqOptions", label: "Equity Options", rule: { kind: "perLot", amount: 30 } },
  { id: "curFutures", label: "Currency Futures", rule: { kind: "percent", rate: 0.0002 } },
  { id: "curOptions", label: "Currency Options", rule: { kind: "perLot", amount: 30 } },
  { id: "mcx", label: "Commodity (MCX)", rule: { kind: "perLot", amount: 30 } },
];

const rule = (id: RateCardId) => RATE_CARD.find((r) => r.id === id)!.rule;

/** "0.02%" or "₹30 per lot" - trailing zeros trimmed, as a rate card prints it. */
export const formatRule = (r: BrokerageRule): string =>
  r.kind === "perLot" ? `₹${r.amount} per lot` : `${+(r.rate * 100).toFixed(4)}%`;

/**
 * Statutory rates as of September 2026: STT as revised from 1 April 2026 (futures
 * 0.05%, options 0.15% of premium), NSE/MCX transaction charges as revised from
 * 1 October 2024, stamp duty under the Indian Stamp Act (buy side only), SEBI
 * turnover fee ₹10/crore. GST is 18% on brokerage + transaction charges + SEBI fee.
 */
export const SEBI_FEE_RATE = 10 / 1e7;
export const GST_RATE = 0.18;
export const RATES_AS_OF = "September 2026";

export type SegmentKey =
  | "equity_delivery" | "equity_intraday" | "futures" | "options"
  | "currency_futures" | "currency_options" | "commodity_futures" | "commodity_options";

export type Segment = {
  key: SegmentKey;
  label: string;
  brokerage: BrokerageRule;
  /** Priced per lot (F&O, currency, MCX): the calculator asks for lot size and lots. */
  byLot: boolean;
  /** Price means the option premium, not the underlying. */
  isOption: boolean;
  sttBuy: number;
  sttSell: number;
  /** STT or CTT - commodities pay Commodity Transaction Tax. */
  taxName: "STT" | "CTT";
  exchange: number;
  exchangeNote: string;
  stamp: number;
};

export const SEGMENTS: Segment[] = [
  { key: "equity_delivery", label: "Equity Delivery", brokerage: rule("delivery"), byLot: false, isOption: false,
    sttBuy: 0.001, sttSell: 0.001, taxName: "STT", exchange: 0.0000307, exchangeNote: "NSE", stamp: 0.00015 },
  { key: "equity_intraday", label: "Equity Intraday", brokerage: rule("intraday"), byLot: false, isOption: false,
    sttBuy: 0, sttSell: 0.00025, taxName: "STT", exchange: 0.0000307, exchangeNote: "NSE", stamp: 0.00003 },
  { key: "futures", label: "Equity Futures", brokerage: rule("eqFutures"), byLot: true, isOption: false,
    sttBuy: 0, sttSell: 0.0005, taxName: "STT", exchange: 0.0000183, exchangeNote: "NSE", stamp: 0.00002 },
  { key: "options", label: "Equity Options", brokerage: rule("eqOptions"), byLot: true, isOption: true,
    sttBuy: 0, sttSell: 0.0015, taxName: "STT", exchange: 0.0003553, exchangeNote: "NSE, on premium", stamp: 0.00003 },
  { key: "currency_futures", label: "Currency Futures", brokerage: rule("curFutures"), byLot: true, isOption: false,
    sttBuy: 0, sttSell: 0, taxName: "STT", exchange: 0.0000035, exchangeNote: "NSE", stamp: 0.000001 },
  { key: "currency_options", label: "Currency Options", brokerage: rule("curOptions"), byLot: true, isOption: true,
    sttBuy: 0, sttSell: 0, taxName: "STT", exchange: 0.000311, exchangeNote: "NSE, on premium", stamp: 0.000001 },
  { key: "commodity_futures", label: "MCX Futures", brokerage: rule("mcx"), byLot: true, isOption: false,
    sttBuy: 0, sttSell: 0.0001, taxName: "CTT", exchange: 0.000021, exchangeNote: "MCX", stamp: 0.00002 },
  { key: "commodity_options", label: "MCX Options", brokerage: rule("mcx"), byLot: true, isOption: true,
    sttBuy: 0, sttSell: 0.0005, taxName: "CTT", exchange: 0.000418, exchangeNote: "MCX, on premium", stamp: 0.00003 },
];

export const segmentByKey = (key: SegmentKey): Segment => SEGMENTS.find((s) => s.key === key)!;

export type Trade = {
  buyPrice: number;
  sellPrice: number;
  /** Units traded on each side (lot size x lots for F&O). */
  quantity: number;
  /** Lots on each side; only per-lot brokerage reads it. */
  lots: number;
};

export type Charges = {
  brokerage: number;
  stt: number;
  exchange: number;
  sebi: number;
  gst: number;
  stamp: number;
  total: number;
  buyValue: number;
  sellValue: number;
  turnover: number;
};

const clean = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/** One round trip: buy then sell the same quantity. Unrounded - the contract note rounds, this estimates. */
export function calculateCharges(seg: Segment, trade: Trade): Charges {
  const buyValue = clean(trade.buyPrice) * clean(trade.quantity);
  const sellValue = clean(trade.sellPrice) * clean(trade.quantity);
  const turnover = buyValue + sellValue;
  const sides = (buyValue > 0 ? 1 : 0) + (sellValue > 0 ? 1 : 0);

  const brokerage =
    seg.brokerage.kind === "perLot"
      ? seg.brokerage.amount * clean(trade.lots) * sides
      : turnover * seg.brokerage.rate;
  const stt = buyValue * seg.sttBuy + sellValue * seg.sttSell;
  const exchange = turnover * seg.exchange;
  const sebi = turnover * SEBI_FEE_RATE;
  const gst = (brokerage + exchange + sebi) * GST_RATE;
  const stamp = buyValue * seg.stamp;
  const total = brokerage + stt + exchange + sebi + gst + stamp;

  return { brokerage, stt, exchange, sebi, gst, stamp, total, buyValue, sellValue, turnover };
}
