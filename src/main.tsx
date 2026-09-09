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
