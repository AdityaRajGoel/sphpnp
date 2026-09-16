// Fetches the feeds the edge runtime provably cannot reach, from the VPS host, and
// hands them to sync-market-data for parsing and writing.
//
// Why this exists: NSDL (FPI flows) and api.bseindia.com (results calendar) answer the
// edge container with "error sending request for url (...)" - the failures are in
// /var/log/sphpnp-sync/*.log - while the exact same requests from the host answer 200
// (measured 2026-09-16: NSDL 59,702 bytes, BSE 2,789 bytes, NSE 8,941 bytes). The host
// has ordinary outbound connectivity; the container's egress path does not.
//
// The split matches scripts/ipo-browser-scrape.mts: this script only fetches and POSTs
// the payload. Parsing (parseFpiDaily, parseNseEventCalendar, parseBseResultsCalendar)
// and the upserts stay in the edge function, so there is one write path and one set of
// parsers with tests, never a re-implementation here.
//
// Politeness: three requests, one at a time, spaced out, with a descriptive User-Agent
// that names the crawler and a contact URL. These are public, server-rendered pages.

const SYNC_URL = process.env.SYNC_URL ?? "http://127.0.0.1:8000/functions/v1/sync-market-data";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const SYNC_SECRET = process.env.MARKET_SYNC_SECRET ?? "";

// NSDL serves an ordinary page and gets the descriptive crawler suffix. The two
// exchange JSON APIs do not: BSE answered 403 to the suffixed string and 200 to a plain
// Chrome one (measured 2026-09-16), which is the same WAF behaviour _shared/nse.ts
// documents. Identifying ourselves is preferred wherever it is actually accepted.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/148.0.0.0 Safari/537.36 sphpnp-market-monitor/1.0 (+https://www.sphpnp.com)";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/148.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 30_000;
const DELAY_BETWEEN_FETCHES_MS = 1_500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Fetched = { ok: true; body: string } | { ok: false; error: string };

async function get(url: string, headers: Record<string, string> = {}): Promise<Fetched> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "*/*", ...headers },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const body = await res.text();
    if (body.length < 200) return { ok: false, error: `body too short (${body.length} bytes)` };
    return { ok: true, body };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function post(payload: Record<string, unknown>): Promise<string> {
  const res = await fetch(SYNC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
      "x-sync-secret": SYNC_SECRET,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120_000),
  });
  return `${res.status} ${(await res.text()).slice(0, 300)}`;
}

// --- FPI daily flows (NSDL) -------------------------------------------------
const fpi = await get("https://www.fpi.nsdl.co.in/web/Reports/Latest.aspx");
if (fpi.ok) {
  console.log(`fpi: fetched ${fpi.body.length} bytes -> ${await post({ dataset: "fpi", html: fpi.body })}`);
} else {
  console.log(`fpi: fetch failed (${fpi.error}) - leaving it to the function's own fetch`);
}

await sleep(DELAY_BETWEEN_FETCHES_MS);

// --- Results calendar (NSE + BSE) -------------------------------------------
// NSE sets cookies on the home page before its API answers; a plain call gets a 401.
const nseCookies = await fetch("https://www.nseindia.com/", {
  headers: { "User-Agent": BROWSER_UA },
  signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
}).then((r) => r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ")).catch(() => "");

const nse = await get("https://www.nseindia.com/api/event-calendar", {
  "User-Agent": BROWSER_UA,
  Referer: "https://www.nseindia.com/companies-listing/corporate-filings-event-calendar",
  ...(nseCookies ? { Cookie: nseCookies } : {}),
});
await sleep(DELAY_BETWEEN_FETCHES_MS);
const bse = await get("https://api.bseindia.com/BseIndiaAPI/api/Corpforthresults/w", {
  "User-Agent": BROWSER_UA,
  Referer: "https://www.bseindia.com/",
  Accept: "application/json",
});

const calendar: Record<string, unknown> = { dataset: "calendar" };
const parseJson = (label: string, r: Fetched) => {
  if (!r.ok) { console.log(`${label}: fetch failed (${r.error}) - the function will try its own fetch`); return undefined; }
  try { return JSON.parse(r.body); } catch { console.log(`${label}: not JSON - the function will try its own fetch`); return undefined; }
};
const nseJson = parseJson("calendar/nse", nse);
const bseJson = parseJson("calendar/bse", bse);
if (nseJson !== undefined) calendar.nse = nseJson;
if (bseJson !== undefined) calendar.bse = bseJson;
console.log(`calendar: nse=${nseJson ? "host" : "function"} bse=${bseJson ? "host" : "function"} -> ${await post(calendar)}`);
