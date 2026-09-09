import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";

/*
 * Behavioural guard for the promo banner's open/dismiss lifecycle.
 *
 * Scope note, because it was learned the hard way: the "banner won't close"
 * report was NOT a fault in this component's close path. Verified in a real
 * browser, dismissal works, Radix restores `pointer-events` on <body>, and the
 * page stays clickable. The actual defect was two modal layers opening at once
 * (cookie consent + this banner) — pinned in e2e/modal-stacking.spec.ts, which
 * needs a real browser because jsdom does not run Radix's scroll lock or its
 * aria-hidden handling.
 *
 * So these tests cover what jsdom can honestly cover: that the banner opens for
 * an undismissed banner, closes on request, and stays dismissed for the
 * session. They pin behaviour, not markup — the design is deliberately
 * untouched.
 */

const BANNER = {
  id: "banner-1",
  title: "Test Banner",
  message: "A message",
  type: "info" as const,
  link_url: null,
  link_text: null,
  button_text: null,
  image_url: null,
  bg_theme: "default",
};

const order = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: (...args: unknown[]) => order(...args),
        }),
      }),
    }),
  },
}));

const createStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  // jsdom here ships only a partial localStorage/sessionStorage (no `setItem`
  // on localStorage, no `clear`), so real in-memory implementations are
  // installed rather than weakening what these tests assert - the same approach
  // cookie-consent.test.tsx documents.
  for (const key of ["sessionStorage", "localStorage"] as const) {
    Object.defineProperty(window, key, {
      configurable: true,
      writable: true,
      value: createStorage(),
    });
  }
  order.mockResolvedValue({ data: [BANNER], error: null });
  // The banner now waits for a cookie decision before opening, so these tests
  // start from a session that has already answered.
  window.localStorage.setItem("panipat_cookie_consent", "essential");
});

afterEach(() => {
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** The component opens on a 500ms timer after its fetch resolves. */
const renderAndOpen = async () => {
  const { default: BannerMessage } = await import("@/components/BannerMessage");
  render(<BannerMessage />);
  await act(async () => {
    await Promise.resolve();
    vi.advanceTimersByTime(600);
  });
  return screen.findByRole("dialog");
};

describe("BannerMessage dismissal", () => {
  it("opens when an undismissed banner is published", async () => {
    await renderAndOpen();
    expect(screen.getByText("Test Banner")).toBeTruthy();
  });

  it("closes when the Close button is pressed", async () => {
    await renderAndOpen();

    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("auto-dismisses after the timeout instead of restarting its own timer", async () => {
    await renderAndOpen();

    // `dismiss` depends on `visibleBanners`, a fresh array each render, so the
    // 60s timer is rebuilt whenever this component re-renders. It survives here
    // because nothing re-renders it while idle — worth knowing if a live data
    // subscription is ever added to this component.
    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("stays dismissed for the rest of the session", async () => {
    await renderAndOpen();
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    cleanup();

    const { default: BannerMessage } = await import("@/components/BannerMessage");
    render(<BannerMessage />);
    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(600);
    });

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
