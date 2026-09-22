import { describe, it, expect, vi, beforeEach } from "vitest";

const insert = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ insert }) } }));

import { trackCustomEvent } from "@/hooks/usePageTracking";

describe("page tracking", () => {
  beforeEach(() => {
    insert.mockClear();
    sessionStorage.clear();
    delete (window as unknown as { __PRERENDER__?: boolean }).__PRERENDER__;
  });

  it("records nothing from the prerender's headless browser", () => {
    (window as unknown as { __PRERENDER__?: boolean }).__PRERENDER__ = true;
    trackCustomEvent("page_view");
    expect(insert).not.toHaveBeenCalled();
  });

  it("records nothing from a search engine's renderer", () => {
    const ua = vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    );
    trackCustomEvent("page_view");
    expect(insert).not.toHaveBeenCalled();
    ua.mockRestore();
  });

  it("attaches the referring host and utm tags to the session's first page view only", () => {
    vi.spyOn(document, "referrer", "get").mockReturnValue("https://www.google.com/search?q=sphpnp");
    window.history.replaceState({}, "", "/ipo?utm_source=telegram&utm_medium=social");
    trackCustomEvent("page_view");
    trackCustomEvent("page_view");
    expect(insert.mock.calls[0][0].metadata).toEqual({ referrer: "google.com", utm_source: "telegram", utm_medium: "social" });
    expect(insert.mock.calls[1][0].metadata).toEqual({});
  });
});
