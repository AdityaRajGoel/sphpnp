/**
 * NSE HTTP access. These are the exchange's own public endpoints, not an API
 * product sold to us, so requests are serialised and deliberately unhurried.
 *
 * Failure policy matches sync-unlisted-quotes: a 4xx means the URL or our
 * access changed and asking again will not help, so it halts that symbol; a
 * 5xx is a blip and is retried once.
 */

export const NSE_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (compatible; sphpnp-fundamentals/1.0; +https://www.sphpnp.com)",
  Referer: "https://www.nseindia.com/",
  Accept: "application/json",
};

/** Delay between NSE requests, milliseconds. */
export const NSE_DELAY_MS = 1200;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type FilingRecord = {
  symbol: string;
  period: string;
  fromDate: string;
  toDate: string;
  isConsolidated: boolean;
  isAudited: boolean;
  xbrlUrl: string;
  filingDate: string | null;
};

/** "01-Oct-2024" as filed, to "2024-10-01" for Postgres. */
export function toIsoDate(indian: string): string | null {
  const m = /^(\d{2})-([A-Za-z]{3})-(\d{4})/.exec(indian?.trim() ?? "");
  if (!m) return null;
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  const mm = months[m[2]];
  return mm ? `${m[3]}-${mm}-${m[1]}` : null;
}

async function nseGet(url: string, asText = false): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { headers: NSE_HEADERS });
    if (res.ok) return asText ? await res.text() : await res.json();
    // 4xx will not improve on retry.
    if (res.status < 500) {
      throw new Error(`NSE ${res.status} for ${url}`);
    }
    if (attempt === 0) await sleep(3000);
    else throw new Error(`NSE ${res.status} after retry for ${url}`);
  }
  throw new Error(`unreachable: ${url}`);
}

export async function fetchFilingRegistry(symbol: string): Promise<FilingRecord[]> {
  const url =
    `https://www.nseindia.com/api/corporates-financial-results` +
    `?index=equities&symbol=${encodeURIComponent(symbol)}&period=Quarterly`;
  const rows = (await nseGet(url)) as Array<Record<string, string>>;
  if (!Array.isArray(rows)) return [];

  return rows.flatMap((r) => {
    const fromDate = toIsoDate(r.fromDate);
    const toDate = toIsoDate(r.toDate);
    // No XBRL means nothing to parse; no dates means nothing to key on.
    if (!r.xbrl || !fromDate || !toDate) return [];
    return [{
      symbol,
      period: r.period ?? "Quarterly",
      fromDate,
      toDate,
      // The document reports "Standalone" regardless, so this metadata field is
      // the only trustworthy source for the basis.
      isConsolidated: r.consolidated === "Consolidated",
      isAudited: r.audited === "Audited",
      xbrlUrl: r.xbrl,
      filingDate: r.filingDate ?? null,
    }];
  });
}

export async function fetchXbrl(url: string): Promise<string> {
  return (await nseGet(url, true)) as string;
}
