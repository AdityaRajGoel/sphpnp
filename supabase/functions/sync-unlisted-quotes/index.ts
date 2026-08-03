// Daily collection of indicative unlisted-share prices published by other
// dealers, powering the "How our rates compare" block on /unlisted-space.
//
//   sources: https://www.unlistedzone.com/shares   (Next.js RSC payload, JSON)
//            https://stockify.net.in/unlisted-shares/  (server-rendered text)
//
// Trigger: GitHub Actions cron (.github/workflows/unlisted-quotes.yml).
// Protected by SYNC_SECRET; writes use the service-role key. Safe to re-run.
//
// This runs as an edge function rather than in the Action itself so the
// service-role key stays a Supabase secret. The Action only holds the anon key
// and the shared sync secret, matching sync-bhavcopy and sync-market-feed.
//
// Only sources whose prices are present in the HTML a plain GET returns are
// included. Planify was evaluated and left out: its table is filled in on the
// client, so it would need a headless browser. Writing a parser against markup
// nobody has inspected is how invented numbers reach a page, which is exactly
// what the removed price displays in UnlistedShares.tsx used to do.

import { createClient } from "npm:@supabase/supabase-js@2";

const USER_AGENT =
  "Mozilla/5.0 (compatible; sphpnp-price-monitor/1.0; +https://www.sphpnp.com)";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-secret",
};

interface Quote {
  match_key: string;
  company_name: string;
  source: string;
  source_url: string;
  price: number;
  sector: string | null;
}

/**
 * Dealers name the same company differently — "NSE India Limited Unlisted
 * Shares", "NSE India Unlisted Shares", "NSE India Ltd". Strip the boilerplate
 * so one company yields one key across sources.
 *
 * This is imperfect and knowingly so: a dealer listing "CSK Unlisted Shares"
 * against another's "Chennai Super Kings Unlisted Shares" will not match, and
 * no amount of suffix-stripping fixes an abbreviation. Unmatched companies are
 * simply not compared, which is the safe direction to fail.
 */
function matchKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/\b(unlisted|pre-?ipo)\b/g, " ")
    .replace(/\b(shares?|equity|stock)\b/g, " ")
    .replace(/\b(limited|ltd|private|pvt|inc|corporation|corp)\b/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

async function getHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`);
  return res.text();
}

/** UnlistedZone: share list is escaped JSON inside the RSC flight payload. */
async function unlistedZone(): Promise<Quote[]> {
  const html = await getHtml("https://www.unlistedzone.com/shares");
  const out: Quote[] = [];
  const seen = new Set<string>();

  const re =
    /\\"name\\":\\"([^"\\]{3,120})\\"[\s\S]{0,400}?\\"price\\":([0-9]+(?:\.[0-9]+)?)/g;

  for (const m of html.matchAll(re)) {
    const name = m[1].replace(/\\u0026/g, "&").trim();
    const price = Number(m[2]);
    // Companies are published at 0 until a rate is set. Zero is not a price.
    if (!Number.isFinite(price) || price <= 0) continue;

    const key = matchKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const sector = html
      .slice(m.index, m.index + 400)
      .match(/\\"sector\\":\\"([^"\\]{0,60})\\"/)?.[1]
      ?.replace(/\\u0026/g, "&") ?? null;

    out.push({
      match_key: key,
      company_name: name,
      price,
      sector,
      source: "UnlistedZone",
      source_url: "https://www.unlistedzone.com/shares",
    });
  }
  return out;
}

/** Stockify: server-rendered as "<company> Unlisted Shares ₹1,234.56". */
async function stockify(): Promise<Quote[]> {
  const html = await getHtml("https://stockify.net.in/unlisted-shares/");
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

  const out: Quote[] = [];
  const seen = new Set<string>();
  const re =
    /([A-Z][A-Za-z0-9&.,'()\- ]{3,90}?)\s+Unlisted Shares\s+₹\s?([0-9][0-9,]*(?:\.[0-9]+)?)/g;

  for (const m of text.matchAll(re)) {
    const name = m[1].trim();
    const price = Number(m[2].replace(/,/g, ""));
    if (!Number.isFinite(price) || price <= 0) continue;

    const key = matchKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    out.push({
      match_key: key,
      company_name: `${name} Unlisted Shares`,
      price,
      sector: null,
      source: "Stockify",
      source_url: "https://stockify.net.in/unlisted-shares/",
    });
  }
  return out;
}

const SOURCES = [
  { name: "UnlistedZone", run: unlistedZone },
  { name: "Stockify", run: stockify },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // Same posture as sync-bhavcopy: this writes with the service-role key, so a
  // missing SYNC_SECRET locks the endpoint rather than leaving it open.
  const secret = Deno.env.get("SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const collected: Array<Quote & { fetched_at: string }> = [];
  const failures: string[] = [];
  // One timestamp for the whole run, so a source's rows cannot appear to be
  // from different moments depending on upsert ordering.
  const fetchedAt = new Date().toISOString();

  for (const source of SOURCES) {
    try {
      const rows = await source.run();
      if (rows.length === 0) {
        failures.push(`${source.name}: parsed 0 quotes (markup likely changed)`);
        continue;
      }
      collected.push(...rows.map((r) => ({ ...r, fetched_at: fetchedAt })));
    } catch (err) {
      failures.push(`${source.name}: ${(err as Error).message}`);
    }
  }

  if (collected.length > 0) {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error } = await supabase
      .from("unlisted_market_quotes")
      .upsert(collected, { onConflict: "source,match_key" });

    if (error) {
      return new Response(
        JSON.stringify({ error: `Upsert failed: ${error.message}` }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }
  }

  // A source that silently stops parsing is the failure worth catching: its
  // last-good rows stay in the table and age out on screen, but without a
  // non-200 nobody would notice the block had quietly frozen.
  const status = failures.length > 0 ? 500 : 200;
  return new Response(
    JSON.stringify({ upserted: collected.length, failures }),
    { status, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
