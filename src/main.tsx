import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import { applyMotionPreference, readMotionPreference } from "@/lib/motion-preference";

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
