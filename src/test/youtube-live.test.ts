import { describe, it, expect } from "vitest";
import {
  buildEmbedUrl,
  classifyYouTubeError,
  DISCOVERY_BACKOFF_CAP_MS,
  discoveryBackoffMs,
  extractLiveVideoFromHtml,
  isValidVideoId,
  isWithinTtl,
  MAX_DISCOVERIES_PER_DAY,
  parseSearchResponse,
  parseVideoLiveStatus,
} from "../../supabase/functions/_shared/youtube-live";

// The single rule these tests exist to enforce: nothing is called "live" unless
// the API says so in this response. A day-old recording (or a scheduled
// premiere) presented as a live broadcast is worse than showing nothing.

const liveSearchResponse = {
  kind: "youtube#searchListResponse",
  items: [
    {
      kind: "youtube#searchResult",
      id: { kind: "youtube#video", videoId: "MayfgRt6rX8" },
      snippet: {
        channelId: "UCQIycDaLsBpMKjOCeaKUYVg",
        title: "Share Market LIVE &amp; Nifty Today",
        liveBroadcastContent: "live",
      },
    },
  ],
};

const liveVideosResponse = {
  kind: "youtube#videoListResponse",
  items: [
    {
      kind: "youtube#video",
      id: "MayfgRt6rX8",
      snippet: { title: "Share Market LIVE", liveBroadcastContent: "live" },
      liveStreamingDetails: {
        actualStartTime: "2026-08-05T03:45:00Z",
        concurrentViewers: "1842",
      },
    },
  ],
};

describe("isValidVideoId", () => {
  it("accepts exactly 11 legal characters", () => {
    expect(isValidVideoId("MayfgRt6rX8")).toBe(true);
    expect(isValidVideoId("_-aA09zZbY1")).toBe(true);
  });

  it("rejects wrong lengths, illegal characters, and non-strings", () => {
    expect(isValidVideoId("abc123")).toBe(false);
    expect(isValidVideoId("MayfgRt6rX8XYZ")).toBe(false);
    expect(isValidVideoId("Mayfg!t6rX8")).toBe(false);
    expect(isValidVideoId("")).toBe(false);
    expect(isValidVideoId(null)).toBe(false);
    expect(isValidVideoId(42)).toBe(false);
  });
});

describe("parseSearchResponse", () => {
  it("returns the videoId of a live search hit", () => {
    expect(parseSearchResponse(liveSearchResponse)?.videoId).toBe("MayfgRt6rX8");
  });

  it("decodes HTML entities in the title", () => {
    expect(parseSearchResponse(liveSearchResponse)?.title).toBe("Share Market LIVE & Nifty Today");
  });

  // A scheduled premiere is not a live broadcast.
  it("returns null for an upcoming broadcast", () => {
    const payload = {
      items: [
        {
          id: { kind: "youtube#video", videoId: "MayfgRt6rX8" },
          snippet: { title: "Budget special - starts 5pm", liveBroadcastContent: "upcoming" },
        },
      ],
    };
    expect(parseSearchResponse(payload)).toBeNull();
  });

  // THE stale-video guard on the discovery path.
  it("returns null when liveBroadcastContent is none", () => {
    const payload = {
      items: [
        {
          id: { kind: "youtube#video", videoId: "dQw4w9WgXcQ" },
          snippet: { title: "Yesterday's Closing Bell", liveBroadcastContent: "none" },
        },
      ],
    };
    expect(parseSearchResponse(payload)).toBeNull();
  });

  it("returns null when the live flag is absent rather than assuming live", () => {
    const payload = {
      items: [{ id: { kind: "youtube#video", videoId: "MayfgRt6rX8" }, snippet: { title: "Market" } }],
    };
    expect(parseSearchResponse(payload)).toBeNull();
  });

  it("ignores non-video search results", () => {
    const payload = {
      items: [
        {
          id: { kind: "youtube#channel", channelId: "UCQIycDaLsBpMKjOCeaKUYVg" },
          snippet: { title: "CNBC Awaaz", liveBroadcastContent: "live" },
        },
      ],
    };
    expect(parseSearchResponse(payload)).toBeNull();
  });

  it("skips an upcoming item and still finds a later live one", () => {
    const payload = {
      items: [
        {
          id: { kind: "youtube#video", videoId: "dQw4w9WgXcQ" },
          snippet: { title: "Premiere", liveBroadcastContent: "upcoming" },
        },
        {
          id: { kind: "youtube#video", videoId: "MayfgRt6rX8" },
          snippet: { title: "Market Live", liveBroadcastContent: "live" },
        },
      ],
    };
    expect(parseSearchResponse(payload)?.videoId).toBe("MayfgRt6rX8");
  });

  it("returns null for a malformed videoId even when the item says live", () => {
    const short = {
      items: [{ id: { kind: "youtube#video", videoId: "abc123" }, snippet: { liveBroadcastContent: "live" } }],
    };
    const long = {
      items: [
        { id: { kind: "youtube#video", videoId: "MayfgRt6rX8XYZ" }, snippet: { liveBroadcastContent: "live" } },
      ],
    };
    expect(parseSearchResponse(short)).toBeNull();
    expect(parseSearchResponse(long)).toBeNull();
  });

  it("returns null for empty, missing, and garbage payloads", () => {
    expect(parseSearchResponse({ items: [] })).toBeNull();
    expect(parseSearchResponse({})).toBeNull();
    expect(parseSearchResponse(null)).toBeNull();
    expect(parseSearchResponse(undefined)).toBeNull();
    expect(parseSearchResponse("not json")).toBeNull();
    expect(parseSearchResponse({ items: "nope" })).toBeNull();
  });

  it("returns a null title rather than failing when the title is missing", () => {
    const payload = {
      items: [{ id: { kind: "youtube#video", videoId: "MayfgRt6rX8" }, snippet: { liveBroadcastContent: "live" } }],
    };
    expect(parseSearchResponse(payload)).toEqual({ videoId: "MayfgRt6rX8", title: null });
  });
});

