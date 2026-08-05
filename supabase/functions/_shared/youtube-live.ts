/**
 * Live-broadcast resolution, pure half.
 *
 * Two independent resolvers live here because the Live TV section resolves in
 * tiers: the YouTube Data API v3 first (authoritative, but on a hard 10,000
 * unit/day quota), then a scrape of the channel's /live page when the API
 * cannot answer at all. Both are pure so vitest can import them directly -
 * no Deno globals, no npm: imports, no fetch. Transport and caching live in
 * fetch-live-broadcasts/index.ts.
 *
 * The rule both resolvers enforce, and the reason this file is tested as
 * heavily as it is: a video is "live" only when the source affirmatively says
 * so in the response being parsed. Neither endpoint fails loudly when a channel
 * is off-air. The API happily returns the newest upload with
 * liveBroadcastContent: "none", and youtube.com/channel/<id>/live returns HTTP
 * 200 serving the newest upload rather than a 404. So in both cases a videoId
 * is present and looks perfectly valid while being a day-old recording.
 * Presenting that recording as a live broadcast is the worst outcome available
 * here - strictly worse than showing nothing, because a reader cannot tell -
 * so absence of an affirmative live signal is treated as "not live" even when a
 * videoId was found. "upcoming" is not live either: a scheduled premiere has no
 * stream to play.
 */

export type LiveVideo = {
  videoId: string;
  title: string | null;
};

/**
 * Why quota is its own kind: it is a daily ceiling, not a fault. A blown quota
 * means fall through to the scraper and keep serving; an auth failure means the
 * key is wrong and scraping is also the right move, but the operator needs a
 * different log line. Collapsing them would hide a misconfigured key behind
 * what looks like ordinary quota pressure.
 */
export type YouTubeErrorKind = "quota" | "auth" | "server" | "unknown";

/** A YouTube video id is exactly 11 characters of base64url. */
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const DISCOVERY_BACKOFF_BASE_MS = 5 * 60_000;
export const DISCOVERY_BACKOFF_CAP_MS = 60 * 60_000;

/**
 * Hard backstop on the 100-unit search.list call, per channel per UTC day.
 * The exponential backoff already holds a full off-air day to ~27 calls; this
 * only catches a pathological loop (a cache row that never persists, a clock
 * jumping backwards) that would otherwise drain the day's quota in minutes.
 */
export const MAX_DISCOVERIES_PER_DAY = 40;

