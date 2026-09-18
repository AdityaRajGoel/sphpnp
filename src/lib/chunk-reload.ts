/**
 * Recover from a lazy chunk that failed to load ("Failed to fetch dynamically
 * imported module"), which visitors reported on flaky mobile connections.
 *
 * Retrying the import in place is not reliable: browsers may cache the failed
 * module fetch and hand back the same error. A full reload fetches it fresh, so
 * reload once - but never while offline (that would swap the page for the
 * browser's offline screen), and never twice in a row, so a chunk that is truly
 * missing falls through to the error boundary instead of looping.
 */
const KEY = "sphpnp:chunk-reload-at";
export const RELOAD_COOLDOWN_MS = 30_000;

export function shouldReloadForChunkError(now: number, lastReloadAt: number | null, online: boolean): boolean {
  if (!online) return false;
  return lastReloadAt === null || now - lastReloadAt > RELOAD_COOLDOWN_MS;
}

export function installChunkReload(): void {
  window.addEventListener("vite:preloadError", (event) => {
    let last: number | null = null;
    try {
      const raw = sessionStorage.getItem(KEY);
      last = raw ? Number(raw) : null;
    } catch {
      // Storage blocked: fall back to the error boundary rather than risk a loop.
      return;
    }
    const now = Date.now();
    if (!shouldReloadForChunkError(now, last, navigator.onLine)) return;
    try {
      sessionStorage.setItem(KEY, String(now));
    } catch {
      return;
    }
    event.preventDefault();
    window.location.reload();
  });
}
