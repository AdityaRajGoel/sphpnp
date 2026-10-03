import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { MotionGlobalConfig } from "motion/react";
import App, { queryClient } from "./App.tsx";
// Self-hosted: no fonts.googleapis.com/gstatic.com lookups, and the files get hashed
// names, so nginx caches them for a year like the rest of /assets.
import "@fontsource-variable/ibm-plex-sans";
import "@fontsource-variable/ibm-plex-sans/wght-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./index.css";
import { applyMotionPreference, readMotionPreference } from "@/lib/motion-preference";
import { installClientErrorReporting } from "@/lib/client-errors";
import { installChunkReload } from "@/lib/chunk-reload";
import { installDomMutationGuard } from "@/lib/dom-mutation-guard";
import { installAnalyticsConsent } from "@/lib/analytics-consent";
import { rememberPrerenderedHeight } from "@/lib/prerender";

// Uncaught browser errors are logged on the VPS itself (src/lib/client-errors.ts):
// live site only, never the prerender, local dev or staging.
installClientErrorReporting();
installChunkReload();
installDomMutationGuard();
installAnalyticsConsent();

// Register Service Worker for PWA
registerSW({ immediate: true });

// Stamp the saved motion preference onto <html> before the first paint, so the
// page never renders one motion policy and then swaps to another. This belongs
// in an inline <script> in index.html on pure-latency grounds, but the CSP in
// vercel.json has no nonce for one; running it here is early enough because the
// static splash covers the gap until React paints.
applyMotionPreference(readMotionPreference());

// The app decides where a new route starts, not the browser. With the default
// "auto", the browser re-applies a remembered scroll offset after a history
// entry changes, racing useScrollToHash's reset - which is why links
// intermittently landed partway down, or near the bottom of, a shorter page.
// Guarded: some embedded browsers expose `history` without this property.
try {
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
} catch {
  /* restoration stays browser-managed; useScrollToHash still resets on its own */
}

// Read before React replaces the static HTML (see lib/prerender).
rememberPrerenderedHeight("[data-stock-state]");

const staticRoot = document.getElementById("root")!;

// A prerendered page arrives as its full HTML with the splash hidden
// (scripts/lib/prerender-html.mjs), so the visitor reads it from the first
// paint. React renders the same page off-screen from the query data shipped
// with it, and takes its place once the route's code has loaded and nothing is
// fetching: no splash, no skeletons, no blank frame. Entrance animations are
// skipped until then, so content already on screen does not fade in again.
// ponytail: a swap, not hydrateRoot - the static HTML comes from Puppeteer, not
// renderToString, so React cannot attach to it; true hydration is step 5.
const SWAP_MAX_MS = 6000;
const isPrerenderedPage = document.getElementById("app-splash")?.style.display === "none" && !navigator.webdriver;

if (isPrerenderedPage) {
  MotionGlobalConfig.skipAnimations = true;
  const live = document.createElement("div");
  live.style.cssText = "position:absolute;top:0;left:0;right:0;visibility:hidden;pointer-events:none";
  live.setAttribute("aria-hidden", "true");
  document.body.appendChild(live);
  createRoot(live).render(<App />);
  const started = performance.now();
  let swapped = false;
  // The static page's buttons do nothing, so the first tap or key press swaps
  // at once rather than waiting out a slow fetch.
  const swapNow = () => swapWhenReady(true);
  const swapWhenReady = (force = false) => {
    if (swapped) return;
    const ready = live.childElementCount > 0 && !live.querySelector("[data-page-fallback]") && queryClient.isFetching() === 0;
    if (!force && !ready && performance.now() - started < SWAP_MAX_MS) {
      window.setTimeout(swapWhenReady, 50);
      return;
    }
    swapped = true;
    window.removeEventListener("pointerdown", swapNow, true);
    window.removeEventListener("keydown", swapNow, true);
    live.removeAttribute("style");
    live.removeAttribute("aria-hidden");
    staticRoot.replaceWith(live);
    live.id = "root";
    document.getElementById("app-splash")?.remove();
    requestAnimationFrame(() => requestAnimationFrame(() => { MotionGlobalConfig.skipAnimations = false; }));
  };
  window.addEventListener("pointerdown", swapNow, true);
  window.addEventListener("keydown", swapNow, true);
  swapWhenReady();
} else {
  createRoot(staticRoot).render(<App />);
}


// Fade out the static splash once React has painted, so users never see the
// prerendered-HTML -> client-render flash. Held for a minimum beat so the loader
// animation is seen (and content settles) instead of flickering off on fast loads.
const SPLASH_MIN_MS = 650;
const splashStart = performance.now();
let splashDone = false;
const hideSplash = () => {
  if (splashDone) return;
  splashDone = true;
  const el = document.getElementById("app-splash");
  if (!el) return;
  el.classList.add("hide");
  window.setTimeout(() => el.remove(), 550);
};
// Skip under Puppeteer (navigator.webdriver) so the splash stays baked into the
// prerendered HTML; real browsers fade it once React has painted.
if (!navigator.webdriver && !isPrerenderedPage) {
  const revealWhenReady = () => {
    const wait = Math.max(0, SPLASH_MIN_MS - (performance.now() - splashStart));
    window.setTimeout(hideSplash, wait);
  };
  requestAnimationFrame(() => requestAnimationFrame(revealWhenReady));
  window.setTimeout(hideSplash, 5000); // safety net
}
