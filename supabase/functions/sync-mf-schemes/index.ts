// Every open-ended growth mutual fund scheme into mf_schemes, from AMFI.
//
//   {"part":"latest"}              today's NAVAll: NAV, fund house, category
//   {"part":"anchor","anchor":"1y"} the NAV history report for the four days
//                                   ending that far back; sets nav_1y
//
// One part per call: a history report is ~1 MB a day and AMFI takes ~15s to
// build one, so the six anchors run as six calls (see sphpnp-sync.cron).
// Protected by SYNC_SECRET; writes use the service-role key, like every sync-*.

import { createClient } from "npm:@supabase/supabase-js@2";
import { AMFI_NAVALL_URL, parseAmfiNavAll } from "../_shared/amfi.ts";
import { ANCHORS, amfiDate, anchorWindow, latestOnOrBefore, toScheme, type Anchor } from "../_shared/mf-schemes.ts";
import { errorText } from "../_shared/errors.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const HISTORY_URL = "https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx";
const istToday = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

async function amfi(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`AMFI ${res.status} for ${url}`);
  return res.text();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const secret = Deno.env.get("SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) return json({ error: "Unauthorized" }, 401);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({})) as { part?: string; anchor?: string };

  try {
    if (body.part === "latest") {
      const { rows, headerFound } = parseAmfiNavAll(await amfi(AMFI_NAVALL_URL));
      // A file we can no longer read must fail loudly, not report zero rows.
      if (!headerFound || rows.length === 0) throw new Error(`NAVAll unreadable (header ${headerFound}, ${rows.length} rows)`);
      const now = new Date().toISOString();
      const schemes = rows.flatMap((r) => toScheme(r) ?? []).map((s) => ({ ...s, updated_at: now }));
      for (let i = 0; i < schemes.length; i += 500) {
        const { error } = await sb.from("mf_schemes").upsert(schemes.slice(i, i + 500), { onConflict: "scheme_code" });
        if (error) throw new Error(`upsert at ${i}: ${error.message}`);
      }
      return json({ ok: true, part: "latest", parsed: rows.length, schemes: schemes.length });
    }

    if (body.part === "anchor" && body.anchor && body.anchor in ANCHORS) {
      const anchor = body.anchor as Anchor;
      const { from, to } = anchorWindow(istToday(), anchor);
      const { rows, headerFound } = parseAmfiNavAll(await amfi(`${HISTORY_URL}?frmdt=${amfiDate(from)}&todt=${amfiDate(to)}`));
      if (!headerFound) throw new Error("NAV history unreadable");
      const navs = [...latestOnOrBefore(rows, to)].map(([scheme_code, nav]) => ({ scheme_code, nav }));
      let updated = 0;
      for (let i = 0; i < navs.length; i += 2000) {
        const { data, error } = await sb.rpc("mf_set_anchor", { p_anchor: anchor, p_rows: navs.slice(i, i + 2000) });
        if (error) throw new Error(`anchor ${anchor} at ${i}: ${error.message}`);
        updated += Number(data ?? 0);
      }
      return json({ ok: true, part: "anchor", anchor, window: { from, to }, navs: navs.length, updated });
    }

    return json({ error: 'body must be {"part":"latest"} or {"part":"anchor","anchor":"1m|3m|6m|1y|3y|5y"}' }, 400);
  } catch (e) {
    const message = errorText(e);
    console.error("sync-mf-schemes:", message);
    return json({ ok: false, error: message }, 500);
  }
});
