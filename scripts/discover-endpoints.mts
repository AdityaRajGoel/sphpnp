// Finds the JSON endpoints behind the exchange (NSE, BSE, MCX), IPO, fundamentals and
// market pages the syncs read, flags hosts no sync uses yet,
// and checks whether each one answers a plain fetch with no browser and no cookies.
//
// Several sources are scraped as rendered HTML (see the module comment in
// supabase/functions/sync-ipos/index.ts): InvestorGain and Chittorgarh ship an empty
// table and fill it from script, which is why ipo-browser-sync.yml runs a headless
// browser at all. If the script's own data call is reachable directly, the browser and
// the HTML parser can both be replaced by one fetch. This script measures that rather
// than guessing: it loads each page once in Chromium, records every JSON response the
// page itself requests (and a HAR of the visit for REA, morluto/rea, to analyse), then
// requests each JSON URL again from plain Node.
//
// Output (DISCOVERY_OUT, default ./endpoint-discovery): report.md, report.json and one
// HAR per page. Nothing is written anywhere else; no secrets are read.
//
//   node --experimental-strip-types scripts/discover-endpoints.mts
//   DISCOVERY_TARGETS='[{"name":"x","url":"http://localhost:8080/"}]' node ... (override)

import { chromium, type Response } from "@playwright/test";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Target = { name: string; url: string; kind: "ipo" | "fundamentals" | "exchange" | "market" | "unlisted" };

// Pages this repo already scrapes or whose APIs it calls, then candidate new sources.
const TARGETS: Target[] = process.env.DISCOVERY_TARGETS
  ? JSON.parse(process.env.DISCOVERY_TARGETS)
  : [
      { name: "investorgain-gmp", url: "https://www.investorgain.com/report/ipo-gmp-live/331/", kind: "ipo" },
      { name: "chittorgarh-mainboard", url: "https://www.chittorgarh.com/report/ipo-in-india-list-main-board-sme/82/mainboard/", kind: "ipo" },
      { name: "chittorgarh-sme", url: "https://www.chittorgarh.com/report/ipo-in-india-list-main-board-sme/82/sme/", kind: "ipo" },
      { name: "ipowatch-gmp", url: "https://ipowatch.in/ipo-grey-market-premium-latest-ipo-gmp/", kind: "ipo" },
      { name: "nse-upcoming-ipo", url: "https://www.nseindia.com/market-data/all-upcoming-issues-ipo", kind: "ipo" },
      { name: "sebi-offer-documents", url: "https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=3&ssid=15&smid=10", kind: "ipo" },
      { name: "screener-company", url: "https://www.screener.in/company/RELIANCE/consolidated/", kind: "fundamentals" },
      { name: "tickertape-stock", url: "https://www.tickertape.in/stocks/reliance-industries-RELI", kind: "fundamentals" },
      { name: "nse-financial-results", url: "https://www.nseindia.com/companies-listing/corporate-filings-financial-results", kind: "fundamentals" },
      { name: "nse-event-calendar", url: "https://www.nseindia.com/companies-listing/corporate-filings-event-calendar", kind: "exchange" },
      { name: "nse-option-chain", url: "https://www.nseindia.com/option-chain", kind: "exchange" },
      { name: "nse-fii-dii", url: "https://www.nseindia.com/reports/fii-dii", kind: "exchange" },
      { name: "nse-quote", url: "https://www.nseindia.com/get-quotes/equity?symbol=RELIANCE", kind: "exchange" },
      { name: "bse-home", url: "https://www.bseindia.com/", kind: "exchange" },
      { name: "bse-announcements", url: "https://www.bseindia.com/corporates/ann.html", kind: "exchange" },
      { name: "bse-quote", url: "https://www.bseindia.com/stock-share-price/reliance-industries-ltd/reliance/500325/", kind: "exchange" },
      { name: "mcx-market-watch", url: "https://www.mcxindia.com/market-data/market-watch", kind: "market" },
      { name: "niftyindices-home", url: "https://www.niftyindices.com/", kind: "market" },
      { name: "nsdl-fpi-latest", url: "https://www.fpi.nsdl.co.in/web/Reports/Latest.aspx", kind: "market" },
      { name: "amfi-nav", url: "https://www.amfiindia.com/net-asset-value", kind: "market" },
      { name: "unlistedzone-shares", url: "https://www.unlistedzone.com/shares", kind: "unlisted" },
      { name: "stockify-unlisted", url: "https://stockify.net.in/unlisted-shares-price-list-india/", kind: "unlisted" },
      // Not used by any sync yet: checked as possible extra IPO and fundamentals sources.
      { name: "moneycontrol-ipo", url: "https://www.moneycontrol.com/ipo/", kind: "ipo" },
      { name: "bse-public-issues", url: "https://www.bseindia.com/markets/PublicIssues/IPOIssues_new.aspx", kind: "ipo" },
    ];

