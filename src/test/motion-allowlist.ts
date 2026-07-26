/**
 * Ratchet allowlists for the motion sweep.
 *
 * These are the files that still violate the motion token rules. They shrink
 * to empty as the sweep proceeds and must never grow. `motion-tokens.test.ts`
 * fails both if a file outside the list violates (a regression) and if a file
 * on the list no longer violates (a stale entry), so deleting an entry is a
 * required part of migrating a file.
 */

/**
 * Files still containing hardcoded `duration-<number>` Tailwind classes.
 * Empty: the duration sweep is complete.
 */
export const DURATION_ALLOWLIST: readonly string[] = [];

/**
 * Files still hand-rolling `whileInView` reveals instead of using the presets.
 *
 * Eleven of these (About, BrandBanner, Contact, GoogleReviews,
 * InvestmentProducts, ScrollySteps, Services, Testimonials, UnlistedShares,
 * WhyChooseUs, TeamPage) already import `@/lib/motion` and use the presets in
 * some places while still hand-rolling reveals in others. The planning audit
 * treated "imports @/lib/motion" as "migrated" and missed them; this guard
 * found them on first run. Partial migration is the normal state here, so
 * membership is decided per-occurrence, never per-import.
 */
export const REVEAL_ALLOWLIST: readonly string[] = [
];
