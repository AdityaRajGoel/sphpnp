import "@testing-library/jest-dom";

// jsdom ships no IntersectionObserver, and every reveal preset in
// `@/lib/motion` is built on Motion's `whileInView` - so without this stub any
// component test that renders a section throws before a single assertion runs,
// and the failure names the observer rather than the component, which sends
// you looking in the wrong file.
//
// The stub reports the target as intersecting immediately. A no-op observer
// would also stop the throw, but it would leave every revealed element parked
// at its initial (hidden) variant, so tests would be asserting against a state
// no real viewport ever shows.
class ImmediateIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "0px";
  readonly thresholds: ReadonlyArray<number> = [0];

  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe(target: Element): void {
    this.callback(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this,
    );
  }

  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  value: ImmediateIntersectionObserver,
});
Object.defineProperty(globalThis, "IntersectionObserver", {
  writable: true,
  value: ImmediateIntersectionObserver,
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Node 25 defines its own global localStorage, which has no methods unless the
// process starts with --localstorage-file, and it shadows jsdom's. The Supabase
// client reads its session from it on import, so any test that imports a module
// using the client would fail with "storage.getItem is not a function". CI runs
// Node 22 and never sees this; an in-memory store keeps local runs the same.
if (typeof globalThis.localStorage?.getItem !== "function") {
  const store = new Map<string, string>();
  const memory: Storage = {
    get length() { return store.size; },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => { store.delete(key); },
    setItem: (key, value) => { store.set(key, String(value)); },
  };
  Object.defineProperty(globalThis, "localStorage", { value: memory, configurable: true });
}
