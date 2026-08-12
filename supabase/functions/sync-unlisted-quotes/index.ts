// Daily collection of indicative unlisted-share prices published by other
// dealers, powering the "How our rates compare" block on /unlisted-space.
//
//   sources: https://www.unlistedzone.com/shares   (Next.js RSC payload, JSON)
//            https://stockify.net.in/unlisted-shares-price-list-india/  (Next.js RSC payload, JSON)
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
//
// The parsing itself lives in ../_shared/unlisted-sources.ts so a fixture of
// each dealer's real page can be pointed at it from Vitest. It was inline here
// until Stockify's redesign took the parser to zero rows: the cron caught it,
// but nothing in the repository could have, because the rules were welded to a
// `fetch`.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  classifyFailure,
  classifyHttpStatus,
  errorMessage,
  SourceError,
  summarizeRun,
  type SourceFailure,
} from "../_shared/quote-failures.ts";
import {
  parseStockify,
  parseUnlistedZone,
  STOCKIFY_URL,
  UNLISTEDZONE_URL,
  type Quote,
} from "../_shared/unlisted-sources.ts";

const USER_AGENT =
  "Mozilla/5.0 (compatible; sphpnp-price-monitor/1.0; +https://www.sphpnp.com)";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-secret",
};

/**
 * One retry on anything that looks momentary, because the alternative is crying
 * wolf.
 *
 * A source that stops parsing must fail the run loudly - that is the whole
 * point of the failure policy. But a dealer's server returning a momentary 502
 * is not that, and a red build for every blip trains people to ignore red
 * builds. Retried once, briefly; anything still failing after that is real.
 *
 * The retry used to cover only the 5xx case, which was the one transient
 * failure that never actually happened. `AbortSignal.timeout` firing makes
 * `fetch` itself reject: no response is ever returned, so `!res.ok` is not
 * evaluated and the 5xx branch could not see it. Same for a DNS failure or a
 * connection reset. The most common transient failure - and the one that broke
 * a scheduled run with "UnlistedZone: Signal timed out." - therefore got zero
 * retries while the rare one got all of them. Each of the three ways an attempt
 * can fail now retries once, so the docstring above describes what the code does.
 *
 * 4xx is not retried: a 404 or 403 means the URL or our access changed, and
 * asking again will not fix it. The 30s cap is per attempt, not per call.
 */
async function getHtml(url: string, attempt = 0): Promise<string> {
  const retry = async () => {
    await new Promise((r) => setTimeout(r, 3_000));
    return getHtml(url, attempt + 1);
  };

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    // Timed out, DNS failed, connection refused or reset - no response exists.
    if (attempt === 0) return retry();
    throw new SourceError("transient", `${url} could not be fetched: ${errorMessage(err)}`);
  }

  if (!res.ok) {
    if (res.status >= 500 && attempt === 0) return retry();
    throw new SourceError(
      classifyHttpStatus(res.status),
      `${url} returned HTTP ${res.status}`,
    );
  }

  try {
    return await res.text();
  } catch (err) {
    // Headers arrived but the body did not finish streaming. Still a network
    // failure, and still nothing to do with our parser.
    if (attempt === 0) return retry();
    throw new SourceError("transient", `${url} body could not be read: ${errorMessage(err)}`);
  }
}

async function unlistedZone(): Promise<Quote[]> {
  return parseUnlistedZone(await getHtml(UNLISTEDZONE_URL));
}

async function stockify(): Promise<Quote[]> {
  return parseStockify(await getHtml(STOCKIFY_URL));
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
  const failures: SourceFailure[] = [];
  // One timestamp for the whole run, so a source's rows cannot appear to be
  // from different moments depending on upsert ordering.
  const fetchedAt = new Date().toISOString();

  for (const source of SOURCES) {
    try {
      const rows = await source.run();
      if (rows.length === 0) {
        // The fetch succeeded and the parser still found nothing, which is what
        // a markup change looks like from here. Structural, always.
        failures.push({
          source: source.name,
          message: "parsed 0 quotes (markup likely changed)",
          kind: "structural",
        });
        continue;
      }
      collected.push(...rows.map((r) => ({ ...r, fetched_at: fetchedAt })));
    } catch (err) {
      failures.push({
        source: source.name,
        message: errorMessage(err),
        kind: classifyFailure(err),
      });
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
  // non-200 nobody would notice the block had quietly frozen. A dealer that
  // timed out through its retry is not that, so it comes back as a warning on a
  // 200 instead - see summarizeRun for the full rule and why it is split.
  const { status, body } = summarizeRun(collected.length, failures);
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