describe("parseVideoLiveStatus", () => {
  it("confirms a still-live cached video", () => {
    const result = parseVideoLiveStatus(liveVideosResponse, "MayfgRt6rX8");
    expect(result).toEqual({ videoId: "MayfgRt6rX8", title: "Share Market LIVE" });
  });

  // THE stale-video guard on the cheap confirmation path: the stream we cached
  // has ended, so the cached videoId is now a recording.
  it("returns null once the video is no longer live", () => {
    const payload = {
      items: [
        {
          id: "MayfgRt6rX8",
          snippet: { title: "Share Market LIVE", liveBroadcastContent: "none" },
          liveStreamingDetails: { actualStartTime: "2026-08-05T03:45:00Z", actualEndTime: "2026-08-05T10:00:00Z" },
        },
      ],
    };
    expect(parseVideoLiveStatus(payload, "MayfgRt6rX8")).toBeNull();
  });

  it("returns null when the broadcast has an end time even if the flag still says live", () => {
    const payload = {
      items: [
        {
          id: "MayfgRt6rX8",
          snippet: { title: "Share Market LIVE", liveBroadcastContent: "live" },
          liveStreamingDetails: { actualEndTime: "2026-08-05T10:00:00Z" },
        },
      ],
    };
    expect(parseVideoLiveStatus(payload, "MayfgRt6rX8")).toBeNull();
  });

  it("returns null for an upcoming broadcast", () => {
    const payload = {
      items: [{ id: "MayfgRt6rX8", snippet: { title: "Premiere", liveBroadcastContent: "upcoming" } }],
    };
    expect(parseVideoLiveStatus(payload, "MayfgRt6rX8")).toBeNull();
  });

  it("returns null when the video is gone (empty items)", () => {
    expect(parseVideoLiveStatus({ items: [] }, "MayfgRt6rX8")).toBeNull();
  });

  it("returns null when the response is about a different video than we asked for", () => {
    expect(parseVideoLiveStatus(liveVideosResponse, "dQw4w9WgXcQ")).toBeNull();
  });

  it("returns null when the expected id is itself malformed", () => {
    expect(parseVideoLiveStatus(liveVideosResponse, "abc")).toBeNull();
    expect(parseVideoLiveStatus(liveVideosResponse, "")).toBeNull();
  });

  it("returns null for garbage payloads", () => {
    expect(parseVideoLiveStatus(null, "MayfgRt6rX8")).toBeNull();
    expect(parseVideoLiveStatus({}, "MayfgRt6rX8")).toBeNull();
    expect(parseVideoLiveStatus("<html>", "MayfgRt6rX8")).toBeNull();
  });
});

