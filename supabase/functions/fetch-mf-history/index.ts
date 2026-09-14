// A mutual fund scheme's full NAV history from mfapi.in (free, keyless), for the
// SIP backtest. mfapi.in sends no CORS headers, so the browser cannot call it
// directly. Responses are cached per scheme for six hours: NAVs publish once a
// day, and the history is up to a few thousand points.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CACHE_MS = 6 * 60 * 60_000;
const MAX_CACHED = 60;
const cache = new Map<string, { at: number; body: string }>();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const { scheme_code: raw } = await req.json().catch(() => ({ scheme_code: "" }));
  const code = typeof raw === "string" || typeof raw === "number" ? String(raw).trim() : "";
  // AMFI scheme codes are plain integers; anything else never reaches the upstream URL.
  if (!/^\d{3,7}$/.test(code)) return json({ success: false, error: "A numeric AMFI scheme code is required" }, 400);

  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return new Response(hit.body, { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" } });
  }

  try {
    const res = await fetch(`https://api.mfapi.in/mf/${code}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return json({ success: false, error: `mfapi.in answered HTTP ${res.status}` }, 502);
    const upstream = await res.json() as { meta?: Record<string, unknown>; data?: { date: string; nav: string }[] };
    const data = Array.isArray(upstream.data) ? upstream.data : [];
    if (data.length === 0) return json({ success: false, error: "No NAV history for this scheme" }, 404);
    const body = JSON.stringify({
      success: true,
      meta: {
        scheme_code: code,
        scheme_name: upstream.meta?.scheme_name ?? null,
        fund_house: upstream.meta?.fund_house ?? null,
        scheme_category: upstream.meta?.scheme_category ?? null,
      },
      navs: data.map((p) => ({ date: p.date, nav: p.nav })),
    });
    if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
    cache.set(code, { at: Date.now(), body });
    return new Response(body, { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" } });
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 502);
  }
});
