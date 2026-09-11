// The site-wide live-updates ticker: IPOs in play, the day's biggest movers,
// market headlines, upcoming ex-dates and the latest NSE announcements, woven
// together so no one kind runs for long. Built by ticker-feed from stored
// tables plus one Google News search, and cached for five minutes.
//
// Pure: no fetch, no Deno APIs.

import { deriveIpoStatus, istDate } from "./ipo-status.ts";
import { ipoMatchKey, type IpoStatus } from "./ipo-parse.ts";
import type { NewsItem } from "./google-news.ts";

export type TickerKind = "ipo" | "gainer" | "loser" | "news" | "ex_date" | "announcement" | "global";
export type TickerItem = {
  kind: TickerKind;
  /** Short label shown as a chip: "IPO OPEN", "NEWS · Mint". */
  tag: string;
  text: string;
  href: string | null;
  tone: "up" | "down" | "neutral";
  /** Opens off-site (a publisher's story, an NSE filing). */
  external: boolean;
};

export type TickerIpo = {
  slug: string;
  name: string;
  status: IpoStatus;
  open_date: string | null;
  close_date: string | null;
  listing_date: string | null;
  price_band_min: number | null;
  price_band_max: number | null;
  subscription_total: number | null;
  listing_gain_pct: number | null;
};
export type TickerStock = { symbol: string; price: number; change_pct: number; market_cap: number };
export type TickerAnnouncement = { company: string; subject: string | null; attachment_url: string; published_at: string | null };
export type TickerExDate = { company: string; purpose: string | null; ex_date: string };

/** How far ahead an upcoming issue or ex-date is worth announcing, and how long a listing stays news. */
const UPCOMING_DAYS = 10;
const LISTED_DAYS = 3;
/** Movers are drawn from companies of at least this size (crore), so a thinly traded small cap does not lead the ticker. */
const MOVER_MIN_CAP = 20000;

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const rupees = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const signedPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);
const band = (ipo: TickerIpo) =>
  ipo.price_band_max === null ? null
    : ipo.price_band_min !== null && ipo.price_band_min !== ipo.price_band_max
      ? `${rupees(ipo.price_band_min)}-${ipo.price_band_max.toLocaleString("en-IN")}`
      : rupees(ipo.price_band_max);
const cleanName = (name: string) => name.replace(/\s+(IPO|Limited|Ltd\.?)\s*$/i, "").trim();

function gmpText(gmp: number | undefined, ipo: TickerIpo): string | null {
  if (gmp === undefined) return null;
  const pct = ipo.price_band_max && ipo.price_band_max > 0 ? ` (${signedPct((gmp / ipo.price_band_max) * 100)})` : "";
  return `GMP ${rupees(gmp)}${pct}`;
}

/**
 * IPOs worth a line today: open for bids, about to list, opening soon, or
 * listed in the last few days. Status is re-derived from the dates, so an
 * issue that closed overnight never reads "open".
 */