const OUT = process.env.DISCOVERY_OUT ?? "endpoint-discovery";
// The same desktop UA ipo-browser-scrape.mts uses, identifying the crawler.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/124.0.0.0 Safari/537.36 sphpnp-ipo-monitor/1.0 (+https://www.sphpnp.com)";
const NAV_TIMEOUT_MS = 45_000;
const SETTLE_MS = 6_000;
const DELAY_BETWEEN_PAGES_MS = 3_000;
// Third-party telemetry and ads say nothing about where the page's data lives.
const NOISE = /google|doubleclick|facebook|clarity\.ms|hotjar|sentry|segment|mixpanel|amplitude|cloudflareinsights|taboola|outbrain|adservice|criteo|moengage|clevertap|webengage|onesignal|branch\.io|hs-scripts|hubspot|intercom|freshchat|tawk/i;

type Observed = {
  url: string;
  method: string;
  status: number;
  contentType: string;
  bytes: number;
  shape: string;
  requestHeaders: Record<string, string>;
  postData: string | null;
  direct?: { status: number | string; contentType: string; bytes: number; json: boolean; sameShape: boolean };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A short description of a JSON value: its top-level keys, or array length and first item's keys. */
function shapeOf(value: unknown): string {
  const keys = (v: unknown) => (v && typeof v === "object" ? Object.keys(v as object).slice(0, 12).join(",") : typeof v);
  if (Array.isArray(value)) return `array[${value.length}] of {${keys(value[0])}}`;
  if (value && typeof value === "object") {
    const parts = Object.entries(value as Record<string, unknown>)
      .slice(0, 12)
      .map(([k, v]) => (Array.isArray(v) ? `${k}[${v.length}]` : k));
    return `{${parts.join(",")}}`;
  }
  return typeof value;
}

async function record(response: Response, into: Observed[]): Promise<void> {
  const request = response.request();
  if (!["xhr", "fetch", "document", "other"].includes(request.resourceType())) return;
  if (NOISE.test(new URL(response.url()).hostname)) return;
  const contentType = response.headers()["content-type"] ?? "";
  if (!/json|javascript/.test(contentType) || request.resourceType() === "script") return;
  let body: Buffer;
  try {
    body = await response.body();
  } catch {
    return; // redirects and aborted requests have no body
  }
  let shape = "not JSON";
  try {
    shape = shapeOf(JSON.parse(body.toString("utf8")));
  } catch {
    if (!/json/.test(contentType)) return;
  }
  const headers = await request.allHeaders();
  const requestHeaders = Object.fromEntries(
    Object.entries(headers).filter(([k]) => !/^(cookie|authorization)$/i.test(k)),
  );
  into.push({
    url: response.url(),
    method: request.method(),
    status: response.status(),
    contentType,
    bytes: body.length,
    shape,
    requestHeaders,
    postData: request.postData(),
  });
}

/** Re-requests one endpoint from plain Node: browser UA, the page as referer, no cookies. */
async function direct(endpoint: Observed, page: string): Promise<Observed["direct"]> {
  try {
    const res = await fetch(endpoint.url, {
      method: endpoint.method,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json, text/plain, */*",
        Referer: page,
        ...(endpoint.postData ? { "Content-Type": endpoint.requestHeaders["content-type"] ?? "application/json" } : {}),
      },
      body: endpoint.postData ?? undefined,
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    let json = false;
    let shape = "";
    try {
      shape = shapeOf(JSON.parse(text));
      json = true;
    } catch {
      // not JSON: a bot wall or an HTML error page
    }
    return { status: res.status, contentType: res.headers.get("content-type") ?? "", bytes: text.length, json, sameShape: json && shape === endpoint.shape };
  } catch (error) {
    return { status: error instanceof Error ? error.message : String(error), contentType: "", bytes: 0, json: false, sameShape: false };
  }
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const results: { target: Target; finalUrl: string | null; error?: string; endpoints: Observed[] }[] = [];

for (const [i, target] of TARGETS.entries()) {
  if (i > 0) await sleep(DELAY_BETWEEN_PAGES_MS);
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    recordHar: { path: join(OUT, `${target.name}.har`), content: "omit" },
  });
  const page = await context.newPage();
  const endpoints: Observed[] = [];
  const pending: Promise<void>[] = [];
  // Caught here: these sit unawaited until the page settles, and one stray rejection
  // (allHeaders on a closed request) would otherwise kill the whole run.
  page.on("response", (response) =>
    pending.push(record(response, endpoints).catch((e) => console.warn(`  skipped ${response.url()}: ${e}`))),
  );
  let finalUrl: string | null = null;
  let error: string | undefined;
  try {
    await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
    await page.waitForLoadState("networkidle", { timeout: SETTLE_MS * 3 }).catch(() => {});
    await sleep(SETTLE_MS);
    finalUrl = page.url();
  } catch (e) {
    error = e instanceof Error ? e.message.split("\n")[0] : String(e);
  }
  await Promise.all(pending);
  await context.close(); // flushes the HAR
  const seen = new Set<string>();
  const unique = endpoints.filter((e) => !seen.has(`${e.method} ${e.url}`) && seen.add(`${e.method} ${e.url}`));
  for (const endpoint of unique) {
    endpoint.direct = await direct(endpoint, target.url);
    await sleep(500);
  }
  results.push({ target, finalUrl, error, endpoints: unique });
  console.log(`${target.name}: ${error ?? `${unique.length} JSON endpoint(s)`}`);
}
await browser.close();

writeFileSync(join(OUT, "report.json"), JSON.stringify(results, null, 2));

const verdict = (e: Observed) =>
  e.direct?.sameShape ? "yes: same JSON" : e.direct?.json ? "JSON, different shape" : `no (${e.direct?.status})`;
const lines = ["# Data endpoints behind the scraped pages", ""];
for (const { target, finalUrl, error, endpoints } of results) {
  lines.push(`## ${target.name} (${target.kind})`, "", `Page: ${target.url}${finalUrl && finalUrl !== target.url ? ` -> ${finalUrl}` : ""}`, "");
  if (error) lines.push(`Page did not load: ${error}`, "");
  else if (endpoints.length === 0) lines.push("No JSON requests: the data is in the HTML itself.", "");
  else {
    lines.push("| Method | URL | Status | Bytes | Shape | Direct fetch |", "|---|---|---|---|---|---|");
    for (const e of endpoints) {
      lines.push(`| ${e.method} | \`${e.url.slice(0, 160)}\` | ${e.status} | ${e.bytes} | \`${e.shape.slice(0, 80)}\` | ${verdict(e)} |`);
    }
    lines.push("");
  }
}
// Every host that served the pages JSON, and whether any sync already calls it.
const code = ["supabase/functions", "scripts"]
  .flatMap((dir) => {
    try {
      return readdirSync(dir, { recursive: true, encoding: "utf8" }).map((f) => join(dir, f));
    } catch {
      return [];
    }
  })
  .filter((f) => /\.(ts|mts|py)$/.test(f) && !f.endsWith("discover-endpoints.mts"))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");
const hosts = new Map<string, Set<string>>();
for (const { target, endpoints } of results) {
  for (const e of endpoints) {
    const host = new URL(e.url).hostname;
    if (!hosts.has(host)) hosts.set(host, new Set());
    hosts.get(host)!.add(target.name);
  }
}
lines.push("## Data hosts", "", "| Host | Seen on | Used by a sync |", "|---|---|---|");
for (const [host, pages] of [...hosts].sort()) {
  lines.push(`| ${host} | ${[...pages].join(", ")} | ${code.includes(host) ? "yes" : "**no: new source**"} |`);
}
lines.push("");
writeFileSync(join(OUT, "report.md"), lines.join("\n"));
console.log(`\nwrote ${join(OUT, "report.md")}`);
