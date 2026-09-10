import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls to the element matching the URL hash after navigation, or to the top
 * when there is none.
 *
 * Two things fight this and both had to be handled, because between them they
 * produced the "clicked a link and landed near the bottom of the new page"
 * report:
 *
 *  - The browser's own scroll restoration. `history.scrollRestoration` defaults
 *    to "auto", so the browser re-applies a remembered offset after a history
 *    entry changes. Whether that lands before or after this effect is a race,
 *    which is exactly why the symptom was intermittent. It is set to "manual"
 *    in main.tsx so the browser stops competing.
 *
 *  - Lenis. It maintains its own scroll position and re-applies it on its next
 *    animation frame, so a bare window.scrollTo can be undone a frame later.
 *
 * Hence the reset is applied now AND on the next frame: the first covers the
 * common case, the second survives anything that re-applies an offset after
 * this effect runs. Both are instant, so a user never sees the page travel.
 */
const useScrollToHash = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      const toTop = () => window.scrollTo({ top: 0, behavior: "instant" });
      toTop();
      const frame = requestAnimationFrame(toTop);
      return () => cancelAnimationFrame(frame);
    }

    // Small delay to let lazy-loaded components render
    const timeout = setTimeout(() => {
      const id = hash.replace("#", "");
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [pathname, hash]);
};

export default useScrollToHash;
