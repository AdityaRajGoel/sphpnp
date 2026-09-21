// Turns a browser watchlist into a one-time Telegram deep link. The bot's
// /start handler (telegram-webhook) redeems the token and subscribes the chat.

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SYMBOL = /^[A-Z0-9&._-]{1,20}$/;
const MAX_SYMBOLS = 50;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const bot = Deno.env.get("TELEGRAM_BOT_USERNAME");
  if (!bot) return json({ error: "Telegram alerts are not set up yet" }, 503);

  const body = await req.json().catch(() => ({})) as { symbols?: unknown };
  const symbols = Array.isArray(body.symbols)
    ? [...new Set(body.symbols.filter((s): s is string => typeof s === "string").map((s) => s.toUpperCase()).filter((s) => SYMBOL.test(s)))].slice(0, MAX_SYMBOLS)
    : [];
  if (symbols.length === 0) return json({ error: "Add stocks to your watchlist first" }, 400);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const client = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anon";
  const { data: allowed } = await sb.rpc("check_ai_rate_limit", { p_bucket: `tglink:${client}`, p_max: 10, p_window_seconds: 3600 });
  if (allowed === false) return json({ error: "Too many links requested; try again in an hour" }, 429);

  const token = crypto.randomUUID().replaceAll("-", "");
  const { error } = await sb.from("telegram_link_tokens").insert({ token, symbols });
  if (error) return json({ error: "Could not create the link" }, 500);
  return json({ url: `https://t.me/${bot}?start=${token}`, symbols: symbols.length });
});
