/**
 * FAQ and Dataset markup for one IPO page.
 *
 * The questions are the ones people actually ask an assistant about an issue -
 * price band, dates, lot size, minimum investment, listing gain - and each is
 * answered only where the catalogue has the figure. An issue that has not
 * listed gets no listing answer rather than an empty one.
 */
import type { Ipo } from "@/lib/ipo";
import { formatDate, formatRupees } from "@/lib/ipo";

export type FaqItem = { question: string; answer: string };

const band = (ipo: Ipo) => {
  const { price_band_min: lo, price_band_max: hi } = ipo;
  if (lo === null && hi === null) return null;
  if (lo !== null && hi !== null && lo !== hi) return `${formatRupees(lo)} to ${formatRupees(hi)}`;
  return formatRupees(hi ?? lo);
};

export function ipoFaqItems(ipo: Ipo | null): FaqItem[] {
  if (!ipo) return [];
  const items: FaqItem[] = [];
  const priceBand = band(ipo);

  if (priceBand) {
    items.push({
      question: `What is the price band of the ${ipo.name} IPO?`,
      answer: `The ${ipo.name} ${ipo.type} IPO is priced at ${priceBand} per share${ipo.issue_size_crore !== null ? `, for an issue size of ₹${ipo.issue_size_crore} crore` : ""}.`,
    });
  }

  if (ipo.open_date || ipo.close_date) {
    items.push({
      question: `When does the ${ipo.name} IPO open and close?`,
      answer: `The issue opens on ${formatDate(ipo.open_date)} and closes on ${formatDate(ipo.close_date)}${ipo.listing_date ? `, with listing expected on ${formatDate(ipo.listing_date)}` : ""}.`,
    });
  }

  if (ipo.lot_size !== null) {
    const atTop = ipo.price_band_max ?? ipo.price_band_min;
    const cost = atTop !== null ? ` At the upper band that is ${formatRupees(ipo.lot_size * atTop)} for one lot.` : "";
    items.push({
      question: `What is the lot size of the ${ipo.name} IPO?`,
      answer: `One lot is ${ipo.lot_size} shares, and applications must be in multiples of a lot.${cost}`,
    });
  }

  const subs = [
    ipo.subscription_qib !== null ? `QIB ${ipo.subscription_qib}x` : null,
    ipo.subscription_nii !== null ? `NII ${ipo.subscription_nii}x` : null,
    ipo.subscription_retail !== null ? `retail ${ipo.subscription_retail}x` : null,
  ].filter(Boolean);
  if (subs.length > 0) {
    items.push({
      question: `How much was the ${ipo.name} IPO subscribed?`,
      answer: `Latest recorded subscription: ${subs.join(", ")} (as of ${formatDate(ipo.data_as_of?.slice(0, 10) ?? null)}).`,
    });
  }

  if (ipo.listing_price !== null) {
    const gain = ipo.listing_gain_pct !== null
      ? ` That was a ${ipo.listing_gain_pct >= 0 ? "gain" : "loss"} of ${Math.abs(ipo.listing_gain_pct).toFixed(2)}% against the issue price.`
      : "";
    items.push({
      question: `What was the listing price of ${ipo.name}?`,
      answer: `${ipo.name} listed at ${formatRupees(ipo.listing_price)} on ${formatDate(ipo.listing_date)}.${gain}`,
    });
  }

  return items;
}

/** Dataset markup for the issue's own record: dates, band, subscription, listing. */
export function ipoDataset(ipo: Ipo | null): Record<string, unknown> | null {
  if (!ipo) return null;
  const measures = [
    "Price band",
    "Issue size",
    ipo.lot_size !== null ? "Lot size" : null,
    ipo.subscription_retail !== null ? "Subscription by category" : null,
    ipo.listing_price !== null ? "Listing price and listing gain" : null,
    "Grey market premium history",
  ].filter((m): m is string => m !== null);

  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${ipo.name} IPO: dates, price band and subscription`,
    description: `Issue dates, price band, lot size, subscription by category and listing performance for the ${ipo.name} ${ipo.type} IPO, with recorded grey market premium observations.`,
    url: `https://www.sphpnp.com/ipo/${ipo.slug}`,
    identifier: ipo.slug,
    isAccessibleForFree: true,
    creditText: "Shri Parasram Holdings Pvt. Ltd.",
    creator: { "@type": "Organization", name: "Shri Parasram Holdings Panipat", url: "https://www.sphpnp.com" },
    ...(ipo.data_as_of ? { dateModified: ipo.data_as_of.slice(0, 10) } : {}),
    ...(ipo.open_date && ipo.close_date ? { temporalCoverage: `${ipo.open_date}/${ipo.close_date}` } : {}),
    variableMeasured: measures,
    license: "https://www.sphpnp.com/terms",
  };
}

const DESC_MIN = 110;
const DESC_MAX = 160;
const shortDate = (d: string | null) =>
  d ? new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : null;

/**
 * The page's meta description, built from the issue's own facts - band, lot,
 * dates or listing - rather than one sentence shared by every IPO page, which
 * ran 102-109 characters and said nothing a searcher could not guess. Kept in
 * the 110-160 window search results show in full.
 */
export function ipoMetaDescription(ipo: Ipo): string {
  const head = `${ipo.name} ${ipo.board === "sme" ? "SME" : "mainboard"} IPO`;
  const b = band(ipo);
  const lot = ipo.lot_size ? `lot of ${ipo.lot_size.toLocaleString("en-IN")} shares` : null;
  const open = shortDate(ipo.open_date);
  const close = shortDate(ipo.close_date);
  const listedOn = ipo.status === "listed" ? shortDate(ipo.listing_date) : null;
  const gain = ipo.listing_gain_pct;
  const timing = listedOn
    ? `listed ${listedOn}${gain !== null ? ` at ${gain >= 0 ? "+" : ""}${gain.toFixed(1)}% vs issue` : ""}`
    : open && close ? `bidding ${open} to ${close}` : null;
  const facts = [b && `price band ${b}`, lot, timing].filter(Boolean);

  let s = facts.length ? `${head}: ${facts.join(", ")}.` : `${head}: dates, price band and lot size.`;
  for (const tail of ["GMP history, subscription and allotment details.", "Information only, not advice.", "Tracked by Parasram India."]) {
    if (s.length >= DESC_MIN && tail !== "Information only, not advice.") continue;
    if (`${s} ${tail}`.length <= DESC_MAX) s = `${s} ${tail}`;
  }
  return s.length > DESC_MAX ? `${s.slice(0, DESC_MAX - 1).replace(/[\s,;:]+\S*$/, "")}…` : s;
}
