/**
 * Verified snapshot of the Panipat Google Business Profile.
 *
 * Used only when the live `google-reviews` edge function cannot serve a figure.
 * As of the capture date that function returns PERMISSION_DENIED from the
 * Places API — the key is rejected, not the place ID — so without this the
 * section renders with no rating at all.
 *
 * Every value here was read off the live profile
 * (https://www.google.com/maps/place/?q=place_id:ChIJ6zHm2PzbDTkRJ_5hCPHVKaw)
 * on the capture date: 5.0 overall, 41 reviews, all of them five-star.
 *
 * `reviews` is deliberately empty and must stay that way unless the individual
 * reviews are actually retrieved. Google's terms require review text to be
 * shown as returned and attributed to its author, and the same rule the rest
 * of this feature follows applies here: no invented authors, no invented
 * quotes, no text attached to an author who may not have written it. An empty
 * array renders no grid, which is the correct outcome — the alternative is
 * fabricated testimonials on the site of a SEBI-registered intermediary.
 */
/** Mirrors the shape the edge function returns, so a captured review can be
 *  dropped straight in without reshaping it. */
export type SnapshotReview = {
  readonly name: string;
  readonly photo: string;
  readonly profileUrl: string;
  readonly rating: number;
  readonly time: string;
  readonly content: string;
};

export type ReviewSnapshot = {
  readonly rating: number;
  readonly totalReviews: number;
  /** ISO date the figures above were read off the profile. */
  readonly capturedOn: string;
  readonly mapsUrl: string;
  readonly reviews: readonly SnapshotReview[];
};

export const GOOGLE_REVIEWS_SNAPSHOT: ReviewSnapshot = {
  rating: 5.0,
  totalReviews: 41,
  capturedOn: "2026-08-03",
  mapsUrl: "https://share.google/BzommM8rixb1emIzj",
  reviews: [],
};
