// Writes the screener universe as one static file for nginx to serve (speed plan
// step 2; see src/lib/universe-file.ts). Runs on the VPS host from
// infra/vps/jobs/screener-universe.sh, reading the local API with the public key:
// these four tables are public-read, so nothing here needs a secret.

import { chmodSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { LITE_SOURCE, UNIVERSE_SOURCES, type LiteQuote, type UniverseFile, type UniversePart } from "../src/lib/universe-file.ts";

const API = process.env.SUPABASE_URL ?? "http://127.0.0.1:8000";
const KEY = process.env.SUPABASE_ANON_KEY ?? "";
const OUT_DIR = process.env.UNIVERSE_DIR ?? "/var/www/sphpnp-data";
const FILE = "screener-universe.json";
// PostgREST caps a read at 1,000 rows without saying so, so each part is read a
// page at a time, ordered by symbol so the pages cannot overlap.
const PAGE = 1000;

async function read({ table, select }: { table: string; select: string }, filter = ""): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const res = await fetch(`${API}/rest/v1/${table}?select=${encodeURIComponent(select)}${filter}&order=symbol&offset=${offset}&limit=${PAGE}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status}`);
    const rows = (await res.json()) as Record<string, unknown>[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

function writeAtomic(path: string, data: Buffer | string) {
  writeFileSync(`${path}.tmp`, data);
  chmodSync(`${path}.tmp`, 0o644); // nginx reads it as another user; the job's umask would hide it
  renameSync(`${path}.tmp`, path);
}

const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
const shortName = (name: string) => name.replace(/\s+(Limited|Ltd\.?)$/i, "").trim();

/**
 * NSE mainboard stocks outside the live universe, at their last close: those with
 * a market cap (about 1,600 of 1,950 in Oct 2026), so a size filter or sort
 * places them. The screener lists them after the live rows, marked end-of-day.
 */
function liteQuotes(metrics: Record<string, unknown>[], names: Record<string, unknown>[], live: Set<unknown>): LiteQuote[] {
  const nameOf = new Map(names.map((r) => [r.symbol, String(r.name ?? "")]));
  return metrics
    .filter((r) => !live.has(r.symbol) && num(r.close) && num(r.market_cap_cr) && nameOf.get(r.symbol))
    .map((r) => ({
      symbol: String(r.symbol), name: shortName(nameOf.get(r.symbol)!), close: Number(r.close),
      prev_close: num(r.prev_close), change_pct: num(r.change_pct), volume: num(r.volume),
      high_52: num(r.high_52), low_52: num(r.low_52), market_cap_cr: num(r.market_cap_cr), pe: num(r.pe),
      trade_date: String(r.trade_date),
    }));
}

const parts = Object.keys(UNIVERSE_SOURCES) as UniversePart[];
const [rows, metrics, names] = await Promise.all([
  Promise.all(parts.map((p) => read(UNIVERSE_SOURCES[p]))),
  read(LITE_SOURCE.metrics, "&series=eq.EQ&market_cap_cr=not.is.null"),
  read(LITE_SOURCE.names, "&series=eq.EQ"),
]);
const file = { generated_at: new Date().toISOString(), ...Object.fromEntries(parts.map((p, i) => [p, rows[i]])) } as UniverseFile;
if (file.quotes.length === 0) throw new Error("screener_stocks returned no rows; keeping the previous file");
file.lite = liteQuotes(metrics, names, new Set(file.quotes.map((q) => q.symbol)));
// Every reader joins on the quotes and lite rows (buildMetricRows), and the summary
// tables also cover stocks with neither: keep the file to what is joined.
const inScreener = new Set([...file.quotes, ...file.lite].map((q) => q.symbol));
for (const p of parts) if (p !== "quotes") file[p] = file[p].filter((r) => inScreener.has(r.symbol));

const json = JSON.stringify(file);
mkdirSync(OUT_DIR, { recursive: true });
const path = join(OUT_DIR, FILE);
// Compressed copies first, so nginx never pairs a new .json with an old .br.
writeAtomic(`${path}.br`, brotliCompressSync(json, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }));
writeAtomic(`${path}.gz`, gzipSync(json, { level: 9 }));
writeAtomic(path, json);
console.log(`ok ${parts.map((p) => `${p}=${file[p].length}`).join(" ")} lite=${file.lite.length} ${Math.round(json.length / 1024)} KB`);