describe("classifyYouTubeError", () => {
  const errorBody = (reason: string, code = 403) => ({
    error: { code, message: "The request cannot be completed.", errors: [{ domain: "youtube.quota", reason }] },
  });

  it("classifies every quota and rate-limit reason as quota", () => {
    expect(classifyYouTubeError(403, errorBody("quotaExceeded"))).toBe("quota");
    expect(classifyYouTubeError(403, errorBody("rateLimitExceeded"))).toBe("quota");
    expect(classifyYouTubeError(403, errorBody("userRateLimitExceeded"))).toBe("quota");
    expect(classifyYouTubeError(403, errorBody("dailyLimitExceeded"))).toBe("quota");
    expect(classifyYouTubeError(429, {})).toBe("quota");
  });

  it("keeps a real authorization failure distinct from a blown quota", () => {
    expect(classifyYouTubeError(403, errorBody("forbidden"))).toBe("auth");
    expect(classifyYouTubeError(400, errorBody("keyInvalid", 400))).toBe("auth");
    expect(classifyYouTubeError(401, {})).toBe("auth");
  });

  it("classifies upstream faults as server errors", () => {
    expect(classifyYouTubeError(500, {})).toBe("server");
    expect(classifyYouTubeError(503, null)).toBe("server");
  });

  it("falls back to unknown for anything else", () => {
    expect(classifyYouTubeError(404, {})).toBe("unknown");
    expect(classifyYouTubeError(418, "teapot")).toBe("unknown");
  });
});

describe("discoveryBackoffMs", () => {
  // Discovery is the 100-unit call. An off-air channel must not keep paying it
  // every 2 minutes, or the daily quota is gone before the market opens.
  it("allows an immediate first probe", () => {
    expect(discoveryBackoffMs(0)).toBe(0);
  });

  it("backs off exponentially after consecutive misses", () => {
    expect(discoveryBackoffMs(1)).toBe(5 * 60_000);
    expect(discoveryBackoffMs(2)).toBe(10 * 60_000);
    expect(discoveryBackoffMs(3)).toBe(20 * 60_000);
    expect(discoveryBackoffMs(4)).toBe(40 * 60_000);
  });

  it("caps the backoff so a stream starting is still noticed", () => {
    expect(discoveryBackoffMs(5)).toBe(DISCOVERY_BACKOFF_CAP_MS);
    expect(discoveryBackoffMs(50)).toBe(DISCOVERY_BACKOFF_CAP_MS);
    expect(DISCOVERY_BACKOFF_CAP_MS).toBe(60 * 60_000);
  });

  it("treats nonsense failure counts as no backoff rather than NaN", () => {
    expect(discoveryBackoffMs(-3)).toBe(0);
    expect(discoveryBackoffMs(Number.NaN)).toBe(0);
  });

  // The arithmetic that keeps the feature alive: worst case is an off-air
  // channel probed for a full day. 5+10+20+40 min then hourly.
  it("keeps a full off-air day under 30 discovery calls per channel", () => {
    const day = 24 * 60 * 60_000;
    let elapsed = 0;
    let calls = 0;
    // Bounded loop on purpose: a backoff that never advances must fail this
    // assertion, not hang the test run.
    for (let attempt = 1; attempt <= 500 && elapsed < day; attempt += 1) {
      elapsed += discoveryBackoffMs(attempt);
      calls = attempt;
    }
    expect(elapsed).toBeGreaterThanOrEqual(day);
    expect(calls).toBeLessThanOrEqual(30);
  });

  // The hard backstop exists to stop a pathological retry loop, so it has to sit
  // above the natural worst case - otherwise it would start cutting off normal
  // off-air probing and the feature would go dark for reasons nobody expects.
  it("sets the daily discovery backstop above the natural worst case", () => {
    expect(MAX_DISCOVERIES_PER_DAY).toBeGreaterThan(30);
    // 2 channels x backstop x 100 units must still leave room for confirmations.
    expect(2 * MAX_DISCOVERIES_PER_DAY * 100).toBeLessThan(9_000);
  });
});

describe("isWithinTtl", () => {
  const now = Date.parse("2026-08-05T10:00:00Z");

  it("treats a recent check as fresh", () => {
    expect(isWithinTtl("2026-08-05T09:59:30Z", now, 45_000)).toBe(true);
  });

  it("treats an expired check as stale", () => {
    expect(isWithinTtl("2026-08-05T09:58:00Z", now, 45_000)).toBe(false);
  });

  it("treats a future timestamp as fresh so clock skew cannot cause hammering", () => {
    expect(isWithinTtl("2026-08-05T10:00:30Z", now, 45_000)).toBe(true);
  });

  it("treats missing or unparseable timestamps as stale", () => {
    expect(isWithinTtl(null, now, 45_000)).toBe(false);
    expect(isWithinTtl("", now, 45_000)).toBe(false);
    expect(isWithinTtl("not a date", now, 45_000)).toBe(false);
  });
});

