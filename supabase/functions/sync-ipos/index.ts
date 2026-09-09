// Collects the published IPO Watch GMP table into the persisted IPO catalogue.
// Triggered by GitHub Actions; it is not a visitor-facing scraper. Every
// successful collection inserts a new GMP observation, preserving the history
// needed for the public detail chart.

import { createClient } from "npm:@supabase/supabase-js@2";

const SOURCE_URL = "https://ipowatch.in/ipo-grey-market-premium-latest-ipo-gmp/";
const USER_AGENT = "Mozilla/5.0 (compatible; sphpnp-ipo-monitor/1.0; +https://www.sphpnp.com)";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
};

type CollectedIpo = {
  slug: string;
  name: string;
  board: "mainboard" | "sme";
  status: "upcoming" | "open" | "closed" | "listed";
  price_band_min: number | null;
  price_band_max: number | null;
  open_date: string | null;
  close_date: string | null;
  gmp: number;
  est_listing_price: number | null;
};

const stripTags = (value: string) => {
  let previous = "";
  let text = value;
  while (text !== previous) {
    previous = text;
    text = text.replace(/<[^>]*>/g, "");
  }
  return text.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
};

const slugify = (value: string) => value
  .toLowerCase()
  .replace(/\b(ipo|limited|ltd\.?|private)\b/g, " ")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/(^-|-$)/g, "")
  .slice(0, 96);

const amount = (value: string): number | null => {
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};

const priceBand = (value: string): [number | null, number | null] => {
  const values = [...value.replace(/,/g, "").matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  if (values.length === 0) return [null, null];
  return [values[0], values[values.length - 1]];
};

// IPO Watch displays dates such as "10 - 14 Sep 2026". Dates without a year
// are deliberately left null rather than guessed across a year boundary.
const parseDates = (value: string): [string | null, string | null] => {
  const match = value.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s*([A-Za-z]{3,9})\s*(\d{4})/);
  if (!match) return [null, null];
  const month = new Date(`${match[3]} 1, ${match[4]}`).getMonth();
  if (Number.isNaN(month)) return [null, null];
  const iso = (day: string) => `${match[4]}-${String(month + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
  return [iso(match[1]), iso(match[2])];
};

function parseIpoWatch(html: string): CollectedIpo[] {
  const rows: CollectedIpo[] = [];
  const tables = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi) ?? [];

  for (const table of tables) {
    const tableRows = table.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
    if (tableRows.length < 2) continue;
    const header = stripTags(tableRows[0]).toLowerCase();
    if (!header.includes("ipo") || !header.includes("gmp") || !header.includes("price")) continue;

    for (const row of tableRows.slice(1)) {
      const cells = row.match(/<td[^>]*>[\s\S]*?<\/td>/gi);
      if (!cells || cells.length < 6) continue;
      const values = cells.map(stripTags);
      const name = values[0].replace(/\s*(IPO|Limited|Ltd\.?)\s*/gi, " ").replace(/\s+/g, " ").trim();
      if (name.length < 2 || name === "-" || name === "--") continue;

      // Current IPO Watch layout: name, GMP, trend, price band, estimated
      // listing, dates, type, status, last updated. Older layouts still land
      // here, but without the status column and are safely marked upcoming.
      const gmp = amount(values[1]);
      if (gmp === null) continue;
      const negativeGmp = /-/.test(values[1]) && gmp > 0;
      const [min, max] = priceBand(values[3] ?? "");
      const estimated = amount(values[4] ?? "");
      const [openDate, closeDate] = parseDates(values[5] ?? "");
      const type = (values[6] ?? "").toLowerCase();
      const statusText = (values[7] ?? "").toLowerCase();
      const status: CollectedIpo["status"] = statusText.includes("open") || statusText.includes("live")
        ? "open"
        : statusText.includes("listed") ? "listed"
        : statusText.includes("closed") || statusText.includes("allotment") ? "closed"
        : "upcoming";

      rows.push({
        slug: slugify(name), name, board: type.includes("sme") ? "sme" : "mainboard", status,
        price_band_min: min, price_band_max: max, open_date: openDate, close_date: closeDate,
        gmp: negativeGmp ? -gmp : gmp, est_listing_price: estimated,
      });
    }
  }

  const seen = new Set<string>();
  return rows.filter((row) => row.slug && !seen.has(row.slug) && (seen.add(row.slug), true));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const secret = Deno.env.get("SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  }

  try {
    const response = await fetch(SOURCE_URL, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" }, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`IPO Watch returned HTTP ${response.status}`);
    const parsed = parseIpoWatch(await response.text());
    if (parsed.length === 0) throw new Error("IPO Watch parsed 0 rows (markup likely changed)");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const capturedAt = new Date().toISOString();
    const catalogueRows = parsed.map(({ gmp: _gmp, est_listing_price: _est, ...ipo }) => ({
      ...ipo, source: "ipowatch", source_url: SOURCE_URL, data_as_of: capturedAt, updated_at: capturedAt,
    }));
    const { data: upserted, error: catalogueError } = await supabase.from("ipos")
      .upsert(catalogueRows, { onConflict: "slug" }).select("id,slug");
    if (catalogueError) throw new Error(`IPO upsert failed: ${catalogueError.message}`);

    const ids = new Map((upserted ?? []).map((row: { id: string; slug: string }) => [row.slug, row.id]));
    const snapshots = parsed.flatMap((ipo) => {
      const ipoId = ids.get(ipo.slug);
      return ipoId ? [{ ipo_id: ipoId, captured_at: capturedAt, gmp: ipo.gmp, est_listing_price: ipo.est_listing_price, source: "ipowatch" }] : [];
    });
    const { error: snapshotError } = await supabase.from("ipo_gmp_snapshots").insert(snapshots);
    if (snapshotError) throw new Error(`GMP snapshot insert failed: ${snapshotError.message}`);

    return new Response(JSON.stringify({ ok: true, source: "ipowatch", ipos: parsed.length, snapshots: snapshots.length, capturedAt }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("sync-ipos failed:", message);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
