// Resolves the currently-live stream for each market-news channel on the
// Learning Center's Live tab.
//
// History matters here, because two dead endpoints are the reason this file was
// rewritten. It used to read https://www.youtube.com/feeds/videos.xml, which now
// returns 404 for every channel id including YouTube's own - verified from
// Supabase's own egress IPs, so it is neither a stale channel id nor an IP block.
// YouTube has abandoned open syndication and there are open reports across
// FreshRSS, RSS-Bridge and Google's own developer forum. On failure it fell back
// to embed/live_stream?channel=<id>, which YouTube also retired: that URL still
// answers HTTP 200 but the body reads "unavailable", so the page rendered a
// guaranteed-broken player. Neither is coming back. Do not reinstate either.
//
// Resolution is tiered:
//   1. YouTube Data API v3 - authoritative, but on a hard 10,000 unit/day quota.
//   2. A scrape of /channel/<id>/live - free, undocumented, fails closed.
//   3. Offline, with embedUrl null so the page links out to YouTube instead.
//
// Parsing for both tiers lives in ../_shared/youtube-live.ts, which is pure and
// unit-tested. This file is transport, caching and quota policy only.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildEmbedUrl,
  classifyYouTubeError,
  discoveryBackoffMs,
  extractLiveVideoFromHtml,
  isWithinTtl,
  MAX_DISCOVERIES_PER_DAY,
  parseSearchResponse,
  parseVideoLiveStatus,
  type LiveVideo,
} from "../_shared/youtube-live.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * How long a resolution - live OR offline - is served from cache. Short enough
 * that a stream starting is noticed quickly, long enough that concurrent viewers
 * collapse to one upstream check. The page polls every 120s, so this makes a
 * single viewer cost at most one confirm per minute rather than one per poll.
 */
const CACHE_TTL_MS = 60_000;

/** No single upstream request may hang the whole invocation. */
const REQUEST_TIMEOUT_MS = 10_000;

type ChannelConfig = {
  key: string;
  name: string;
  channelId: string;
  liveUrl: string;
  channelUrl: string;
};

// Both channel ids verified current. Note the @ZeeBusiness handle now redirects
// to /zeebusiness, but externalId is unchanged - so resolution keys on the
// channel id, never on the handle, which is why the redirect costs us nothing.
const CHANNELS: ChannelConfig[] = [
  {
    key: "zee-business",
    name: "Zee Business",
    channelId: "UCkXopQ3ubd-rnXnStZqCl2w",
    liveUrl: "https://www.youtube.com/@ZeeBusiness/live",
    channelUrl: "https://www.youtube.com/@ZeeBusiness",
  },
  {
    key: "cnbc-awaaz",
    name: "CNBC Awaaz",
    channelId: "UCQIycDaLsBpMKjOCeaKUYVg",
    liveUrl: "https://www.youtube.com/@CNBCAwaaz/live",
    channelUrl: "https://www.youtube.com/@CNBCAwaaz",
  },
];

type CacheRow = {
  channel_key: string;
  channel_id: string;
  video_id: string | null;
  is_live: boolean;
  title: string | null;
  resolved_from: string | null;
  checked_at: string | null;
  consecutive_misses: number | null;
  last_discovery_at: string | null;
  discovery_day: string | null;
  discovery_count: number | null;
};

type Resolution = {
  live: LiveVideo | null;
  resolvedFrom: string;
  /** Carried back so the cache row can keep the backoff and quota counters. */
  misses: number;
  discovered: boolean;
  /**
   * Why a tier did not answer, in non-sensitive terms ("auth", "quota",
   * "scrape-http-429", "scrape-no-canonical"). Surfaced in the response because
   * "offline" alone is unactionable: a restricted API key, an exhausted quota and
   * a genuinely off-air channel all look identical from the outside, and the edge
   * runtime's logs are not reachable from the CLI. Never contains the API key or
   * any part of it.
   */
  diagnostic: string | null;
};

const utcDay = (nowMs: number): string => new Date(nowMs).toISOString().slice(0, 10);

