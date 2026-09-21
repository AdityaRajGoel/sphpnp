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

// Overridable so the same collector can feed the self-hosted stack (infra/vps/jobs/mospi.sh).
const FUNCTION_URL = process.env.SYNC_URL ?? "https://zbkjbbujsdlpujotgltm.supabase.co/functions/v1/sync-market-data";
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

// New base years (CPI 2024=100 from Feb 2026, IIP and WPI 2022-23): the old
// series stopped at Dec 2025 (CPI), Mar 2026 (IIP) and Apr 2026 (WPI) and the
// API kept answering "No Data Found" for them, so the collector reported 0 rows
// for months. Every year here is fetched on the new base: WPI's YoY is computed
// from its index, and mixing bases would divide a 2022-23 level by a 2011-12 one.
// CPI 2024 lives at getCPIData (not getCPIIndex) and rejects a limit under 10.
for (const y of years) {
  for (const [kind, url] of [
    ["iip", `https://api.mospi.gov.in/api/iip/getIIPMonthly?base_year=2022-23&year=${y}&type=General&Format=JSON`],
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
  // CPI 2024 and WPI list every state, sector and item (thousands of rows a
  // month); each month's headline rows come first, so one small page a month.
  for (const kind of ["cpi", "wpi"] as const) {
    let count = 0;
    for (let month = 1; month <= 12; month++) {
      const url = kind === "cpi"
        ? `https://api.mospi.gov.in/api/cpi/getCPIData?base_year=2024&series=Current&year=${y}&month_code=${month}&Format=JSON&limit=10&page=1`
        : `https://api.mospi.gov.in/api/wpi/getWpiRecords?base_year=2022-23&year=${y}&month_code=${month}&Format=JSON&limit=10&page=1`;
      try {
        let parsed = parseMospi(await get(url), kind);
        // CPI 2024=100 starts its Current series in 2025; earlier months (needed for
        // 2025's year-on-year change) are in the Back series on the same base.
        if (kind === "cpi" && parsed.length === 0) parsed = parseMospi(await get(url.replace("series=Current", "series=Back")), kind);
        rows.push(...parsed);
        count += parsed.length;
      } catch { /* a month not yet published */ }
      await sleep(600);
    }
    report[`${kind} ${y}`] = count;
  }
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
