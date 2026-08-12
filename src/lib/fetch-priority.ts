/**
 * The `fetchpriority` attribute, spelled the way React 18 will actually emit it.
 *
 * `@types/react@18.3` declares a camelCase `fetchPriority` prop on img/link, so
 * `fetchPriority="high"` type-checks and looks correct in review - but
 * react-dom@18.3's DOM implementation has no knowledge of it. At runtime React
 * logs "React does not recognize the `fetchPriority` prop on a DOM element" and
 * then DROPS the attribute, so the browser never receives the priority hint at
 * all. The types are simply ahead of the runtime here; camelCase support landed
 * in React 19.
 *
 * That combination is the worst kind of bug: it compiles, it renders, it passes
 * every test, and the only symptom is a console warning plus an LCP hint that
 * quietly does nothing on the hero image it was added for.
 *
 * Spread this instead of passing the prop directly. Lowercase is a
 * pass-through-unknown-attribute for React 18, which is exactly what is wanted.
 * On React 19 this can be deleted in favour of the plain camelCase prop.
 */
export const HIGH_FETCH_PRIORITY = { fetchpriority: "high" } as const;
