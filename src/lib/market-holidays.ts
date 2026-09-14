/**
 * Exchange trading holidays and the F&O expiry calendar derived from them.
 *
 * The holiday list is the exchanges' published 2026 list. Expiry rules follow
 * SEBI's 2025 change (effective 1 September 2025): NSE index and stock
 * derivatives expire on Tuesday - weekly only on Nifty 50, monthly on the last
 * Tuesday - and BSE's on Thursday - weekly only on Sensex, monthly on the last
 * Thursday. An expiry that lands on a holiday moves to the previous trading day.
 */

export type Exchange = "NSE" | "BSE" | "MCX";
export type Holiday = { date: string; name: string; exchanges: Exchange[] };

export const HOLIDAY_YEAR = 2026;

export const HOLIDAYS: Holiday[] = [
  { date: "2026-01-26", name: "Republic Day", exchanges: ["NSE", "BSE", "MCX"] },
  { date: "2026-03-03", name: "Holi", exchanges: ["NSE", "BSE", "MCX"] },
  { date: "2026-03-26", name: "Shri Ram Navami", exchanges: ["NSE", "BSE"] },
  { date: "2026-03-31", name: "Shri Mahavir Jayanti", exchanges: ["NSE", "BSE"] },
  { date: "2026-04-03", name: "Good Friday", exchanges: ["NSE", "BSE", "MCX"] },
  { date: "2026-04-14", name: "Dr. Ambedkar Jayanti", exchanges: ["NSE", "BSE"] },
  { date: "2026-05-01", name: "Maharashtra Day", exchanges: ["NSE", "BSE"] },
  { date: "2026-05-28", name: "Bakri Id", exchanges: ["NSE", "BSE"] },
  { date: "2026-06-26", name: "Muharram", exchanges: ["NSE", "BSE"] },
  { date: "2026-09-14", name: "Ganesh Chaturthi", exchanges: ["NSE", "BSE"] },
  { date: "2026-10-02", name: "Mahatma Gandhi Jayanti", exchanges: ["NSE", "BSE", "MCX"] },
  { date: "2026-10-20", name: "Dussehra", exchanges: ["NSE", "BSE", "MCX"] },
  { date: "2026-11-10", name: "Diwali Balipratipada", exchanges: ["NSE", "BSE"] },
  { date: "2026-11-24", name: "Guru Nanak Jayanti", exchanges: ["NSE", "BSE"] },
  { date: "2026-12-25", name: "Christmas", exchanges: ["NSE", "BSE", "MCX"] },
];

const DAY = 86_400_000;
/** ISO date (YYYY-MM-DD) as a UTC midnight timestamp; all arithmetic here is on whole days. */
const ts = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const weekday = (t: number) => new Date(t).getUTCDay();

export function isTradingDay(date: string, exchange: Exchange = "NSE", holidays: Holiday[] = HOLIDAYS): boolean {
  const d = weekday(ts(date));
  if (d === 0 || d === 6) return false;
  return !holidays.some((h) => h.date === date && h.exchanges.includes(exchange));
}

/** The date itself if it trades, otherwise the nearest earlier trading day. */
export function previousTradingDay(date: string, exchange: Exchange = "NSE", holidays: Holiday[] = HOLIDAYS): string {
  let t = ts(date);
  while (!isTradingDay(iso(t), exchange, holidays)) t -= DAY;
  return iso(t);
}

/** Trading sessions strictly after `from` up to and including `to`. */
export function tradingDaysBetween(from: string, to: string, exchange: Exchange = "NSE", holidays: Holiday[] = HOLIDAYS): number {
  let count = 0;
  for (let t = ts(from) + DAY; t <= ts(to); t += DAY) if (isTradingDay(iso(t), exchange, holidays)) count++;
  return count;
}

export type Expiry = {
  date: string;
  /** The weekday the rule names, before any holiday shift. */
  scheduled: string;
  exchange: "NSE" | "BSE";
  kind: "weekly" | "monthly";
  contracts: string;
  shifted: boolean;
};

const lastWeekdayOfMonth = (year: number, month: number, day: number): number => {
  let t = Date.UTC(year, month + 1, 0);
  while (weekday(t) !== day) t -= DAY;
  return t;
};

/**
 * Every NSE and BSE expiry from `from` for `days` days. A weekly expiry that
 * falls on the monthly date is reported once, as the monthly.
 */
export function expiryCalendar(from: string, days = 60, holidays: Holiday[] = HOLIDAYS): Expiry[] {
  const out: Expiry[] = [];
  const start = ts(from);
  const end = start + days * DAY;
  const rules = [
    { exchange: "NSE" as const, day: 2, weekly: "Nifty 50", monthly: "Nifty 50, Bank Nifty, Fin Nifty, Midcap Nifty and stock F&O" },
    { exchange: "BSE" as const, day: 4, weekly: "Sensex", monthly: "Sensex, Bankex and stock F&O" },
  ];
  for (const rule of rules) {
    for (let t = start - 7 * DAY; t <= end + 7 * DAY; t += DAY) {
      if (weekday(t) !== rule.day) continue;
      const d = new Date(t);
      const monthly = lastWeekdayOfMonth(d.getUTCFullYear(), d.getUTCMonth(), rule.day) === t;
      const actual = previousTradingDay(iso(t), rule.exchange, holidays);
      if (ts(actual) < start || ts(actual) > end) continue;
      out.push({
        date: actual,
        scheduled: iso(t),
        exchange: rule.exchange,
        kind: monthly ? "monthly" : "weekly",
        contracts: monthly ? rule.monthly : rule.weekly,
        shifted: actual !== iso(t),
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.exchange.localeCompare(b.exchange));
}

/** NSE session timings, IST. */
export const SESSIONS = [
  { name: "Pre-open", start: "09:00", end: "09:15", note: "Order entry 09:00-09:08, matching after" },
  { name: "Normal market", start: "09:15", end: "15:30", note: "Continuous trading, equity and F&O" },
  { name: "Closing session", start: "15:40", end: "16:00", note: "Trades at the closing price" },
  { name: "MCX commodities", start: "09:00", end: "23:30", note: "Evening session runs to 23:55 for some contracts during US daylight saving" },
];