export function ipoItems(ipos: TickerIpo[], gmpByIpo: Map<string, number>, today = istDate()): TickerItem[] {
  const rank: Record<string, number> = { open: 0, closed: 1, upcoming: 2, listed: 3 };
  const lines: { rank: number; date: string; item: TickerItem }[] = [];
  for (const ipo of ipos) {
    const status = deriveIpoStatus(ipo, ipo.status, today);
    const name = cleanName(ipo.name);
    const href = `/ipo/${ipo.slug}`;
    const gmp = gmpText(gmpByIpo.get(ipo.slug), ipo);
    if (status === "open") {
      const closes = ipo.close_date ? (ipo.close_date === today ? "closes today" : `closes ${shortDate(ipo.close_date)}`) : null;
      const parts = [`${name} IPO open`, closes, band(ipo), gmp,
        ipo.subscription_total !== null ? `subscribed ${ipo.subscription_total.toFixed(2)}x` : null];
      lines.push({ rank: rank.open, date: ipo.close_date ?? "9999", item: { kind: "ipo", tag: "IPO OPEN", text: parts.filter(Boolean).join(" · "), href, tone: "up", external: false } });
    } else if (status === "closed" && (!ipo.listing_date || ipo.listing_date >= today)) {
      const parts = [ipo.listing_date ? `${name} lists ${shortDate(ipo.listing_date)}` : `${name} IPO closed, listing awaited`, gmp,
        ipo.subscription_total !== null ? `subscribed ${ipo.subscription_total.toFixed(2)}x` : null];
      lines.push({ rank: rank.closed, date: ipo.listing_date ?? "", item: { kind: "ipo", tag: "LISTING", text: parts.filter(Boolean).join(" · "), href, tone: "neutral", external: false } });
    } else if (status === "upcoming" && ipo.open_date && ipo.open_date <= addDays(today, UPCOMING_DAYS)) {
      const parts = [`${name} IPO opens ${shortDate(ipo.open_date)}`, band(ipo), gmp];
      lines.push({ rank: rank.upcoming, date: ipo.open_date, item: { kind: "ipo", tag: "UPCOMING IPO", text: parts.filter(Boolean).join(" · "), href, tone: "neutral", external: false } });
    } else if (status === "listed" && ipo.listing_date && ipo.listing_date >= addDays(today, -LISTED_DAYS) && ipo.listing_gain_pct !== null) {
      lines.push({
        rank: rank.listed, date: ipo.listing_date,
        item: { kind: "ipo", tag: "LISTED", text: `${name} listed ${signedPct(ipo.listing_gain_pct)} over issue price`, href, tone: ipo.listing_gain_pct >= 0 ? "up" : "down", external: false },
      });
    }
  }
  return lines.sort((a, b) => a.rank - b.rank || a.date.localeCompare(b.date)).map((l) => l.item);
}

/** The three biggest gainers and losers among large companies. */
export function moverItems(stocks: TickerStock[]): TickerItem[] {
  const big = stocks.filter((s) => s.market_cap >= MOVER_MIN_CAP && s.price > 0 && Number.isFinite(s.change_pct) && s.change_pct !== 0);
  const line = (s: TickerStock, kind: "gainer" | "loser"): TickerItem => ({
    kind, tag: kind === "gainer" ? "TOP GAINER" : "TOP LOSER",
    text: `${s.symbol} ${rupees(s.price)} ${signedPct(s.change_pct)}`,
    href: `/stock/${encodeURIComponent(s.symbol)}`, tone: kind === "gainer" ? "up" : "down", external: false,
  });
  const gainers = big.filter((s) => s.change_pct > 0).sort((a, b) => b.change_pct - a.change_pct).slice(0, 3).map((s) => line(s, "gainer"));
  const losers = big.filter((s) => s.change_pct < 0).sort((a, b) => a.change_pct - b.change_pct).slice(0, 3).map((s) => line(s, "loser"));
  return [...gainers, ...losers];
}

/** Market headlines, each credited to its publisher. */
export function newsItems(news: NewsItem[], limit = 6): TickerItem[] {
  return news.slice(0, limit).map((n) => ({
    kind: "news", tag: n.source ? `NEWS · ${clip(n.source, 24)}` : "NEWS", text: clip(n.title, 120),
    href: /^https:\/\//.test(n.url) ? n.url : null, tone: "neutral", external: true,
  }));
}

type SymbolOf = (company: string) => string | null;

/**
 * A company name as NSE files it ("Infosys Limited") resolved to a tracked
 * symbol, so a ticker line can open that stock's page. Exact on the
 * normalised name, or a prefix for names long enough not to collide
 * ("Mahindra & Mahindra Financial" for "... Financial Services Limited").
 */
export function symbolResolver(universe: { symbol: string; name: string }[]): SymbolOf {
  const keys = universe.map((u) => ({ symbol: u.symbol, key: ipoMatchKey(u.name) })).filter((u) => u.key.length > 0);
  const exact = new Map(keys.map((k) => [k.key, k.symbol]));
  return (company) => {
    const key = ipoMatchKey(company);
    if (!key) return null;
    return exact.get(key) ?? keys.find((k) => k.key.length >= 10 && key.startsWith(k.key))?.symbol ?? null;
  };
}

