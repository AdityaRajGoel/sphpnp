// MoSPI's macro API (api.mospi.gov.in) only negotiates legacy TLS
// renegotiation, which Deno's TLS stack on Supabase refuses - so this runs in
// GitHub Actions (Node allows it with SSL_OP_LEGACY_SERVER_CONNECT; the
// certificate is still verified) and posts the headline series to
// sync-market-data as `macro_ingest`.
//
// Run: node --experimental-strip-types scripts/mospi-collect.mts
// Env: SUPABASE_ANON_KEY, SYNC_SECRET (as in the other sync workflows).

import https from "node:https";
import crypto from "node:crypto";
import { parseMospi, withYoy, type MacroMonthly } from "../supabase/functions/_shared/market-extra.ts";

const FUNCTION_URL = "https://zbkjbbujsdlpujotgltm.supabase.co/functions/v1/sync-market-data";
const agent = new https.Agent({ secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT });

function get(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { agent, headers: { "User-Agent": "Mozilla/5.0 (sphpnp macro collector)", Accept: "application/json" }, timeout: 30_000 }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        if ((res.statusCode ?? 500) >= 400) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        try { resolve(JSON.parse(body)); } catch { reject(new Error(`not JSON from ${url}`)); }
      });
    });
    req.on("timeout", () => req.destroy(new Error(`timeout for ${url}`)));
    req.on("error", reject);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Every page of one query. */
async function allPages(base: string): Promise<{ data: unknown[] }> {
  const data: unknown[] = [];
  for (let page = 1; page <= 30; page++) {
    const res = await get(`${base}&limit=100&page=${page}`) as { data?: unknown[]; meta_data?: { totalPages?: number } };
    data.push(...(res.data ?? []));
    if (!res.meta_data?.totalPages || page >= res.meta_data.totalPages) break;
    await sleep(800);
  }
  return { data };
}

const year = new Date().getUTCFullYear();
const years = [year - 2, year - 1, year];
const rows: MacroMonthly[] = [];
const report: Record<string, number | string> = {};

for (const y of years) {
  for (const [kind, url] of [
    ["cpi", `https://api.mospi.gov.in/api/cpi/getCPIIndex?base_year=2012&series=Current&year=${y}&state_code=99&Format=JSON`],
    ["iip", `https://api.mospi.gov.in/api/iip/getIipData?base_year=2011-12&frequency=Monthly&year=${y}&type=General&Format=JSON`],
  ] as const) {
    try {
      const parsed = parseMospi(await allPages(url), kind);
      rows.push(...parsed);
      report[`${kind} ${y}`] = parsed.length;
    } catch (e) {
      report[`${kind} ${y}`] = (e as Error).message;
    }
    await sleep(1000);
  }
  // WPI lists ~870 commodity rows a month (10,000+ a year); the all-commodities
  // headline is each month's first row, so one small page per month is enough.
  let wpi = 0;
  for (let month = 1; month <= 12; month++) {
    try {
      const page = await get(`https://api.mospi.gov.in/api/wpi/getWpiRecords?base_year=2011-12&year=${y}&month_code=${month}&Format=JSON&limit=5&page=1`);
      const parsed = parseMospi(page, "wpi");
      rows.push(...parsed);
      wpi += parsed.length;
    } catch { /* a month not yet published */ }
    await sleep(600);
  }
  report[`wpi ${y}`] = wpi;
}

const unique = [...new Map(withYoy(rows).map((r) => [`${r.series}|${r.period}`, r])).values()];
console.log(JSON.stringify(report));
if (process.env.DRY_RUN) { console.log(unique.slice(-6)); process.exit(0); }
if (unique.length === 0) {
  console.error("::error title=MoSPI::no rows collected");
  process.exit(1);
}

const res = await fetch(FUNCTION_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`, "x-sync-secret": process.env.SYNC_SECRET ?? "" },
  body: JSON.stringify({ dataset: "macro_ingest", rows: unique }),
});
const body = await res.text();
console.log(res.status, body);
if (!res.ok) process.exit(1);
