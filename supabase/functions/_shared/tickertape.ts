// A stock's page on Tickertape (www.tickertape.in/stocks/<slug>), read from the
// JSON the page embeds for its own rendering (__NEXT_DATA__). What it adds to
// the site: how many analysts cover the stock and what share say buy, the
// quarterly holding split with mutual funds and insurers broken out of "DII",
// the mutual funds holding the most of it, sector valuation for comparison,
// and Tickertape's scorecard tags.
//
// The page is found through Tickertape's search (api.tickertape.in/search),
// keyed on the NSE ticker, which returns the stock's sid and page slug.
//
// Pure: no fetch, no Deno APIs. sync-tickertape does the I/O.

export type TickertapeHolding = {
  date: string; promoter: number | null; fii: number | null; dii: number | null;
  mutual_funds: number | null; insurance: number | null; other_dii: number | null;
  retail: number | null; others: number | null;
};
export type TickertapeFund = { name: string; url: string | null; pct_of_company: number | null; weight_in_fund: number | null; change_3m: number | null };
export type TickertapeScore = { name: string; tag: string; description: string | null; tone: "good" | "bad" | "neutral" };

export type TickertapeStock = {
  sid: string;
  /** The NSE ticker the page is for - checked against the stock before anything is stored. */
  ticker: string | null;
  url: string | null;
  analysts: { total: number; buy_pct: number } | null;
  holdings: TickertapeHolding[];
  top_funds: TickertapeFund[];
  scorecard: TickertapeScore[];
  sector: { name: string | null; pe: number | null; pb: number | null; dividend_yield: number | null };
  beta: number | null;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const round = (v: number | null, digits = 2) => (v === null ? null : Number(v.toFixed(digits)));
const pageUrl = (slug: string | null) => (slug && /^\/[\w/-]+$/.test(slug) ? `https://www.tickertape.in${slug}` : null);

/** The sid and page of the stock Tickertape lists under exactly this NSE ticker. */
export function pickTickertapeStock(search: unknown, symbol: string): { sid: string; slug: string } | null {
  const stocks = isRecord(search) && isRecord(search.data) && Array.isArray(search.data.stocks) ? search.data.stocks : [];
  const hit = stocks.filter(isRecord).find((s) => s.ticker === symbol);
  const sid = str(hit?.sid);
  const slug = str(hit?.slug);
  return sid && slug ? { sid, slug } : null;
}

/** A company name as Tickertape slugs it: "Mahindra & Mahindra Ltd" -> "mahindra-and-mahindra". */
export function nameSlug(name: string): string {
  return name.toLowerCase().replace(/&/g, " and ").replace(/\b(limited|ltd)\b\.?/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Words that do not tell one company from another. */
const FILLER = new Set(["the", "ltd", "limited", "co", "company", "india", "inds", "industries", "corp", "corporation", "and", "of", "partly", "paidup"]);

const nameWords = (name: string): string[] =>
  name.toLowerCase().replace(/&/g, " and ").replace(/['.]/g, "").replace(/\([^)]*\)/g, " ")
    .split(/[^a-z0-9]+/).filter((w) => w && !FILLER.has(w));

/** Shared words, a 4-letter stem counting half, and the first word's lead: 0 when the first words differ. */
function nameScore(a: string[], b: string[]): number {
  const stem = (w: string) => w.slice(0, 4);
  if (!a.length || !b.length || stem(a[0]) !== stem(b[0])) return 0;
  const shared = a.reduce((sum, w) => sum + (b.includes(w) ? 2 : w.length >= 4 && b.some((x) => x.startsWith(stem(w))) ? 1 : 0), 0);
  return (shared + 2) / (a.length + b.length);
}

/** A guess must share the first word and most of the rest ("Ajanta Pharmaceuticals" -> "ajanta-pharma"). */
const GUESS_MIN_SCORE = 0.75;

/**
 * Stock pages in Tickertape's sitemap whose name part is this company's name,
 * or starts with it ("mahindra-and-mahindra-financial" finds
 * "...-financial-services-MMFS") - exact matches first, then the shortest.
 * With none, the closest names by shared words: Tickertape keeps old or shorter
 * names ("pvr" for PVR INOX, "titagarh-wagons" for Titagarh Rail Systems), and
 * 74 stocks went unmatched in Oct 2026. Only candidates: the page's own ticker
 * decides, so a wrong guess costs a fetch, never a wrong profile.
 */
export function sitemapCandidates(xml: string, companyName: string, limit = 3): string[] {
  const want = nameSlug(companyName);
  if (!want) return [];
  const pages = [...xml.matchAll(/<loc>https:\/\/www\.tickertape\.in(\/stocks\/[a-z0-9-]+-[A-Za-z0-9]+)<\/loc>/g)]
    .map(([, path]) => ({ path, namePart: path.slice("/stocks/".length).replace(/-[A-Za-z0-9]+$/, "") }));
  const hits = pages
    .filter((p) => p.namePart === want || p.namePart.startsWith(`${want}-`))
    .sort((a, b) => Number(b.namePart === want) - Number(a.namePart === want) || a.namePart.length - b.namePart.length);
  if (hits.length) return hits.slice(0, limit).map((h) => h.path);
  const words = nameWords(companyName);
  return pages
    .map((p) => ({ path: p.path, score: nameScore(words, nameWords(p.namePart.replace(/-/g, " "))) }))
    .filter((p) => p.score >= GUESS_MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((p) => p.path);
}

/** The page's embedded render data, or null when the page has none. */
export function nextData(html: string): Record<string, unknown> | null {
  const json = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return isRecord(parsed) && isRecord(parsed.props) && isRecord(parsed.props.pageProps) ? parsed.props.pageProps : null;
  } catch {
    return null;
  }
}

const TONE: Record<string, TickertapeScore["tone"]> = { green: "good", red: "bad" };

export function parseTickertape(pageProps: Record<string, unknown>): TickertapeStock | null {
  const info = isRecord(pageProps.securityInfo) ? pageProps.securityInfo : {};
  const sid = str(pageProps.sid) ?? str(info.sid);
  if (!sid) return null;
  const ratios = isRecord(info.ratios) ? info.ratios : {};
  const summary = isRecord(pageProps.securitySummary) ? pageProps.securitySummary : {};

  const forecast = isRecord(summary.forecast) ? summary.forecast : {};
  const total = num(forecast.totalReco);
  const buy = num(forecast.percBuyReco);

  const holdingRows = isRecord(summary.holdings) && Array.isArray(summary.holdings.holdings) ? summary.holdings.holdings : [];
  const holdings = holdingRows.filter(isRecord).flatMap((h) => {
    const date = str(h.date)?.slice(0, 10);
    const d = isRecord(h.data) ? h.data : null;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !d) return [];
    const pct = (key: string) => round(num(d[key]));
    return [{
      date, promoter: pct("pmPctT"), fii: pct("fiPctT"), dii: pct("diPctT"), mutual_funds: pct("mfPctT"),
      insurance: pct("isPctT"), other_dii: pct("othExInsDiPctT"), retail: pct("rhPctT"), others: pct("othPctT"),
    }];
  }).sort((a, b) => a.date.localeCompare(b.date));

  const funds = (Array.isArray(summary.mfHoldings) ? summary.mfHoldings : []).filter(isRecord).flatMap((f) => {
    const meta = isRecord(f.meta) ? f.meta : {};
    const name = str(meta.name) ?? str(meta.fullName);
    if (!name) return [];
    return [{
      name, url: pageUrl(str(meta.slug)),
      pct_of_company: round(num(f.marketCapPct), 3), weight_in_fund: round(num(f.weight)), change_3m: round(num(f.change3m), 3),
    }];
  });

  const scorecard = (Array.isArray(pageProps.scorecard) ? pageProps.scorecard : []).filter(isRecord).flatMap((s) => {
    const name = str(s.name);
    const tag = str(s.tag);
    return name && tag ? [{ name, tag, description: str(s.description), tone: TONE[str(s.colour) ?? ""] ?? "neutral" }] : [];
  });

  const gic = isRecord(info.gic) ? info.gic : {};
  const infoBlock = isRecord(info.info) ? info.info : {};
  return {
    sid,
    ticker: str(infoBlock.ticker),
    url: pageUrl(str(info.slug)),
    analysts: total !== null && total > 0 && buy !== null ? { total, buy_pct: Math.round(buy * 10) / 10 } : null,
    holdings,
    top_funds: funds,
    scorecard,
    sector: { name: str(gic.industry) ?? str(infoBlock.sector), pe: round(num(ratios.indpe)), pb: round(num(ratios.indpb)), dividend_yield: round(num(ratios.inddy)) },
    beta: round(num(ratios.beta)),
  };
}