const stockHref = (symbol: string | null) => (symbol ? `/stock/${encodeURIComponent(symbol)}` : null);

/**
 * Dividends, splits and bonuses going ex in the next ten days, soonest first
 * and tracked companies ahead of the rest on the same day.
 */
export function exDateItems(actions: TickerExDate[], symbolOf: SymbolOf, today = istDate(), limit = 5): TickerItem[] {
  const horizon = addDays(today, UPCOMING_DAYS);
  return actions
    .filter((a) => a.purpose && a.ex_date >= today && a.ex_date <= horizon)
    .map((a) => ({ a, symbol: symbolOf(a.company) }))
    .sort((x, y) => x.a.ex_date.localeCompare(y.a.ex_date) || Number(!x.symbol) - Number(!y.symbol))
    .slice(0, limit)
    .map(({ a, symbol }) => ({
      kind: "ex_date" as const, tag: a.ex_date === today ? "EX-DATE TODAY" : `EX-DATE ${shortDate(a.ex_date).toUpperCase()}`,
      text: `${cleanName(a.company)}: ${clip(a.purpose!, 80)}`, href: stockHref(symbol), tone: "neutral" as const, external: false,
    }));
}

/** Filings that move a stock; "General Updates" and newspaper copies are left out. */
const MATERIAL = /result|dividend|bonus|split|buy ?back|acqui|merger|amalgam|order|award|contract|fund ?rais|outcome of board|credit rating|allotment|resign|appoint|joint venture|expansion|capacity|launch/i;

/** The latest material company announcements filed with NSE, tracked companies first. */
export function announcementItems(rows: TickerAnnouncement[], symbolOf: SymbolOf, limit = 5): TickerItem[] {
  const material = rows
    .filter((r) => r.subject && MATERIAL.test(r.subject) && /^https:\/\//.test(r.attachment_url))
    .map((r) => ({ r, symbol: symbolOf(r.company) }));
  return [...material.filter((m) => m.symbol), ...material.filter((m) => !m.symbol)]
    .slice(0, limit)
    .map(({ r }) => ({
      kind: "announcement" as const, tag: "NSE FILING", text: `${cleanName(r.company)}: ${clip(r.subject!.replace(/\s*-\s*XBRL$/i, ""), 90)}`,
      href: r.attachment_url, tone: "neutral" as const, external: true,
    }));
}

/** One from each group in turn, so the ticker alternates IPOs, movers, news and filings. */
export function interleave(groups: TickerItem[][]): TickerItem[] {
  const out: TickerItem[] = [];
  const longest = Math.max(0, ...groups.map((g) => g.length));
  for (let i = 0; i < longest; i++) for (const g of groups) if (g[i]) out.push(g[i]);
  return out;
}

/** The ticker's headline search: today's Indian market news. */
export const MARKET_NEWS_QUERY = '(Sensex OR Nifty OR "Dalal Street" OR "Indian stock market") when:1d';

/** World markets' last close and day change, from the latest two closes per ticker. */
export function globalItems(bars: { ticker: string; name: string; trade_date: string; close: number }[]): TickerItem[] {
  const byTicker = new Map<string, typeof bars>();
  for (const b of bars) byTicker.set(b.ticker, [...(byTicker.get(b.ticker) ?? []), b]);
  return [...byTicker.values()].flatMap((series) => {
    const sorted = [...series].sort((a, b) => a.trade_date.localeCompare(b.trade_date));
    const last = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    if (!last || !prev || prev.close <= 0) return [];
    const change = (last.close / prev.close - 1) * 100;
    return [{
      kind: "global" as const, tag: "GLOBAL",
      text: `${last.name} ${last.close.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${signedPct(change)}`,
      href: "/market-pulse#global", tone: change >= 0 ? "up" as const : "down" as const, external: false,
    }];
  });
}