describe("buildEmbedUrl", () => {
  it("builds a plain embed URL that does not autoplay", () => {
    expect(buildEmbedUrl("MayfgRt6rX8")).toBe("https://www.youtube.com/embed/MayfgRt6rX8?autoplay=0");
  });

  it("refuses to build a URL from an invalid id", () => {
    expect(buildEmbedUrl("abc")).toBeNull();
    expect(buildEmbedUrl("")).toBeNull();
  });

  it("never produces the retired live_stream embed form", () => {
    expect(buildEmbedUrl("MayfgRt6rX8")).not.toContain("live_stream");
  });
});

// ---------------------------------------------------------------------------
// Tier 2: the scraper. /live does NOT 404 when a channel is off-air - it serves
// the channel page or the newest upload - so the stale-video guard has to be
// just as strict here as it is on the API path above.
// ---------------------------------------------------------------------------

// Both fixtures follow the shape verified against real fetches of
// /channel/<id>/live, including an offline control (YouTube's own channel).
// Live: canonical points at watch?v=<id>, and "isLive":true is present.
// Offline: HTTP 200 all the same, but canonical points at the CHANNEL url and
// "isLive":true has zero occurrences.
const liveHtml = `
<!doctype html><html><head><title>CNBC Awaaz - YouTube</title>
<link rel="canonical" href="https://www.youtube.com/watch?v=MayfgRt6rX8"></head><body>
<script>var ytInitialPlayerResponse = {"responseContext":{},"playabilityStatus":{"status":"OK"},
"streamingData":{},"videoDetails":{"videoId":"MayfgRt6rX8","title":"Share Market LIVE \\u0026 Nifty Today","lengthSeconds":"0","isLive":true,"keywords":["market live"],"channelId":"UCQIycDaLsBpMKjOCeaKUYVg","isLiveContent":true}};</script>
<a href="/watch?v=dQw4w9WgXcQ">An older upload</a>
</body></html>`;

// The fixture that catches the stale-video bug: videoIds are absolutely
// findable in this body, and a bare watch?v= grep would return one of them.
const offlineHtml = `
<!doctype html><html><head><title>CNBC Awaaz - YouTube</title>
<link rel="canonical" href="https://www.youtube.com/channel/UCQIycDaLsBpMKjOCeaKUYVg"></head><body>
<script>var ytInitialData = {"contents":{"videoDetails":{"videoId":"dQw4w9WgXcQ","title":"Yesterday's Closing Bell","lengthSeconds":"2841","isLiveContent":false}}};</script>
<a href="/watch?v=dQw4w9WgXcQ">Closing Bell</a>
<a href="/watch?v=aBcDeFgHiJk">Older upload</a>
<a href="https://www.youtube.com/watch?v=ZZZZZZZZZZZ">Another upload</a>
</body></html>`;

