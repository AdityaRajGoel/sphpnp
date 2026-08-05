import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CookieConsent from "@/components/CookieConsent";
import { CONSENT_KEY, readConsent, writeConsent } from "@/lib/consent";

const renderBanner = () =>
  render(
    <MemoryRouter>
      <CookieConsent />
    </MemoryRouter>,
  );

// jsdom in this project ships only a partial localStorage (no `clear`), so a
// real in-memory implementation is installed rather than weakening what the
// tests assert. The component still goes through the genuine
// window.localStorage API, which is the surface that throws in Safari private
// mode - the failure these tests exist to pin.
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
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    writable: true,
    value: createStorage(),
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * The storage helpers are tested separately from the component because the thing
 * that must never regress is not visual: it is which value gets written. Under
 * GDPR, dismissing a banner is not consent, so every path that is not an explicit
 * "Accept All" has to land on "essential".
 */
describe("consent storage", () => {
  it("reports no decision when nothing is stored", () => {
    expect(readConsent()).toBeNull();
  });

  it("round-trips an explicit decision", () => {
    writeConsent("all");
    expect(readConsent()).toBe("all");
    writeConsent("essential");
    expect(readConsent()).toBe("essential");
  });

  it("ignores a stored value it does not recognise", () => {
    // A stale or hand-edited key must not be treated as a decision, or a reader
    // could be silently opted in by a value we never wrote.
    window.localStorage.setItem(CONSENT_KEY, "yes-please");
    expect(readConsent()).toBeNull();
  });

  // Safari private mode and several privacy extensions make localStorage throw
  // on access. The old component called it unguarded inside an effect, so the
  // whole banner - and anything rendered after it - would break for those users.
  it("survives a localStorage that throws on read", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new DOMException("denied");
    });
    expect(() => readConsent()).not.toThrow();
    expect(readConsent()).toBeNull();
  });

  it("survives a localStorage that throws on write", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("denied");
    });
    expect(() => writeConsent("essential")).not.toThrow();
  });

  // The component must survive it too, not just the helper - this is the exact
  // path that used to break the banner for private-mode users.
  it("still renders the banner when storage is unavailable", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new DOMException("denied");
    });
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("denied");
    });
    expect(() => renderBanner()).not.toThrow();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(() =>
      fireEvent.click(screen.getByRole("button", { name: /accept all/i })),
    ).not.toThrow();
  });
});

describe("CookieConsent", () => {
  it("asks for a decision when none has been made", () => {
    renderBanner();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("stays out of the way once a decision exists", () => {
    writeConsent("all");
    renderBanner();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("records full consent only from the explicit accept control", () => {
    renderBanner();
    fireEvent.click(screen.getByRole("button", { name: /accept all/i }));
    expect(readConsent()).toBe("all");
  });

  it("records essential-only from the reject control", () => {
    renderBanner();
    fireEvent.click(screen.getByRole("button", { name: /essential only/i }));
    expect(readConsent()).toBe("essential");
  });

  // The one that matters legally: closing a banner is not agreement. Whatever
  // the dismiss affordance is, it must land on essential and never on "all".
  it("treats Escape as a refusal, never as consent", () => {
    renderBanner();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(readConsent()).toBe("essential");
    expect(readConsent()).not.toBe("all");
  });

  it("labels the dialog and its description for assistive tech", () => {
    renderBanner();
    const dialog = screen.getByRole("dialog");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    const describedBy = dialog.getAttribute("aria-describedby");
    expect(labelledBy).toBeTruthy();
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)).toBeInTheDocument();
    expect(document.getElementById(describedBy!)).toBeInTheDocument();
  });

  it("keeps the cookie policy reachable from the banner", () => {
    renderBanner();
    expect(screen.getByRole("link", { name: /cookie policy/i })).toHaveAttribute(
      "href",
      "/cookie-policy",
    );
  });
});
