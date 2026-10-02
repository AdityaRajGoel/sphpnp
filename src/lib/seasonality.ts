export type MonthlyReturn = {
  year: number;
  /** 0 = January. */
  month: number;
  pct: number;
  /** The latest month in the data, which may not have closed yet. */
  toDate: boolean;
};

/** Month-on-month change of the last close in each calendar month; the first month has no base and is skipped. */
export function monthlyReturns(closes: { trade_date: string; close: number | null }[]): MonthlyReturn[] {
  const lastByMonth = new Map<string, number>();
  for (const { trade_date, close } of [...closes].sort((a, b) => a.trade_date.localeCompare(b.trade_date))) {
    if (close != null && close > 0) lastByMonth.set(trade_date.slice(0, 7), close);
  }
  const months = [...lastByMonth];
  return months.slice(1).map(([key, close], i) => ({
    year: Number(key.slice(0, 4)),
    month: Number(key.slice(5, 7)) - 1,
    pct: (close / months[i][1] - 1) * 100,
    toDate: i === months.length - 2,
  }));
}
