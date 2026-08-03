import { useEffect, useState } from "react";

/**
 * Track which section is currently being read, for anchor navs on long pages.
 *
 * Uses IntersectionObserver rather than a scroll listener on purpose: a scroll
 * handler fires on every frame of every scroll on the page, which is exactly
 * the churn the performance rules warn about. The observer only wakes when a
 * boundary is actually crossed.
 *
 * `ids` must be a stable reference — declare it at module scope, not inline in
 * JSX, or the effect will tear down and rebuild the observer on every render.
 *
 * The default `rootMargin` shrinks the viewport to a band just under the sticky
 * header, so the active item is the heading you are actually reading rather
 * than whatever happens to be touching the bottom of the screen.
 */
export function useScrollSpy(
  ids: readonly string[],
  rootMargin = "-96px 0px -55% 0px",
): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const visible = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        // Last in document order, not first: when two sections straddle the
        // band the lower one is the heading you have just scrolled down to.
        // Taking the first instead leaves the nav a section behind the reader.
        //
        // Resolved from `ids` rather than from the entry list so the answer is
        // document order, not the order the observer happened to report in.
        let current: string | undefined;
        for (const id of ids) {
          if (visible.has(id)) current = id;
        }
        if (current) setActiveId(current);
      },
      { rootMargin, threshold: 0 },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids, rootMargin]);

  return activeId;
}
