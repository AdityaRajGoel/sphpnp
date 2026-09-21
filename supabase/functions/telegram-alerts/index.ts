// Sends each linked Telegram chat the new red flags and quarterly results for
// the stocks it follows. Scheduled from the VPS cron; protected by SYNC_SECRET.
// telegram_alerts_sent makes it idempotent: a flag that stays true is sent once.

import { createClient } from "npm:@supabase/supabase-js@2";
import { fetchRedFlagInputsMany, redFlags } from "../_shared/red-flags.ts";
import { resultsSummary, type IncomeRow } from "../_shared/results-summary.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const BATCH = 50;
/** Telegram allows about 30 messages a second across chats. */
const SEND_GAP_MS = 60;
const SITE = "https://www.sphpnp.com";

type Alert = { key: string; symbol: string; text: string };

Deno.serve(async (req) => {
  const secret = Deno.env.get("SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) return json({ error: "Unauthorized" }, 401);
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) return json({ error: "TELEGRAM_BOT_TOKEN not set" }, 500);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: subs, error } = await sb.from("telegram_subscriptions").select("chat_id, symbol").limit(20000);
  if (error) return json({ error: error.message }, 500);
  if (!subs?.length) return json({ ok: true, chats: 0, sent: 0 });
  const symbols = [...new Set(subs.map((s) => s.symbol as string))];

  // Every alert currently true for every followed stock.
  const alerts = new Map<string, Alert[]>();
  const add = (a: Alert) => alerts.set(a.symbol, [...(alerts.get(a.symbol) ?? []), a]);
  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const inputs = await fetchRedFlagInputsMany(sb, batch);
    for (const symbol of batch) {
      for (const f of redFlags(inputs.get(symbol)!)) {
        add({ key: `${symbol}|${f.id}|${f.date ?? ""}`, symbol, text: `${f.severity === "high" ? "🔴" : "🟠"} ${symbol}: ${f.title}. ${f.detail}` });
      }
    }
  }
  const since = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const { data: filed } = await sb.from("fundamentals_filings").select("symbol").in("symbol", symbols).gte("filing_date", since).limit(1000);
  const resultSymbols = [...new Set((filed ?? []).map((f) => f.symbol as string))];
  if (resultSymbols.length) {
    const { data: income } = await sb.from("fundamentals_income").select("symbol,period_end,is_consolidated,source,revenue,profit_after_tax")
      .in("symbol", resultSymbols).gte("period_end", new Date(Date.now() - 500 * 86_400_000).toISOString().slice(0, 10)).limit(5000);
    for (const symbol of resultSymbols) {
      const s = resultsSummary(((income ?? []) as (IncomeRow & { symbol: string })[]).filter((r) => r.symbol === symbol));
      if (s) add({ key: `${symbol}|results|${s.period_end}`, symbol, text: `📊 ${symbol} results, ${s.text}` });
    }
  }

  // What each chat has not been sent yet.
  const byChat = new Map<number, string[]>();
  for (const s of subs) byChat.set(s.chat_id as number, [...(byChat.get(s.chat_id as number) ?? []), s.symbol as string]);
  const { data: sentRows } = await sb.from("telegram_alerts_sent").select("chat_id, alert_key").in("chat_id", [...byChat.keys()]).limit(100000);
  const sent = new Set((sentRows ?? []).map((r) => `${r.chat_id}#${r.alert_key}`));

  let messages = 0, blocked = 0;
  const failures: string[] = [];
  for (const [chatId, followed] of byChat) {
    const fresh = followed.flatMap((sym) => alerts.get(sym) ?? []).filter((a) => !sent.has(`${chatId}#${a.key}`));
    if (fresh.length === 0) continue;
    const text = [...fresh.slice(0, 15).map((a) => a.text), fresh.length > 15 ? `…and ${fresh.length - 15} more.` : "", `\nDetails: ${SITE}/watchlist`].filter(Boolean).join("\n\n");
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    if (res.status === 403) {
      // The person blocked the bot or deleted the chat: stop following for them.
      await sb.from("telegram_subscriptions").delete().eq("chat_id", chatId);
      blocked++;
    } else if (!res.ok) {
      failures.push(`${chatId}: HTTP ${res.status}`);
    } else {
      messages++;
      await sb.from("telegram_alerts_sent").upsert(fresh.map((a) => ({ chat_id: chatId, alert_key: a.key })), { onConflict: "chat_id,alert_key" });
    }
    await sleep(SEND_GAP_MS);
  }
  return json({ ok: failures.length === 0, chats: byChat.size, symbols: symbols.length, messages, blocked, failures: failures.slice(0, 10) }, failures.length && !messages ? 502 : 200);
});
