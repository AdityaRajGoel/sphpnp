// Writes the screener universe as one static file for nginx to serve (speed plan
// step 2; see src/lib/universe-file.ts). Runs on the VPS host from
// infra/vps/jobs/screener-universe.sh, reading the local API with the public key:
// these four tables are public-read, so nothing here needs a secret.

import { chmodSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { UNIVERSE_SOURCES, type UniverseFile, type UniversePart } from "../src/lib/universe-file.ts";

const API = process.env.SUPABASE_URL ?? "http://127.0.0.1:8000";
const KEY = process.env.SUPABASE_ANON_KEY ?? "";
const OUT_DIR = process.env.UNIVERSE_DIR ?? "/var/www/sphpnp-data";
const FILE = "screener-universe.json";
// PostgREST caps a read at 1,000 rows without saying so, so each part is read a
// page at a time, ordered by symbol so the pages cannot overlap.
const PAGE = 1000;

async function read(part: UniversePart): Promise<Record<string, unknown>[]> {
  const { table, select } = UNIVERSE_SOURCES[part];
  const out: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const res = await fetch(`${API}/rest/v1/${table}?select=${encodeURIComponent(select)}&order=symbol&offset=${offset}&limit=${PAGE}`, {
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

const parts = Object.keys(UNIVERSE_SOURCES) as UniversePart[];
const rows = await Promise.all(parts.map(read));
const file = { generated_at: new Date().toISOString(), ...Object.fromEntries(parts.map((p, i) => [p, rows[i]])) } as UniverseFile;
if (file.quotes.length === 0) throw new Error("screener_stocks returned no rows; keeping the previous file");
// Every reader joins on the screener's quotes (buildMetricRows), and the summary
// tables also cover the ~2,400 lighter-page stocks: keep the file to what is joined.
const inScreener = new Set(file.quotes.map((q) => q.symbol));
for (const p of parts) if (p !== "quotes") file[p] = file[p].filter((r) => inScreener.has(r.symbol));

const json = JSON.stringify(file);
mkdirSync(OUT_DIR, { recursive: true });
const path = join(OUT_DIR, FILE);
// Compressed copies first, so nginx never pairs a new .json with an old .br.
writeAtomic(`${path}.br`, brotliCompressSync(json, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }));
writeAtomic(`${path}.gz`, gzipSync(json, { level: 9 }));
writeAtomic(path, json);
console.log(`ok ${parts.map((p) => `${p}=${file[p].length}`).join(" ")} ${Math.round(json.length / 1024)} KB`);
