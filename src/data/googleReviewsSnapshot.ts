/**
 * Captured snapshot of the Panipat Google Business Profile.
 *
 * The live Places API path was removed: the key was rejected with
 * PERMISSION_DENIED (the key, not the place ID - a server-side call has no HTTP
 * referrer, which is what a referrer-restricted key rejects), and a review
 * section that depends on a billing-linked key nobody is watching is a section
 * that quietly disappears. These reviews are read off the public profile
 * instead and committed as data.
 *
 * Every value here is REAL and was read off the live profile on the capture
 * date:
 *   https://www.google.com/maps/place/?q=place_id:ChIJ6zHm2PzbDTkRJ_5hCPHVKaw
 * 5.0 overall across 41 reviews. Ten of those carry written text and are
 * reproduced below verbatim, with the author name, photo, star rating and
 * relative time exactly as Google shows them.
 *
 * The rule that governed the empty version of this file still governs the full
 * one: no invented authors, no invented quotes, no text attached to an author
 * who may not have written it. This component previously shipped six fabricated
 * five-star testimonials - a false claim shown to real users and an
 * advertising-code exposure for a SEBI-registered intermediary. If these
 * reviews are ever refreshed, they are re-read from the profile, never edited
 * by hand.
 *
 * Refresh: re-run the capture against the profile above and replace the array.
 * `capturedOn` must move with it so the page can say how old the figures are.
 */
/** Mirrors the shape the page renders, so a captured review drops straight in. */
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
  /** ISO date the figures below were read off the profile. */
  readonly capturedOn: string;
  readonly mapsUrl: string;
  readonly reviews: readonly SnapshotReview[];
};

const REVIEWS: readonly SnapshotReview[] = [
  {
    name: "Satinder Bhatia",
    photo: "https://lh3.googleusercontent.com/a/ACg8ocIpn9EpItatxmOE-miRisaBF8TtZ2jGQko56o6Ac5RCpA6QPg=w36-h36-p-rp-mo-br100",
    profileUrl: "https://www.google.com/maps/contrib/109138407686104452030/reviews?hl=en-GB",
    rating: 5,
    time: "4 years ago",
    content: "Excellent service provider. Personal care provided",
  },
  {
    name: "Mehul Gadodia",
    photo: "https://lh3.googleusercontent.com/a-/ALV-UjWU0crBLJGvePY9cI7Bha-U8IqtArUdjXLaN-IPocHW5qNETUwM=w36-h36-p-rp-mo-br100",
    profileUrl: "https://www.google.com/maps/contrib/105787149664697050865/reviews?hl=en-GB",
    rating: 5,
    time: "a month ago",
    content: "Most trusted stock broker in Panipat. Best services and great experience.",
  },
  {
    name: "divay saini",
    photo: "https://lh3.googleusercontent.com/a/ACg8ocIBJ5nzJTWf3AUH5XzqaqPMA18sYLfZo5djs-mXwXHLX_NMYNk=w36-h36-p-rp-mo-br100",
    profileUrl: "https://www.google.com/maps/contrib/113130078423239227053/reviews?hl=en-GB",
    rating: 5,
    time: "a month ago",
    content: "Excellent financial services in Panipat. Professional team and great support throughout.",
  },
  {
    name: "Kartik Tomar",
    photo: "https://lh3.googleusercontent.com/a-/ALV-UjUeEycLGhMjeqeSESmo-pEbM0QfPXE5t80KzqDc4Lb4mGZlu7fy=w36-h36-p-rp-mo-br100",
    profileUrl: "https://www.google.com/maps/contrib/117816944626202470268/reviews?hl=en-GB",
    rating: 5,
    time: "a month ago",
    content: "Best stock broker in Panipat. Great services",
  },
  {
    name: "Aadi Tomar",
    photo: "https://lh3.googleusercontent.com/a-/ALV-UjVgBdw6gcRNg-vaPZw5d6WcIOG87L80iapBbGNdzxZJf3Z_I7Y=w36-h36-p-rp-mo-br100",
    profileUrl: "https://www.google.com/maps/contrib/116249041335190147828/reviews?hl=en-GB",
    rating: 5,
    time: "a month ago",
    content: "Great services and genuine financial advice. Definately recommend",
  },
  {
    name: "yashpal singh",
    photo: "https://lh3.googleusercontent.com/a/ACg8ocIXEeImBR7n08rftctk4ALfohTdtphHfghkjlU16G-BmpU8Vw=w36-h36-p-rp-mo-br100",
    profileUrl: "https://www.google.com/maps/contrib/116807488117984350945/reviews?hl=en",
    rating: 5,
    time: "a month ago",
    content: "Reliable investment firm in panipat",
  },
  {
    name: "Bharath Raj R",
    photo: "https://lh3.googleusercontent.com/a-/ALV-UjVnVf5gqigjYiiW0YEnD8MelWsqIWKDub2ndTW_bSaKGbChgi4=w36-h36-p-rp-mo-br100",
    profileUrl: "https://www.google.com/maps/contrib/105436087728767219457/reviews?hl=en",
    rating: 5,
    time: "a month ago",
    content: "Best stock broker in panipat. Best services",
  },
  {
    name: "Dinesh T",
    photo: "https://lh3.googleusercontent.com/a/ACg8ocK_j2W_20BqmmM5iSAdHWjEewNBpOQnMs1x3YzmTd0eEWq3Dhkh=w36-h36-p-rp-mo-br100",
    profileUrl: "https://www.google.com/maps/contrib/108501759671518005989/reviews?hl=en",
    rating: 5,
    time: "a month ago",
    content: "Great services and packages",
  },
  {
    name: "Tanishq Kaul",
    photo: "https://lh3.googleusercontent.com/a-/ALV-UjV9nKso00_-aDIoUcNhn3HrAto31zrOuO2aNbVsOa5u5Sy3hufU=w36-h36-p-rp-mo-br100",
    profileUrl: "https://www.google.com/maps/contrib/117883518424242290382/reviews?hl=en",
    rating: 5,
    time: "a month ago",
    content: "Best stock broker in panipat",
  },
  {
    name: "Prashant Kumar",
    photo: "https://lh3.googleusercontent.com/a/ACg8ocKwJ63x-563n5EbzxfxY7-7UUsVXcGyPOsuYj3QVqE-PRPt6Q=w36-h36-p-rp-mo-br100",
    profileUrl: "https://www.google.com/maps/contrib/107777378509187176822/reviews?hl=en",
    rating: 5,
    time: "a month ago",
    content: "Great services and excellent experience",
  },
];

export const GOOGLE_REVIEWS_SNAPSHOT: ReviewSnapshot = {
  rating: 5.0,
  totalReviews: 41,
  capturedOn: "2026-09-10",
  mapsUrl: "https://www.google.com/maps/place/?q=place_id:ChIJ6zHm2PzbDTkRJ_5hCPHVKaw",
  reviews: REVIEWS,
};
