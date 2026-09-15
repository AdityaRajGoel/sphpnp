import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import { applyMotionPreference, readMotionPreference } from "@/lib/motion-preference";

// Browser errors go to the self-hosted GlitchTip on the VPS (Sentry-compatible),
// through nginx on the same origin. Only on the live site in a real browser: never
// during the Puppeteer prerender (navigator.webdriver), in local dev or on staging.
if (window.location.hostname === "www.sphpnp.com" && !navigator.webdriver) {
  Sentry.init({
    dsn: "https://5f056a03d6ba45f1a02023d57da1b0d0@www.sphpnp.com/1",
    environment: "production",
    // Errors only: no performance tracing, session replay or default PII.
    tracesSampleRate: 0,
    sendDefaultPii: false,
    // Noise that is not ours: extensions, blocked third-party scripts, stale chunks
    // after a deploy (the page reloads itself for those).
    denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-web-extension:\/\//],
    ignoreErrors: ["ResizeObserver loop limit exceeded", "ResizeObserver loop completed with undelivered notifications"],
  });
}

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

createRoot(document.getElementById("root")!).render(<App />);

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
if (!navigator.webdriver) {
  const revealWhenReady = () => {
    const wait = Math.max(0, SPLASH_MIN_MS - (performance.now() - splashStart));
    window.setTimeout(hideSplash, wait);
  };
  requestAnimationFrame(() => requestAnimationFrame(revealWhenReady));
  window.setTimeout(hideSplash, 5000); // safety net
}
