// Live Google Business Profile reviews for the Panipat branch.
//
// Replaces a hardcoded array of invented testimonials that used to render on
// /about under a "What People Say on Google" heading. Fabricated reviews shown
// to users are a consumer-facing false claim and, for a SEBI-registered
// intermediary, an advertising-code problem - so this function is the only
// source of review content and it FAILS CLOSED: no key, no data, no reviews.
// The UI renders nothing rather than falling back to placeholder content.
//
//   source: Places API (New) - https://places.googleapis.com/v1/places/{placeId}
//   secret: GOOGLE_PLACES_API_KEY (restrict it to the Places API in GCP)
//
// Google's own terms require review content to be displayed as returned and
// attributed to the author, so we pass through author name, photo, rating and
// relative time unmodified rather than reformatting them.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// The Panipat branch listing. Same profile the "write a review" CTA points at.
//
// This was "ChIJ6zHm2Pzb0TkRJ_5hCPHVKaw" (an O where a D belongs), inherited
// from the CTA link. A place ID base64-encodes two fixed64s - the feature ID
// and the CID - and in the broken value only the CID half survived: it decoded
// to 0x39d1dbfcd8e631eb:0xac29d5f10861fe27, while the listing both Maps links
// on the site resolve to is 0x390ddbfcd8e631eb:0xac29d5f10861fe27. A malformed
// place ID is a 404 from Places, which this function reports as a 502.
const PLACE_ID = "ChIJ6zHm2PzbDTkRJ_5hCPHVKaw";

// Places charges per call. Reviews move slowly, so let the CDN and browser hold
// the response for 6h; stale-while-revalidate keeps the section instant on a
// cache miss instead of flashing an empty state.
const CACHE_CONTROL = "public, max-age=21600, stale-while-revalidate=86400";

type PlacesReview = {
  rating?: number;
  text?: { text?: string };
  originalText?: { text?: string };
  relativePublishTimeDescription?: string;
  authorAttribution?: { displayName?: string; photoUri?: string; uri?: string };
};

type PlacesResponse = {
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: PlacesReview[];
};

function json(body: unknown, status: number, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!apiKey) {
    // Fail closed. An unconfigured deployment must not silently look like a
    // business with no reviews AND must not resurrect placeholder content.
    console.error("GOOGLE_PLACES_API_KEY is not set - refusing to serve review data");
    return json({ error: "Review source not configured" }, 503, { "Cache-Control": "no-store" });
  }

  try {
    const url = `https://places.googleapis.com/v1/places/${PLACE_ID}`;
    const res = await fetch(url, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        // Field mask is mandatory on Places (New) and is what you get billed on.
        "X-Goog-FieldMask": "rating,userRatingCount,googleMapsUri,reviews",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Places API ${res.status}: ${body}`);
      // Echo Google's status enum (NOT_FOUND, PERMISSION_DENIED, SERVICE_DISABLED...)
      // so a failure is diagnosable from the response instead of needing a
      // redeploy to add logging. The enum carries no secret; the free-text
      // message stays in the logs.
      let status: string | undefined;
      try {
        status = (JSON.parse(body) as { error?: { status?: string } }).error?.status;
      } catch {
        /* non-JSON upstream error - the log line above is the record */
      }
      return json({ error: "Upstream review lookup failed", detail: status ?? res.status }, 502, {
        "Cache-Control": "no-store",
      });
    }

    const place = (await res.json()) as PlacesResponse;

    const reviews = (place.reviews ?? [])
      .map((r) => ({
        name: r.authorAttribution?.displayName ?? "",
        photo: r.authorAttribution?.photoUri ?? "",
        profileUrl: r.authorAttribution?.uri ?? "",
        rating: typeof r.rating === "number" ? r.rating : null,
        time: r.relativePublishTimeDescription ?? "",
        content: r.text?.text ?? r.originalText?.text ?? "",
      }))
      // Drop anything missing the parts we attribute on screen. Never invent them.
      .filter((r) => r.name && r.content && r.rating !== null);

    return json(
      {
        rating: typeof place.rating === "number" ? place.rating : null,
        totalReviews: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
        mapsUrl: place.googleMapsUri ?? "",
        reviews,
      },
      200,
      { "Cache-Control": CACHE_CONTROL },
    );
  } catch (err) {
    console.error("google-reviews failed:", err);
    return json({ error: "Review lookup failed" }, 500, { "Cache-Control": "no-store" });
  }
});
