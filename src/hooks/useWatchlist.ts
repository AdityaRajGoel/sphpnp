import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "panipat_watchlist";
export const MAX_WATCHLIST = 50;
const SYMBOL = /^[A-Z0-9&._-]{1,20}$/;

export interface WatchlistItem {
  symbol: string;
  name: string;
  addedAt: number;
}

/**
 * Stored data is untrusted: it may be from an older build, edited by hand or
 * written by a browser extension. Anything that is not a well-formed item is
 * dropped rather than rendered, and the list is capped.
 */
export function parseWatchlist(raw: string | null): WatchlistItem[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value
      .filter((x): x is { symbol: string; name?: unknown; addedAt?: unknown } => !!x && typeof x === "object" && typeof (x as { symbol?: unknown }).symbol === "string")
      .map((x) => ({
        symbol: x.symbol.toUpperCase(),
        name: typeof x.name === "string" && x.name.trim() ? x.name.slice(0, 120) : x.symbol.toUpperCase(),
        addedAt: typeof x.addedAt === "number" && Number.isFinite(x.addedAt) ? x.addedAt : 0,
      }))
      .filter((x) => SYMBOL.test(x.symbol) && !seen.has(x.symbol) && seen.add(x.symbol))
      .slice(0, MAX_WATCHLIST);
  } catch {
    return [];
  }
}

// One store for the whole app, so a star clicked on a stock page updates the
// header count immediately, and other tabs follow through the storage event.
const listeners = new Set<() => void>();
const EMPTY: WatchlistItem[] = [];
let cache: WatchlistItem[] | null = null;

function read(): WatchlistItem[] {
  if (cache === null) {
    try {
      cache = parseWatchlist(localStorage.getItem(STORAGE_KEY));
    } catch {
      cache = EMPTY;
    }
  }
  return cache;
}

function write(next: WatchlistItem[]) {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch { /* storage unavailable: the list still lives for this session */ }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useWatchlist() {
  const watchlist = useSyncExternalStore(subscribe, read, () => EMPTY);

  const addToWatchlist = useCallback((symbol: string, name: string) => {
    const upper = symbol.toUpperCase();
    const current = read();
    if (!SYMBOL.test(upper) || current.some((w) => w.symbol === upper) || current.length >= MAX_WATCHLIST) return;
    write([...current, { symbol: upper, name: name.slice(0, 120) || upper, addedAt: Date.now() }]);
  }, []);

  const removeFromWatchlist = useCallback((symbol: string) => {
    write(read().filter((w) => w.symbol !== symbol.toUpperCase()));
  }, []);

  const isInWatchlist = useCallback((symbol: string) => watchlist.some((w) => w.symbol === symbol.toUpperCase()), [watchlist]);

  return { watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist, isFull: watchlist.length >= MAX_WATCHLIST };
}
