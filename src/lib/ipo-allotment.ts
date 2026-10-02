import { isWebUrl, type Ipo } from "@/lib/ipo";

export type CheckLink = { label: string; url: string };

/** Where any applicant can check an allotment by PAN or application number. Checked 29 Sep 2026. */
export const EXCHANGE_ALLOTMENT_CHECKS: CheckLink[] = [
  { label: "BSE", url: "https://www.bseindia.com/investors/appli_check" },
  { label: "NSE", url: "https://www.nseindia.com/invest/check-trades-bids-verify-ipo-bids" },
];

/**
 * Each registrar's allotment page, as the issue pages in our catalogue link it
 * (every registrar in the ipos table, 29 Sep 2026). Only a fallback: an issue's
 * own "allotment" document wins when the sync has read one.
 */
const REGISTRAR_PAGES: [RegExp, string][] = [
  [/kfin/i, "https://ipostatus.kfintech.com/"],
  [/mufg|link\s*intime/i, "https://in.mpms.mufg.com/Initial_Offer/public-issues.html"],
  [/bigshare/i, "https://ipo.bigshareonline.com/IPO_Status.html"],
  [/maashitla/i, "https://maashitla.com/allotment-status/public-issues"],
  [/skyline/i, "https://www.skylinerta.com/ipo.php"],
  [/cameo/i, "https://ipo.cameoindia.com/"],
  [/purva/i, "https://www.purvashare.com/investor-service/ipo-query"],
  [/integrated registry/i, "https://www.integratedregistry.in/RegistrarsToSTA.aspx?OD=1"],
  [/mudra/i, "https://mudrarta.com/"],
  [/mas services/i, "https://www.masserv.com/opt.asp"],
  [/alankit/i, "http://ipo.alankit.com/"],
  [/abhipra/i, "https://www.abhipra.com/"],
];

type AllotmentFields = Pick<Ipo, "registrar" | "documents" | "allotment_date" | "refund_date" | "credit_date" | "listing_date">;

export function allotmentChecks(ipo: AllotmentFields): { registrar: { name: string; url: string | null } | null; exchanges: CheckLink[] } {
  const own = ipo.documents?.find((d) => d.kind === "allotment")?.url;
  const fallback = ipo.registrar ? REGISTRAR_PAGES.find(([match]) => match.test(ipo.registrar ?? ""))?.[1] : undefined;
  const url = own && isWebUrl(own) ? own : fallback ?? null;
  return {
    registrar: ipo.registrar ? { name: ipo.registrar, url } : null,
    exchanges: EXCHANGE_ALLOTMENT_CHECKS,
  };
}

export type AllotmentStep = { label: string; date: string; done: boolean };

/** The post-issue dates in order; `today` is an IST YYYY-MM-DD, and a step dated today counts as done. */
export function allotmentSteps(ipo: AllotmentFields, today: string): AllotmentStep[] {
  const steps: [string, string | null][] = [
    ["Allotment finalised", ipo.allotment_date],
    ["Refunds start", ipo.refund_date],
    ["Shares credited to demat", ipo.credit_date],
    ["Listing", ipo.listing_date],
  ];
  return steps.flatMap(([label, date]) => (date ? [{ label, date, done: date <= today }] : []));
}
