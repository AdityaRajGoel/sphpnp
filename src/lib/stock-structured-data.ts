/**
 * FAQ and Dataset markup for a stock page.
 *
 * Both describe what the page already shows. An answer is built ONLY from a
 * value that is present: a question about a P/E we do not have would either
 * state a number nobody measured or answer "not available", and neither belongs
 * in markup that search and answer engines quote as fact.
 *
 * Every answer carries the figure's own as-of date. A quoted price with no date
 * reads as current forever, which is the failure mode that matters here.
 */
import type { StockHeader } from "@/hooks/useStockFundamentals";

export type FaqItem = { question: string; answer: string };

const rupees = (value: number, fractionDigits = 2) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: fractionDigits }).format(value);

const onDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso)) : null;

/** Crore, as screener_stocks stores it, written the way an Indian reader expects. */
const crore = (value: number) =>
  value >= 100_000 ? `₹${(value / 100_000).toFixed(2)} lakh crore` : `₹${new Intl.NumberFormat("en-IN").format(Math.round(value))} crore`;

export function stockFaqItems(header: StockHeader | null): FaqItem[] {
  if (!header) return [];
  const { name, symbol } = header;
  const asOf = onDate(header.updated_at);
  const suffix = asOf ? ` (NSE, as of ${asOf})` : " (NSE)";
  const items: FaqItem[] = [];

  if (header.price !== null) {
    const move = header.change_pct === null
      ? ""
      : ` The last session moved it ${header.change_pct >= 0 ? "up" : "down"} ${Math.abs(header.change_pct).toFixed(2)}%.`;
    items.push({
      question: `What is the share price of ${name} (${symbol})?`,
      answer: `${name} last traded at ${rupees(header.price)}${suffix}.${move}`,
    });
  }

  if (header.market_cap !== null && header.market_cap > 0) {
    items.push({
      question: `What is the market capitalisation of ${name}?`,
      answer: `${name} is valued at about ${crore(header.market_cap)}${suffix}.`,
    });
  }

  if (header.pe !== null) {
    items.push({
      question: `What is the P/E ratio of ${symbol}?`,
      answer: `${name} trades at a price-to-earnings ratio of ${header.pe.toFixed(2)}${suffix}. The P/E compares the share price with earnings per share, so it is only comparable between companies in the same industry.`,
    });
  }

  if (header.high_52 !== null && header.low_52 !== null) {
    const position = header.price !== null && header.high_52 > header.low_52
      ? ` It is currently ${(((header.price - header.low_52) / (header.high_52 - header.low_52)) * 100).toFixed(0)}% of the way up that range.`
      : "";
    items.push({
      question: `What is the 52-week high and low of ${symbol}?`,
      answer: `${name} has traded between ${rupees(header.low_52)} and ${rupees(header.high_52)} over the past 52 weeks${asOf ? `, to ${asOf}` : ""}.${position}`,
    });
  }

  if (header.sector) {
    items.push({
      question: `Which sector does ${name} belong to?`,
      answer: `${name} (${symbol}) is classified under ${header.sector} on this site's screener.`,
    });
  }

  return items;
}

/**
 * Dataset markup for the figures on the page, so an answer engine can cite the
 * series rather than scrape a number out of the prose. Only measures the page
 * actually carries are listed.
 */
export function stockDataset(header: StockHeader | null): Record<string, unknown> | null {
  if (!header) return null;
  const { name, symbol } = header;
  const measures = [
    "Share price",
    header.market_cap !== null ? "Market capitalisation" : null,
    header.pe !== null ? "Price to earnings ratio" : null,
    header.high_52 !== null ? "52-week high and low" : null,
    "Quarterly revenue and profit",
    "Corporate actions",
  ].filter((m): m is string => m !== null);

  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${name} (${symbol}) share price and quarterly financials`,
    description: `End-of-day price, valuation ratios and quarterly results for ${name} (NSE: ${symbol}), compiled from exchange filings and end-of-day exchange data.`,
    url: `https://www.sphpnp.com/stock/${symbol}`,
    identifier: symbol,
    isAccessibleForFree: true,
    creditText: "Shri Parasram Holdings Pvt. Ltd.",
    creator: { "@type": "Organization", name: "Shri Parasram Holdings Panipat", url: "https://www.sphpnp.com" },
    ...(header.updated_at ? { dateModified: header.updated_at.slice(0, 10) } : {}),
    variableMeasured: measures,
    measurementTechnique: "End-of-day exchange data and company filings",
    license: "https://www.sphpnp.com/terms",
  };
}
