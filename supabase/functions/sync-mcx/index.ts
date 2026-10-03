// Stores the MCX futures quotes scripts/host-mcx.mts reads from MCX's market watch.
// The host only fetches; parsing and validation happen here (_shared/mcx.ts), so the
// posted rows are treated as untrusted input. Protected by SYNC_SECRET.
import { createClient } from "npm:@supabase/supabase-js@2";
import { parseMcxBhavcopy, parseMcxFutures } from "../_shared/mcx.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const secret = Deno.env.get("SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) return json({ error: "unauthorized" }, 401);
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // {rows}: live market watch; {bhavcopy}: one past day's closing figures (backfill).
  const body = (await req.json().catch(() => null)) as { rows?: unknown; bhavcopy?: unknown } | null;
  const rows = body?.bhavcopy !== undefined ? parseMcxBhavcopy(body.bhavcopy) : parseMcxFutures(body?.rows);
  if (rows.length === 0) return json({ error: "no valid FUTCOM rows" }, 400);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await sb.from("mcx_futures_daily").upsert(rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: "trade_date,symbol,expiry" });
  if (error) {
    console.error("sync-mcx upsert failed:", error);
    return json({ error: "write failed" }, 500);
  }
  return json({ ok: true, stored: rows.length, trade_date: rows[0].trade_date });
});
