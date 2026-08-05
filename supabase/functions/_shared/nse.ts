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

export type CorporateAction = {
  symbol: string;
  exDate: string;
  recordDate: string | null;
  actionType: string;
  value: number | null;
  description: string;
};

/**
 * Classify a free-text purpose into every type it mentions. NSE writes these
 * as prose, and a single record routinely announces more than one action
 * ("Interim Dividend Rs 5 Per Share and Bonus Issue 1:1") — an if-chain that
 * returns on the first keyword hit would silently drop the rest. The raw
 * text is kept in `description`; only the coarse type(s) are derived here.
 * An unrecognised purpose becomes `["other"]` rather than being forced into
 * a category it may not belong to, and "other" is never mixed in alongside
 * a real type.
 *
 * Known limitation: these are plain substring keyword checks, so a handful
 * of phrasings can false-positive (e.g. "Change in Rights of Shareholders"
 * -> `rights`, "Bonus Debentures" -> `bonus`). Left as-is deliberately: a
 * missed real action (false negative) is worse than an extra wrong row
 * (false positive), and tightening the keywords risks the former without
 * concrete evidence of which real NSE filings actually collide.
 */
export function classifyActions(purpose: string): string[] {
  const p = purpose.toLowerCase();
  const types: string[] = [];
  if (p.includes("dividend")) types.push("dividend");
  if (p.includes("bonus")) types.push("bonus");
  if (p.includes("split")) types.push("split");
  if (p.includes("rights")) types.push("rights");
  if (p.includes("buy back") || p.includes("buyback")) types.push("buyback");
  return types.length ? types : ["other"];
}

// Matches "... from Rs 10/- to Rs 2 ..." (and the Rs./Re./INR, "/-", and
// extra-whitespace variants NSE uses) to pull out the resulting figure.
// "re" is included alongside "rs" because NSE writes the singular rupee as
// "Re.1" / "Re 1" (grammatically correct for one rupee), not "Rs.1" — and
// the 10 -> 1 face-value split, the most common split in India, is filed
// exactly that way. Both alternations (the "from" side and the "to" side)
// need it: either side of a split can land on a single rupee.
const FROM_TO_VALUE =
  /from\s+(?:rs\.?|re\.?|inr)\s*[\d,]+(?:\.\d+)?(?:\s*\/-)?\s+to\s+(?:rs\.?|re\.?|inr)\s*([\d,]+(?:\.\d+)?)(?:\s*\/-)?/i;

// A bare rupee figure, e.g. "Rs 1,250 Per Share" or "Rs.5.50". Indian
// filings group thousands with commas (and sometimes lakh/crore-style
// irregular grouping, e.g. "12,50,000"), so commas are accepted in the
// digit run and stripped before Number() — [\d.]+ alone would stop at the
// first comma and silently truncate the amount.
const BARE_VALUE = /(?:rs\.?|inr)\s*([\d,]+(?:\.\d+)?)/i;

/**
 * Pull the rupee figure out of a purpose string.
 *
 * When the purpose uses "from X to Y" phrasing (a face value split, e.g.
 * "Face Value Split from Rs 10 to Rs 2"), the resulting ("to") figure is
 * returned rather than the pre-split face value — otherwise the pre-split
 * value would be stored next to `action_type` as if it were the outcome.
 * For every other purpose, the first rupee figure found is returned, as
 * before. Null when no figure is present.
 *
 * Limitation: this extracts one value per purpose STRING, not per detected
 * action type. A genuinely combined purpose ("dividend AND split") still
 * yields only one number here — `fetchCorporateActions` is responsible for
 * deciding which of the emitted rows that number actually belongs to (see
 * `ownerTypeFor` there); this function only finds the figure.
 */
export function extractActionValue(purpose: string): number | null {
  const fromTo = FROM_TO_VALUE.exec(purpose);
  if (fromTo) {
    const n = Number(fromTo[1].replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  const m = BARE_VALUE.exec(purpose);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Decide which single action type an extracted value actually belongs to,
 * so `fetchCorporateActions` can put the figure on that row and `null` on
 * every other row emitted from the same purpose string.
 *
 * Attribution rule (deliberately narrow — see the module-level fail-closed
 * precedent in `_shared/ratios.ts`):
 *  - A "from X to Y" figure (matched by `FROM_TO_VALUE`) is a resulting face
 *    value, so it belongs to `split` only.
 *  - A bare "Rs N Per Share" figure (matched by `BARE_VALUE`, and not a
 *    from-to match) is a rupees-per-share amount, so it belongs to
 *    `dividend` only.
 *  - Anything else — a type this purpose also mentions but that the figure
 *    was not extracted for (bonus, rights, buyback, other, or a second
 *    dividend/split of the same purpose) — gets `null`. Guessing which of
 *    several announced actions a lone number belongs to would put a wrong
 *    number next to `action_type`; an absent value is the honest answer
 *    when attribution isn't certain.
 */
function ownerTypeFor(purpose: string): "split" | "dividend" | null {
  if (FROM_TO_VALUE.test(purpose)) return "split";
  if (BARE_VALUE.test(purpose)) return "dividend";
  return null;
}

export async function fetchCorporateActions(symbol: string): Promise<CorporateAction[]> {
  const url =
    `https://www.nseindia.com/api/corporates-corporateActions` +
    `?index=equities&symbol=${encodeURIComponent(symbol)}`;
  const rows = (await nseGet(url)) as Array<Record<string, string>>;
  if (!Array.isArray(rows)) return [];

  return rows.flatMap((r) => {
    const exDate = toIsoDate(r.exDate ?? "");
    const purpose = r.subject ?? r.purpose ?? "";
    if (!exDate || !purpose) return [];
    const recordDate = toIsoDate(r.recDate ?? "");
    const value = extractActionValue(purpose);
    // The figure belongs to exactly one type per purpose (see `ownerTypeFor`);
    // every other row emitted for this purpose gets `value: null` rather than
    // borrowing a figure that was never extracted for it.
    const ownerType = value === null ? null : ownerTypeFor(purpose);
    // One CorporateAction per detected type, not per registry row: the
    // corporate_actions unique key is (symbol, ex_date, action_type,
    // description), so a purpose announcing several actions at once emits
    // several rows sharing the same description instead of collapsing to
    // whichever type happened to be checked first.
    return classifyActions(purpose).map((actionType) => ({
      symbol,
      exDate,
      recordDate,
      actionType,
      value: actionType === ownerType ? value : null,
      description: purpose,
    }));
  });
}