/**
 * Google's first error `reason` verbatim, e.g. "accessNotConfigured" (the API is
 * not enabled on the project), "ipRefererBlocked" (the key has an HTTP-referrer
 * restriction, which cannot work from a server), "keyInvalid", or "quotaExceeded".
 *
 * Surfaced because a bare 403 is ambiguous and each of those needs a completely
 * different fix in the Google Cloud console. It is a fixed Google enum, never
 * user data and never any part of the key.
 */
function errorReason(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const error = (payload as Record<string, unknown>).error;
  if (typeof error !== "object" || error === null) return null;
  const errors = (error as Record<string, unknown>).errors;
  if (Array.isArray(errors)) {
    for (const entry of errors) {
      if (entry && typeof entry === "object") {
        const reason = (entry as Record<string, unknown>).reason;
        if (typeof reason === "string" && reason.length > 0) return reason;
      }
    }
  }
  const status = (error as Record<string, unknown>).status;
  return typeof status === "string" && status.length > 0 ? status : null;
}

async function getJson(url: string): Promise<{ status: number; payload: unknown }> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  // A non-2xx body still carries error.errors[].reason, which is what tells
  // quotaExceeded apart from a bad key, so it is parsed either way.
  const payload = await res.json().catch(() => null);
  return { status: res.status, payload };
}

/**
 * The 1-unit call. Confirms a videoId we already know is still streaming, and is
 * what keeps this feature inside its quota on a live channel - it runs on every
 * refresh, where the 100-unit search does not.
 */
async function confirmLive(
  apiKey: string,
  videoId: string,
): Promise<{ live: LiveVideo | null; failed: boolean; kind: string | null }> {
  const url =
    `https://www.googleapis.com/youtube/v3/videos` +
    `?part=snippet,liveStreamingDetails&id=${encodeURIComponent(videoId)}` +
    `&key=${encodeURIComponent(apiKey)}`;
  try {
    const { status, payload } = await getJson(url);
    if (status !== 200) {
      const kind = classifyYouTubeError(status, payload);
      console.error(`youtube videos.list ${status} (${kind}) for ${videoId}`);
      return { live: null, failed: true, kind: `confirm-${kind}-${status}:${errorReason(payload) ?? "unknown"}` };
    }
    // A parse of null here is a real answer - the stream ended - not a failure.
    return { live: parseVideoLiveStatus(payload, videoId), failed: false, kind: null };
  } catch (err) {
    console.error(`youtube videos.list threw for ${videoId}:`, (err as Error).message);
    return { live: null, failed: true, kind: "confirm-threw" };
  }
}

/**
 * The 100-unit call. Only ever reached past the backoff and the daily cap,
 * because at the page's 2-minute poll an unguarded discovery on two off-air
 * channels would spend the entire 10,000/day ceiling overnight.
 */
async function discoverLive(
  apiKey: string,
  channelId: string,
): Promise<{ live: LiveVideo | null; failed: boolean; kind: string | null }> {
  const url =
    `https://www.googleapis.com/youtube/v3/search` +
    `?part=snippet&channelId=${encodeURIComponent(channelId)}` +
    // eventType=live is only valid alongside type=video; omitting type is an error.
    `&eventType=live&type=video&maxResults=1` +
    `&key=${encodeURIComponent(apiKey)}`;
  try {
    const { status, payload } = await getJson(url);
    if (status !== 200) {
      const kind = classifyYouTubeError(status, payload);
      console.error(`youtube search.list ${status} (${kind}) for ${channelId}`);
      return { live: null, failed: true, kind: `search-${kind}-${status}:${errorReason(payload) ?? "unknown"}` };
    }
    return { live: parseSearchResponse(payload), failed: false, kind: null };
  } catch (err) {
    console.error(`youtube search.list threw for ${channelId}:`, (err as Error).message);
    return { live: null, failed: true, kind: "search-threw" };
  }
}