describe("extractLiveVideoFromHtml", () => {
  it("returns the canonical videoId when the page is live", () => {
    expect(extractLiveVideoFromHtml(liveHtml)?.videoId).toBe("MayfgRt6rX8");
  });

  it("decodes the title out of the player response", () => {
    expect(extractLiveVideoFromHtml(liveHtml)?.title).toBe("Share Market LIVE & Nifty Today");
  });

  // THE stale-video guard, tier 2, on the real offline page shape. /live answers
  // HTTP 200 when off-air, so this body is what a naive grep turns into "live".
  it("returns null for an off-air page whose canonical points at the channel", () => {
    expect(extractLiveVideoFromHtml(offlineHtml)).toBeNull();
  });

  it("never returns a videoId that only appears in a page link", () => {
    const result = extractLiveVideoFromHtml(offlineHtml);
    expect(result).toBeNull();
    // dQw4w9WgXcQ is the first watch?v= match in the body. A bare grep would
    // have returned it and presented yesterday's recording as a live broadcast.
    expect(offlineHtml).toContain("watch?v=dQw4w9WgXcQ");
  });

  it("requires a live flag as well as a video canonical", () => {
    // Canonical says a video, but nothing on the page claims it is live.
    const html = liveHtml.replace('"isLive":true', '"isLive":false');
    expect(extractLiveVideoFromHtml(html)).toBeNull();
  });

  it("does not treat isLiveContent as a live flag", () => {
    // isLiveContent stays true forever on the recording of a finished stream.
    const html = `<link rel="canonical" href="https://www.youtube.com/watch?v=MayfgRt6rX8">
      {"videoDetails":{"videoId":"MayfgRt6rX8","title":"Yesterday's stream","isLiveContent":true}}`;
    expect(extractLiveVideoFromHtml(html)).toBeNull();
  });

  // Verified absent from /channel/<id>/live even while live, so it must never be
  // required - but it is present on the @handle/live form, so it still counts.
  it("accepts isLiveNow as an alternative live flag", () => {
    const html = `<link rel="canonical" href="https://www.youtube.com/watch?v=MayfgRt6rX8">
      {"liveBroadcastDetails":{"isLiveNow":true}}`;
    expect(extractLiveVideoFromHtml(html)?.videoId).toBe("MayfgRt6rX8");
  });

  it("ignores a live flag belonging to some other video when canonical is a channel", () => {
    // A channel page's shelves carry live flags for unrelated streams.
    const html = `<link rel="canonical" href="https://www.youtube.com/channel/UCQIycDaLsBpMKjOCeaKUYVg">
      <a href="/watch?v=dQw4w9WgXcQ">Upload</a>
      {"gridVideoRenderer":{"videoId":"ZZZZZZZZZZZ","isLive":true,"ownerText":"Some Other Channel"}}`;
    expect(extractLiveVideoFromHtml(html)).toBeNull();
  });

  it("returns null for a malformed canonical videoId even with a live flag", () => {
    const canonical = (id: string) =>
      `<link rel="canonical" href="https://www.youtube.com/watch?v=${id}">{"isLive":true}`;
    expect(extractLiveVideoFromHtml(canonical("abc123"))).toBeNull();
    expect(extractLiveVideoFromHtml(canonical("MayfgRt6rX8XYZ"))).toBeNull();
    expect(extractLiveVideoFromHtml(canonical("Mayfg%21t6rX8"))).toBeNull();
  });

  it("reads canonical regardless of attribute order", () => {
    const html = `<link href="https://www.youtube.com/watch?v=MayfgRt6rX8" rel="canonical">{"isLive":true}`;
    expect(extractLiveVideoFromHtml(html)?.videoId).toBe("MayfgRt6rX8");
  });

  it("returns null when there is no canonical link at all", () => {
    expect(extractLiveVideoFromHtml(`<html>{"isLive":true}</html>`)).toBeNull();
  });

  it("returns null for empty, whitespace, and garbage input", () => {
    expect(extractLiveVideoFromHtml("")).toBeNull();
    expect(extractLiveVideoFromHtml("   \n  ")).toBeNull();
    expect(extractLiveVideoFromHtml("<html><body>consent wall</body></html>")).toBeNull();
    expect(extractLiveVideoFromHtml("{{{not json at all")).toBeNull();
    expect(extractLiveVideoFromHtml(null)).toBeNull();
  });

  it("falls back to the meta title when there is no player block", () => {
    const html = `<link rel="canonical" href="https://www.youtube.com/watch?v=MayfgRt6rX8">
      <meta name="title" content="Nifty &amp; Sensex Live">{"isLive":true}`;
    expect(extractLiveVideoFromHtml(html)?.title).toBe("Nifty & Sensex Live");
  });

  it("returns a null title rather than failing when no title is present", () => {
    const html = `<link rel="canonical" href="https://www.youtube.com/watch?v=MayfgRt6rX8">{"isLive":true}`;
    expect(extractLiveVideoFromHtml(html)).toEqual({ videoId: "MayfgRt6rX8", title: null });
  });

  it("takes the title from the player block matching the canonical id", () => {
    // A page carries titles for many videos; only the canonical one is ours.
    const html = `<link rel="canonical" href="https://www.youtube.com/watch?v=MayfgRt6rX8">
      {"videoDetails":{"videoId":"dQw4w9WgXcQ","title":"Wrong Title"}}
      {"videoDetails":{"videoId":"MayfgRt6rX8","title":"Right Title","isLive":true}}`;
    expect(extractLiveVideoFromHtml(html)?.title).toBe("Right Title");
  });
});
