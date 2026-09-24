import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls to the element matching the URL hash after navigation, or to the top
 * when there is none.
 *
 * The browser's own scroll restoration fights this: `history.scrollRestoration`
 * defaults to "auto", so the browser re-applies a remembered offset after a
 * history entry changes. Whether that lands before or after this effect is a
 * race, which is exactly why the "clicked a link and landed near the bottom of
 * the new page" report was intermittent. It is set to "manual" in main.tsx so
 * the browser stops competing.
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
