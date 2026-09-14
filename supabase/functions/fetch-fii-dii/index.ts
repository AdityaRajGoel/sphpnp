// The day's provisional FII/DII cash-market activity from NSE. NSE answers its
// JSON API only to a browser-shaped request that already holds the homepage's
// cookies, so the homepage is fetched first on the same cookie jar.
import { parseFiiDii } from "../_shared/fii-dii.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const CACHE_MS = 20 * 60_000;
let cache: { at: number; body: string } | null = null;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=600" } });

async function load(): Promise<string> {
  const home = await fetch("https://www.nseindia.com/", { headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(10_000) });
  const cookies = home.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  await home.body?.cancel();
  const res = await fetch("https://www.nseindia.com/api/fiidiiTradeReact", {
    headers: { "User-Agent": UA, Accept: "application/json", Referer: "https://www.nseindia.com/reports/fii-dii", Cookie: cookies },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`NSE answered HTTP ${res.status}`);
  const rows = parseFiiDii(await res.json());
  if (rows.length === 0) throw new Error("NSE returned no FII/DII rows");
  return JSON.stringify({ success: true, rows, fetched_at: new Date().toISOString() });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!cache || Date.now() - cache.at > CACHE_MS) cache = { at: Date.now(), body: await load() };
    return new Response(cache.body, { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=600" } });
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 502);
  }
});