const QUOTA_REASONS = new Set([
  "quotaExceeded",
  "rateLimitExceeded",
  "userRateLimitExceeded",
  "dailyLimitExceeded",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The API returns titles HTML-escaped ("Nifty &amp; Sensex"). "&amp;" is
 * decoded last so a double-encoded entity is not unescaped twice in one pass.
 */
// Written as global regexes rather than String.replaceAll: this module is
// imported by the Vitest suite under tsconfig.app.json, whose lib target predates
// ES2021, so replaceAll does not typecheck there even though Deno supports it.
const decodeEntities = (value: string): string =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

/** The scraped page carries JSON string escapes instead ("Nifty \u0026 Sensex"). */
const decodeJsonStringEscapes = (value: string): string =>
  value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/\\"/g, '"')
    .replace(/\\\//g, "/")
    .replace(/\\n/g, "\n")
    .replace(/\\\\/g, "\\");

export const isValidVideoId = (value: unknown): boolean =>
  typeof value === "string" && VIDEO_ID_PATTERN.test(value);

const readTitle = (
  source: Record<string, unknown>,
  decode: (value: string) => string,
): string | null => {
  const title = source.title;
  if (typeof title !== "string" || title.length === 0) return null;
  return decode(title);
};

/**
 * Tier 1, discovery: parse a `search.list?eventType=live&type=video` response.
 *
 * eventType=live is supposed to make every item live, but that is the server's
 * promise about a query, not a property of the bytes in front of us. This
 * re-checks liveBroadcastContent per item so a changed default, a cached
 * response, or a hand-built URL cannot get a recording past the guard.
 */
export const parseSearchResponse = (payload: unknown): LiveVideo | null => {
  if (!isRecord(payload) || !Array.isArray(payload.items)) return null;

  for (const item of payload.items) {
    if (!isRecord(item)) continue;

    const id = item.id;
    if (!isRecord(id)) continue;
    // Search returns channels and playlists too; only a video can be embedded.
    if (typeof id.kind === "string" && id.kind !== "youtube#video") continue;
    if (!isValidVideoId(id.videoId)) continue;

    const snippet = isRecord(item.snippet) ? item.snippet : null;
    if (snippet?.liveBroadcastContent !== "live") continue;

    return { videoId: id.videoId as string, title: readTitle(snippet, decodeEntities) };
  }

  return null;
};

/**
 * Tier 1, confirmation: parse a `videos.list?part=snippet,liveStreamingDetails`
 * response for one already-known videoId. This is the 1-unit call that keeps
 * the feature inside its quota, so it runs on every refresh of a live channel.
 *
 * `expectedVideoId` is matched against the returned item rather than trusted:
 * the answer must be about the video we asked about, or the cached id could be
 * confirmed "live" by a response describing something else entirely.
 */
export const parseVideoLiveStatus = (
  payload: unknown,
  expectedVideoId: string,
): LiveVideo | null => {
  if (!isValidVideoId(expectedVideoId)) return null;
  if (!isRecord(payload) || !Array.isArray(payload.items)) return null;

  const item = payload.items.find(
    (candidate) => isRecord(candidate) && candidate.id === expectedVideoId,
  );
  if (!isRecord(item)) return null;

  const snippet = isRecord(item.snippet) ? item.snippet : null;
  if (snippet?.liveBroadcastContent !== "live") return null;

  // A finished stream keeps liveBroadcastContent flipped to "none", but the
  // transition is not instant and the recording stays at the same id. An
  // actualEndTime is the unambiguous statement that the stream is over, so it
  // wins over the flag rather than being a redundant second opinion.
  const details = isRecord(item.liveStreamingDetails) ? item.liveStreamingDetails : null;
  if (typeof details?.actualEndTime === "string" && details.actualEndTime.length > 0) {
    return null;
  }

  return { videoId: expectedVideoId, title: readTitle(snippet ?? {}, decodeEntities) };
};

/** Classify an API failure so the caller can pick fall-through vs. hard failure. */
export const classifyYouTubeError = (status: number, payload: unknown): YouTubeErrorKind => {
  if (status === 429) return "quota";

  const error = isRecord(payload) && isRecord(payload.error) ? payload.error : null;
  const errors = error && Array.isArray(error.errors) ? error.errors : [];
  const hasQuotaReason = errors.some(
    (entry) =>
      isRecord(entry) && typeof entry.reason === "string" && QUOTA_REASONS.has(entry.reason),
  );
  if (hasQuotaReason) return "quota";

  if (status === 400 || status === 401 || status === 403) return "auth";
  if (status >= 500) return "server";
  return "unknown";
};

/**
 * How long to wait before paying for another 100-unit discovery search after
 * consecutive misses: 5, 10, 20, 40 minutes, then hourly.
 *
 * This function is the reason the feature survives its own quota. Discovery at
 * the frontend's 2-minute poll would be 30 searches/hour/channel = 3,000
 * units/hour, so two off-air channels would exhaust the entire 10,000/day
 * ceiling in well under two hours - overnight, before anyone is watching. The
 * cap keeps the worst case near 27 searches/channel/day while still noticing a
 * stream that starts within the hour.
 */
export const discoveryBackoffMs = (consecutiveFailures: number): number => {
  if (!Number.isFinite(consecutiveFailures) || consecutiveFailures < 1) return 0;
  const doublings = Math.min(Math.floor(consecutiveFailures), 5) - 1;
  return Math.min(DISCOVERY_BACKOFF_BASE_MS * 2 ** doublings, DISCOVERY_BACKOFF_CAP_MS);
};

/**
 * Server-side freshness check for the shared cache row. A burst of concurrent
 * viewers collapses to one upstream check per TTL instead of one per request.
 * A future timestamp counts as fresh: clock skew between the database and the
 * edge runtime should slow us down, never turn into a hammering loop.
 */
export const isWithinTtl = (checkedAt: string | null, nowMs: number, ttlMs: number): boolean => {
  if (typeof checkedAt !== "string" || checkedAt.length === 0) return false;
  const checked = Date.parse(checkedAt);
  if (Number.isNaN(checked)) return false;
  if (checked > nowMs) return true;
  return nowMs - checked < ttlMs;
};

/**
 * The only embed form that works. `embed/live_stream?channel=<id>` is retired -
 * it still answers HTTP 200 but the body says "unavailable", which is why the
 * old fallback rendered a guaranteed-broken player. autoplay stays 0; the page
 * adds autoplay only after the reader clicks play.
 */
export const buildEmbedUrl = (videoId: string): string | null =>
  isValidVideoId(videoId) ? `https://www.youtube.com/embed/${videoId}?autoplay=0` : null;

const CANONICAL_LINK_TAG = /<link[^>]*rel=["']canonical["'][^>]*>/i;
const HREF_ATTRIBUTE = /href=["']([^"']+)["']/i;
const WATCH_VIDEO_PARAM = /[?&]v=([^&"']*)/;

/**
 * Verified across a live/offline control: `"isLive":true` occurs twice on a
 * genuinely live /channel/<id>/live page and zero times when the channel is
 * off-air. `isLiveNow` is accepted as an alternative because the @handle/live
 * form emits it, but it must never be *required* - it is absent from the
 * /channel/<id>/live responses even while those channels are live.
 */
const LIVE_FLAG_PATTERN = /"(?:isLive|isLiveNow)"\s*:\s*true/;

const VIDEO_DETAILS_ANCHOR = /"videoDetails"\s*:\s*\{/g;
const VIDEO_DETAILS_WINDOW = 4000;
const SCRAPED_VIDEO_ID_PATTERN = /"videoId"\s*:\s*"([^"]*)"/;
const SCRAPED_TITLE_PATTERN = /"title"\s*:\s*"((?:\\.|[^"\\])*)"/;
const META_TITLE_PATTERN = /<meta[^>]*name=["']title["'][^>]*content=["']([^"']*)["']/i;

/** Pull the title out of the player block describing this exact videoId. */
const findScrapedTitle = (html: string, videoId: string): string | null => {
  VIDEO_DETAILS_ANCHOR.lastIndex = 0;
  for (const match of html.matchAll(VIDEO_DETAILS_ANCHOR)) {
    if (typeof match.index !== "number") continue;
    const block = html.slice(match.index, match.index + VIDEO_DETAILS_WINDOW);
    if (block.match(SCRAPED_VIDEO_ID_PATTERN)?.[1] !== videoId) continue;
    const rawTitle = block.match(SCRAPED_TITLE_PATTERN)?.[1];
    if (rawTitle) return decodeJsonStringEscapes(rawTitle);
  }

  const metaTitle = html.match(META_TITLE_PATTERN)?.[1];
  return metaTitle ? decodeEntities(metaTitle) : null;
};

/**
 * Tier 2: extract the live video from the HTML of /channel/<id>/live.
 *
 * Used only when tier 1 could not answer at all (no API key, blown quota,
 * upstream error). Requires BOTH verified signals, because either one alone is
 * unsafe:
 *
 * 1. The canonical link must be a watch?v=<id> URL. When the channel is off-air
 *    /live still returns HTTP 200, but canonical points at the channel URL
 *    instead - confirmed against a real non-live channel. This is the cleanest
 *    discriminator available.
 * 2. A live flag must be present in the body.
 *
 * The videoId comes from the canonical link and nowhere else. A bare watch?v=
 * grep is the trap: an off-air page is full of links to the channel's other
 * uploads, so a grep returns a real, valid, 11-character id belonging to
 * yesterday's recording, and the page then presents that recording as a live
 * broadcast. The canonical link is singular and authoritative.
 *
 * `hqdefault_live.jpg` is deliberately not used as a marker despite being
 * popular in third-party projects: it was tested and has zero occurrences on
 * both live channels, on both the channel page and the /live page.
 *
 * This whole tier is undocumented markup and can change without notice, so it
 * fails closed - if the shape changes, every channel reads offline and the page
 * links out to YouTube, which is honest. If it proves flaky in practice the
 * documented upgrade path is an InnerTube client (deno.land/x/youtubei);
 * rejected for now as a heavy dependency that trades one undocumented surface
 * for another.
 */
export const extractLiveVideoFromHtml = (html: unknown): LiveVideo | null => {
  if (typeof html !== "string" || html.length === 0) return null;

  const canonicalTag = html.match(CANONICAL_LINK_TAG)?.[0];
  if (!canonicalTag) return null;

  const canonicalHref = canonicalTag.match(HREF_ATTRIBUTE)?.[1];
  if (!canonicalHref || !canonicalHref.includes("/watch")) return null;

  // Captured loosely, then validated - a 14-character id must be rejected, not
  // silently truncated to its first 11 characters.
  const videoId = canonicalHref.match(WATCH_VIDEO_PARAM)?.[1];
  if (!isValidVideoId(videoId)) return null;

  if (!LIVE_FLAG_PATTERN.test(html)) return null;

  return { videoId: videoId as string, title: findScrapedTitle(html, videoId as string) };
};