/** Tier 2. Free, undocumented, and fails closed if the markup shifts. */
async function scrapeLive(
  channelId: string,
): Promise<{ live: LiveVideo | null; kind: string | null }> {
  const url = `https://www.youtube.com/channel/${encodeURIComponent(channelId)}/live`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`youtube /live returned HTTP ${res.status} for ${channelId}`);
      return { live: null, kind: `scrape-http-${res.status}` };
    }
    const html = await res.text();
    const live = extractLiveVideoFromHtml(html);
    if (live) return { live, kind: null };
    // Distinguish "page looked fine, channel is off-air" from "we were served
    // something else entirely" - a datacenter IP getting a consent or bot
    // interstitial has no canonical watch link and would otherwise be
    // indistinguishable from an idle channel.
    const hasCanonical = /rel=["']canonical["']/i.test(html);
    const hasWatch = /\/watch\?v=/.test(html);
    return {
      live: null,
      kind: `scrape-miss:len=${html.length},canonical=${hasCanonical},watch=${hasWatch}`,
    };
  } catch (err) {
    console.error(`youtube /live threw for ${channelId}:`, (err as Error).message);
    return { live: null, kind: "scrape-threw" };
  }
}

async function resolveChannel(
  channel: ChannelConfig,
  cached: CacheRow | undefined,
  apiKey: string | null,
  nowMs: number,
): Promise<Resolution> {
  const misses = cached?.consecutive_misses ?? 0;
  const today = utcDay(nowMs);
  const usedToday = cached?.discovery_day === today ? (cached?.discovery_count ?? 0) : 0;

  let apiUnavailable = !apiKey;
  let diagnostic: string | null = apiKey ? null : "no-api-key";

  if (apiKey) {
    // Cheap path first: we already know a videoId, so ask the 1-unit question.
    if (cached?.video_id && cached.is_live) {
      const { live, failed, kind } = await confirmLive(apiKey, cached.video_id);
      if (live) {
        return { live, resolvedFrom: "api", misses: 0, discovered: false, diagnostic: null };
      }
      if (failed) {
        apiUnavailable = true;
        diagnostic = kind;
      }
      // Not failed and not live means the stream genuinely ended - fall through
      // to discovery, which the backoff below may still decline to pay for.
    }

    if (!apiUnavailable) {
      const backoff = discoveryBackoffMs(misses);
      const sinceDiscovery = cached?.last_discovery_at
        ? nowMs - Date.parse(cached.last_discovery_at)
        : Number.POSITIVE_INFINITY;
      const withinBackoff = Number.isFinite(sinceDiscovery) && sinceDiscovery < backoff;
      const capReached = usedToday >= MAX_DISCOVERIES_PER_DAY;

      if (capReached) {
        console.error(
          `youtube discovery cap reached for ${channel.key} (${usedToday} today); serving offline`,
        );
      }

      if (!withinBackoff && !capReached) {
        const { live, failed, kind } = await discoverLive(apiKey, channel.channelId);
        if (live) {
          return { live, resolvedFrom: "api", misses: 0, discovered: true, diagnostic: null };
        }
        if (failed) {
          apiUnavailable = true;
          diagnostic = kind;
        } else {
          return {
            live: null,
            resolvedFrom: "api",
            misses: misses + 1,
            discovered: true,
            diagnostic: "api-says-offline",
          };
        }
      } else if (!withinBackoff && capReached) {
        // Cap, not backoff, is what stopped us - do not let it look like a miss.
        return {
          live: null,
          resolvedFrom: "api-capped",
          misses,
          discovered: false,
          diagnostic: `discovery-cap-${usedToday}`,
        };
      } else {
        return {
          live: null,
          resolvedFrom: "api-backoff",
          misses,
          discovered: false,
          diagnostic: `backoff-${Math.round(backoff / 1000)}s`,
        };
      }
    }
  }

  // Tier 2. Reached only when the API could not answer at all: no key, blown
  // quota, or an upstream error. A quota-exhausted day therefore still serves a
  // working player rather than going dark, which is the whole point of having it.
  if (apiUnavailable) {
    const { live, kind } = await scrapeLive(channel.channelId);
    if (live) {
      return { live, resolvedFrom: "scrape", misses: 0, discovered: false, diagnostic };
    }
    return {
      live: null,
      resolvedFrom: "scrape",
      misses: misses + 1,
      discovered: false,
      // Both tiers' reasons, because "offline" with a working key and a working
      // scrape means something very different from "offline" because the key is
      // rejected and YouTube served us an interstitial.
      diagnostic: [diagnostic, kind].filter(Boolean).join(" | ") || null,
    };
  }

  return {
    live: null,
    resolvedFrom: "offline",
    misses: misses + 1,
    discovered: false,
    diagnostic,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const apiKey = Deno.env.get("YOUTUBE_API_KEY") ?? null;
  if (!apiKey) {
    // Deliberately not a 500 and deliberately not naming the variable to the
    // client: a missing key degrades to the scraper, and the operator needs the
    // detail, not the browser.
    console.error("YOUTUBE_API_KEY is not set; resolving via fallback only");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const nowMs = Date.now();
  const fetchedAt = new Date(nowMs).toISOString();

  const { data: cacheRows, error: cacheErr } = await supabase
    .from("live_broadcast_cache")
    .select(
      "channel_key, channel_id, video_id, is_live, title, resolved_from, checked_at, consecutive_misses, last_discovery_at, discovery_day, discovery_count",
    );
  // postgrest-js RESOLVES with an error rather than throwing, so this must be
  // read explicitly - a try/catch would never fire. A failed read is survivable
  // (we just resolve fresh) but it means every request costs quota, so it is
  // logged loudly rather than swallowed.
  if (cacheErr) {
    console.error("live_broadcast_cache read failed:", cacheErr.message);
  }

  const byKey = new Map<string, CacheRow>(
    (cacheRows ?? []).map((r) => [r.channel_key, r as CacheRow]),
  );

  const channels = await Promise.all(
    CHANNELS.map(async (channel) => {
      const cached = byKey.get(channel.key);

      // Serve a fresh cache row without touching YouTube at all. This is what
      // collapses concurrent viewers into one upstream check per TTL.
      if (cached && isWithinTtl(cached.checked_at, nowMs, CACHE_TTL_MS)) {
        const videoId = cached.is_live ? cached.video_id : null;
        return {
          ...channel,
          status: videoId ? "ok" : "offline",
          videoId,
          title: cached.title,
          embedUrl: videoId ? buildEmbedUrl(videoId) : null,
          watchUrl: channel.liveUrl,
          resolvedFrom: cached.resolved_from ? `${cached.resolved_from}-cached` : "cached",
        };
      }

      let resolution: Resolution;
      try {
        resolution = await resolveChannel(channel, cached, apiKey, nowMs);
      } catch (err) {
        // One channel must never take the other down.
        console.error(`resolution threw for ${channel.key}:`, (err as Error).message);
        resolution = {
          live: null,
          resolvedFrom: "error",
          misses: (cached?.consecutive_misses ?? 0) + 1,
          discovered: false,
          diagnostic: "resolution-threw",
        };
      }

      const today = utcDay(nowMs);
      const usedToday = cached?.discovery_day === today ? (cached?.discovery_count ?? 0) : 0;

      const { error: writeErr } = await supabase.from("live_broadcast_cache").upsert(
        {
          channel_key: channel.key,
          channel_id: channel.channelId,
          video_id: resolution.live?.videoId ?? null,
          is_live: resolution.live !== null,
          title: resolution.live?.title ?? null,
          resolved_from: resolution.resolvedFrom,
          checked_at: new Date(nowMs).toISOString(),
          consecutive_misses: resolution.misses,
          last_discovery_at: resolution.discovered
            ? new Date(nowMs).toISOString()
            : (cached?.last_discovery_at ?? null),
          discovery_day: today,
          discovery_count: usedToday + (resolution.discovered ? 1 : 0),
          updated_at: new Date(nowMs).toISOString(),
        },
        { onConflict: "channel_key" },
      );
      // Loud, because a cache that never persists means every single request pays
      // 100 units and the daily quota is gone within the hour.
      if (writeErr) {
        console.error(`live_broadcast_cache write failed for ${channel.key}:`, writeErr.message);
      }

      const videoId = resolution.live?.videoId ?? null;
      return {
        ...channel,
        status: videoId ? "ok" : "offline",
        videoId,
        title: resolution.live?.title ?? null,
        // Null when not live. The retired embed/live_stream?channel= form is
        // never emitted again - it was the guaranteed-broken player.
        embedUrl: videoId ? buildEmbedUrl(videoId) : null,
        watchUrl: channel.liveUrl,
        resolvedFrom: resolution.resolvedFrom,
        diagnostic: resolution.diagnostic,
      };
    }),
  );

  return new Response(JSON.stringify({ success: true, channels, fetchedAt }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
