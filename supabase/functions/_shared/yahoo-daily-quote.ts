/**
 * A quote from Yahoo's daily chart (interval=1d, range=5d): the price, and its
 * change on the session before the one that price belongs to.
 *
 * Not meta.chartPreviousClose: on an exchange holiday Yahoo appends an empty
 * bar for the day, and with range=2d that made chartPreviousClose the last
 * session's own close, so every stock read +0.00% (2 Oct 2026).
 */
export type DailyQuote = {
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
};

type Nums = (number | null | undefined)[];
type ChartResult = {
  meta?: { regularMarketPrice?: number; regularMarketTime?: number; chartPreviousClose?: number };
  timestamp?: number[];
  indicators?: { quote?: { close?: Nums; open?: Nums; high?: Nums; low?: Nums; volume?: Nums }[] };
};

const istDate = (unixSeconds: number) => new Date(unixSeconds * 1000 + 5.5 * 3_600_000).toISOString().slice(0, 10);
const num = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined);

export function dailyQuote(result: ChartResult): DailyQuote | null {
  const q = result.indicators?.quote?.[0] ?? {};
  const bars = (result.timestamp ?? [])
    .map((t, i) => ({ date: istDate(t), i, close: num(q.close?.[i]) }))
    .filter((b): b is { date: string; i: number; close: number } => b.close !== undefined);
  const last = bars[bars.length - 1];
  if (!last) return null;

  const price = num(result.meta?.regularMarketPrice) ?? last.close;
  const priceDate = result.meta?.regularMarketTime ? istDate(result.meta.regularMarketTime) : last.date;
  // The price is the last bar's own session (closed, or live today): compare
  // with the bar before it. A price newer than every bar compares with the last.
  // Some NSE sector indices (^CNXFIN, ^CNXAUTO, ...) come back with one bar for
  // the whole range; chartPreviousClose is then the close before that bar.
  const onlyBarPrev = bars.length === 1 && last.date === priceDate ? num(result.meta?.chartPreviousClose) : undefined;
  const baseClose = last.date === priceDate ? (bars[bars.length - 2]?.close ?? onlyBarPrev) : last.close;
  if (baseClose === undefined) return null;

  const change = price - baseClose;
  return {
    price,
    prevClose: baseClose,
    change,
    changePercent: (change / baseClose) * 100,
    open: num(q.open?.[last.i]),
    high: num(q.high?.[last.i]),
    low: num(q.low?.[last.i]),
    volume: num(q.volume?.[last.i]),
  };
}
